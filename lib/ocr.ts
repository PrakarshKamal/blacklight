import Tesseract from "tesseract.js";
import sharp from "sharp";

const MAX_OCR_MS = 25_000;
const MAX_DIMENSION = 2400;

type OcrCandidate = {
  label: string;
  buffer: Buffer;
};

function scoreOcrText(text: string): number {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return 0;
  const letters = (cleaned.match(/[a-z]/gi) ?? []).length;
  const words = cleaned.split(" ").filter(Boolean).length;
  return letters + words * 3;
}

async function buildOcrCandidates(input: Buffer): Promise<OcrCandidate[]> {
  const base = sharp(input, { failOn: "none" }).rotate();
  const metadata = await base.metadata();
  const resizeOptions =
    metadata.width && metadata.height && (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION)
      ? { width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside" as const, withoutEnlargement: true }
      : undefined;

  const normalized = base
    .clone()
    .resize(resizeOptions)
    .grayscale()
    .normalize()
    .sharpen();

  const [original, highContrast, thresholded, inverted] = await Promise.all([
    base.clone().resize(resizeOptions).png().toBuffer(),
    normalized.clone().linear(1.35, -20).png().toBuffer(),
    normalized.clone().threshold(210).png().toBuffer(),
    normalized.clone().negate().linear(1.2, 0).png().toBuffer(),
  ]);

  return [
    { label: "original", buffer: original },
    { label: "high-contrast", buffer: highContrast },
    { label: "thresholded", buffer: thresholded },
    { label: "inverted", buffer: inverted },
  ];
}

export async function ocrFromBufferDetailed(buffer: Buffer): Promise<{
  text: string;
  bestPass: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_OCR_MS);

  try {
    const candidates = await buildOcrCandidates(buffer);
    let best = "";
    let bestScore = 0;
    let bestPass = "none";

    for (const candidate of candidates) {
      const result = await Tesseract.recognize(candidate.buffer, "eng", {
        logger: () => {},
      });
      const text = (result.data.text ?? "").trim();
      const score = scoreOcrText(text);
      if (score > bestScore) {
        best = text;
        bestScore = score;
        bestPass = candidate.label;
      }
    }

    return { text: best, bestPass };
  } finally {
    clearTimeout(timer);
  }
}

export async function ocrFromBuffer(buffer: Buffer): Promise<string> {
  const { text } = await ocrFromBufferDetailed(buffer);
  return text;
}
