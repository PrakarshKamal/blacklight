import { readFile } from "fs/promises";
import path from "path";
import { detectVisualObfuscation } from "./obfuscation";
import { ocrFromBufferDetailed } from "./ocr";
import { appOrigin, isServerlessEnvironment } from "./runtime";
import type { ExtractionLayer, ExtractionResult } from "./types";

type PdfParseCtor = new (options: { data: Buffer }) => {
  getText: () => Promise<{ text?: string }>;
  getScreenshot: (options: {
    imageBuffer: boolean;
    scale?: number;
  }) => Promise<{ pages?: { data?: Uint8Array; pageNumber?: number }[] }>;
  getImage: (options: {
    imageThreshold: number;
    imageBuffer: boolean;
  }) => Promise<{
    pages?: { pageNumber?: number; images?: { data?: Uint8Array }[] }[];
  }>;
  destroy: () => Promise<void>;
};

async function getPdfParse(): Promise<PdfParseCtor> {
  const mod = (await import("pdf-parse")) as unknown as { PDFParse: PdfParseCtor };
  return mod.PDFParse;
}

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tiff",
]);

const MAX_PDF_IMAGES_OCR = 4;

function joinLayers(layers: ExtractionLayer[]): string {
  if (layers.length === 0) return "";
  return layers.map((l) => `[${l.label}]\n${l.content}`).join("\n\n---\n\n");
}

/** PDF text layer only — reliable on Vercel (no page render OCR). */
async function extractPdfLayersLight(buffer: Buffer): Promise<{
  layers: ExtractionLayer[];
  pdfTextLayerLeak: boolean;
}> {
  const PDFParse = await getPdfParse();
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const pdfText = (textResult.text ?? "").trim();
    const layers: ExtractionLayer[] = [];
    if (pdfText) {
      layers.push({
        source: "pdf_text",
        label: "PDF text layer (includes text under visual covers)",
        content: pdfText,
      });
    }
    return { layers, pdfTextLayerLeak: false };
  } finally {
    await parser.destroy();
  }
}

async function extractPdfLayers(buffer: Buffer): Promise<{
  layers: ExtractionLayer[];
  pdfTextLayerLeak: boolean;
}> {
  if (isServerlessEnvironment()) {
    return extractPdfLayersLight(buffer);
  }

  const layers: ExtractionLayer[] = [];
  let pdfText = "";
  let pageOcrCombined = "";
  const PDFParse = await getPdfParse();
  const parser = new PDFParse({ data: buffer });

  try {
    const textResult = await parser.getText();
    pdfText = (textResult.text ?? "").trim();
    if (pdfText) {
      layers.push({
        source: "pdf_text",
        label: "PDF text layer (includes text under visual covers)",
        content: pdfText,
      });
    }

    try {
      const screenshot = await parser.getScreenshot({
        imageBuffer: true,
        scale: 1.5,
      });

      for (const page of screenshot.pages ?? []) {
        if (!page.data?.length) continue;
        const imgBuffer = Buffer.from(page.data);
        const { text, bestPass } = await ocrFromBufferDetailed(imgBuffer);
        if (text) {
          pageOcrCombined += `${text}\n`;
          layers.push({
            source: "ocr_image",
            label: `OCR rendered page ${page.pageNumber ?? "?"} (${bestPass})`,
            content: text,
          });
        }
      }
    } catch (screenErr) {
      console.warn("PDF page OCR skipped:", screenErr);
    }

    try {
      const imageResult = await parser.getImage({
        imageThreshold: 40,
        imageBuffer: true,
      });

      let ocrCount = 0;
      for (const page of imageResult.pages ?? []) {
        for (const img of page.images ?? []) {
          if (ocrCount >= MAX_PDF_IMAGES_OCR) break;
          if (!img.data?.length) continue;

          ocrCount++;
          const imgBuffer = Buffer.from(img.data);
          const { text, bestPass } = await ocrFromBufferDetailed(imgBuffer);
          if (text) {
            layers.push({
              source: "ocr_pdf_embedded",
              label: `OCR embedded image (page ${page.pageNumber ?? "?"}, ${bestPass})`,
              content: text,
            });
          }
        }
      }
    } catch (imgErr) {
      console.warn("PDF embedded image OCR skipped:", imgErr);
    }
  } finally {
    await parser.destroy();
  }

  const pdfTextLen = pdfText.length;
  const visibleLen = pageOcrCombined.trim().length;
  const pdfTextLayerLeak =
    pdfTextLen > 80 &&
    visibleLen > 0 &&
    pdfTextLen > visibleLen * 1.35;

  return { layers, pdfTextLayerLeak };
}

export async function extractFromBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ExtractionResult> {
  const ext = path.extname(fileName).toLowerCase();
  const layers: ExtractionLayer[] = [];
  let obfuscation;
  let pdfTextLayerLeak = false;

  if (ext === ".txt" || ext === ".md") {
    layers.push({
      source: "plain_text",
      label: "Plain text",
      content: buffer.toString("utf-8"),
    });
  } else if (ext === ".pdf") {
    const pdf = await extractPdfLayers(buffer);
    layers.push(...pdf.layers);
    pdfTextLayerLeak = pdf.pdfTextLayerLeak;
    if (pdfTextLayerLeak) {
      layers.push({
        source: "obfuscation_signal",
        label: "PDF text-layer leak",
        content:
          "Selectable PDF text contains more content than visible OCR — hidden text may exist under white overlays.",
      });
    }
  } else if (IMAGE_EXT.has(ext)) {
    obfuscation = await detectVisualObfuscation(buffer);

    const { text, bestPass } = await ocrFromBufferDetailed(buffer, {
      light: isServerlessEnvironment(),
    });
    layers.push({
      source: "ocr_image",
      label: `OCR image scan (${bestPass})`,
      content: text || "(no text detected in image)",
    });

    if (obfuscation.detected) {
      layers.push({
        source: "obfuscation_signal",
        label: "Visual obfuscation",
        content: obfuscation.description,
      });
    }
  } else {
    throw new Error(
      `Unsupported file type: ${ext}. Use PDF, TXT, or image (PNG/JPG/WebP).`
    );
  }

  const fullText = joinLayers(layers).trim();
  return {
    fullText,
    layers,
    obfuscation,
    pdfTextLayerLeak,
  };
}

export async function loadSampleFile(sampleId: string): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const map: Record<string, string> = {
    // Vercel serverless: avoid PDF parsing by using deterministic text sample.
    "malicious-invoice": isServerlessEnvironment()
      ? "invoice.txt"
      : "invoice-malicious.pdf",
    "clean-resume": isServerlessEnvironment() ? "resume.txt" : "resume-clean.pdf",
    "malicious-screenshot": isServerlessEnvironment()
      ? "screenshot-ocr.txt"
      : "malicious-screenshot.png",
  };

  const fileName = map[sampleId];
  if (!fileName) {
    throw new Error(`Unknown sample: ${sampleId}`);
  }

  const filePath = path.join(process.cwd(), "public", "samples", fileName);

  try {
    const buffer = await readFile(filePath);
    return { buffer, fileName };
  } catch (readErr) {
    console.warn("Sample readFile failed, fetching from app origin:", readErr);
    const url = `${appOrigin()}/samples/${encodeURIComponent(fileName)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        `Sample file not found (${fileName}). Ensure public/samples is deployed.`
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, fileName };
  }
}
