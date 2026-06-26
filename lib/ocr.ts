import os from "os";
import path from "path";
import { errInfo, logger } from "./logger";

type SharpFactory = (input: Buffer, options?: { failOn?: string }) => {
  rotate: () => SharpPipeline;
  metadata: () => Promise<{ width?: number; height?: number }>;
  clone: () => SharpPipeline;
  resize: (options?: unknown) => SharpPipeline;
  grayscale: () => SharpPipeline;
  normalize: () => SharpPipeline;
  sharpen: () => SharpPipeline;
  linear: (a: number, b?: number) => SharpPipeline;
  threshold: (t: number) => SharpPipeline;
  negate: () => SharpPipeline;
  png: () => SharpPipeline;
  toBuffer: () => Promise<Buffer>;
};

type SharpPipeline = {
  rotate: () => SharpPipeline;
  metadata: () => Promise<{ width?: number; height?: number }>;
  clone: () => SharpPipeline;
  resize: (options?: unknown) => SharpPipeline;
  grayscale: () => SharpPipeline;
  normalize: () => SharpPipeline;
  sharpen: () => SharpPipeline;
  linear: (a: number, b?: number) => SharpPipeline;
  threshold: (t: number) => SharpPipeline;
  negate: () => SharpPipeline;
  png: () => SharpPipeline;
  toBuffer: () => Promise<Buffer>;
};

type SharpLike = {
  default?: SharpFactory;
} & SharpFactory;

type TesseractWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text?: string } }>;
};

type WorkerOptions = {
  workerPath?: string;
  cachePath?: string;
  logger?: (m: unknown) => void;
};

type TesseractLike = {
  default?: {
    createWorker: (
      langs: string,
      oem: number,
      options?: WorkerOptions
    ) => Promise<TesseractWorker>;
  };
  createWorker?: (
    langs: string,
    oem: number,
    options?: WorkerOptions
  ) => Promise<TesseractWorker>;
};

let sharpFactory: SharpFactory | null = null;
let tesseractWorker: Promise<TesseractWorker> | null = null;

async function getSharpFactory(): Promise<SharpFactory> {
  if (!sharpFactory) {
    const mod = (await import("sharp")) as unknown as SharpLike;
    sharpFactory = (mod.default ?? mod) as SharpFactory;
  }
  return sharpFactory;
}

/**
 * A single cached Tesseract worker reused across passes/requests on a warm
 * lambda. The explicit `workerPath` points at the real file in node_modules
 * (build systems relocate files and break the worker's relative `require`),
 * and `cachePath` is a writable temp dir for the downloaded language data
 * (the default `.` is read-only on serverless platforms).
 */
async function getTesseractWorker(): Promise<TesseractWorker> {
  if (!tesseractWorker) {
    tesseractWorker = (async () => {
      const mod = (await import("tesseract.js")) as unknown as TesseractLike;
      const createWorker = mod.default?.createWorker ?? mod.createWorker ?? null;
      if (!createWorker) {
        throw new Error("tesseract.js createWorker() not available");
      }
      return createWorker("eng", 1, {
        workerPath: path.join(
          process.cwd(),
          "node_modules",
          "tesseract.js",
          "src",
          "worker-script",
          "node",
          "index.js"
        ),
        cachePath: os.tmpdir(),
        logger: () => {},
      });
    })();
  }
  return tesseractWorker;
}

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
  const sharp = await getSharpFactory();
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

type OcrOptions = {
  /** Single fast pass for serverless (Vercel timeout/memory). */
  light?: boolean;
};

export async function ocrFromBufferDetailed(
  buffer: Buffer,
  options?: OcrOptions
): Promise<{
  text: string;
  bestPass: string;
}> {
  const maxMs = options?.light ? 8_000 : MAX_OCR_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), maxMs);

  try {
    const sharp = await getSharpFactory();
    const candidates = options?.light
      ? [
          {
            label: "original",
            buffer: await sharp(buffer, { failOn: "none" })
              .rotate()
              .resize({
                width: 1800,
                height: 1800,
                fit: "inside",
                withoutEnlargement: true,
              })
              .png()
              .toBuffer(),
          },
        ]
      : await buildOcrCandidates(buffer);
    let best = "";
    let bestScore = 0;
    let bestPass = "none";

    for (const candidate of candidates) {
      let result;
      try {
        const worker = await getTesseractWorker();
        result = await worker.recognize(candidate.buffer);
      } catch (ocrErr) {
        logger.warn("ocr.pass_failed", { pass: candidate.label, err: errInfo(ocrErr) });
        continue;
      }
      const text = (result.data.text ?? "").trim();
      const score = scoreOcrText(text);
      if (score > bestScore) {
        best = text;
        bestScore = score;
        bestPass = candidate.label;
      }
    }

    return { text: best, bestPass };
  } catch (err) {
    logger.warn("ocr.pipeline_failed", { err: errInfo(err) });
    return { text: "", bestPass: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function ocrFromBuffer(buffer: Buffer): Promise<string> {
  const { text } = await ocrFromBufferDetailed(buffer);
  return text;
}
