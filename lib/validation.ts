import path from "path";
import { z } from "zod";
import { ApiError } from "./api-error";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, MAX_FILE_MB } from "./constants";
import { isSampleId, SAMPLE_IDS } from "./extract";

export { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, MAX_FILE_MB };

export type ScanInput =
  | { kind: "sample"; sampleId: string }
  | { kind: "file"; file: File };

/** Validate the high-level request shape (sample vs upload). */
export function validateScanRequest(formData: FormData): ScanInput {
  const sampleId = formData.get("sampleId");
  const file = formData.get("file");

  if (typeof sampleId === "string" && sampleId.length > 0) {
    if (!isSampleId(sampleId)) {
      throw new ApiError(
        "INVALID_INPUT",
        `Unknown sampleId. Valid values: ${SAMPLE_IDS.join(", ")}.`
      );
    }
    return { kind: "sample", sampleId };
  }

  if (file instanceof File) {
    return { kind: "file", file };
  }

  throw new ApiError(
    "INVALID_INPUT",
    "Provide either a 'file' upload or a 'sampleId' field."
  );
}

/**
 * Validate an uploaded file's size, extension, and that its bytes match the
 * declared type (magic-byte sniff) to prevent extension spoofing.
 */
export function assertValidUpload(
  fileName: string,
  size: number,
  buffer: Buffer
): void {
  if (size === 0) {
    throw new ApiError("INVALID_INPUT", "Uploaded file is empty.");
  }
  if (size > MAX_FILE_BYTES) {
    throw new ApiError(
      "FILE_TOO_LARGE",
      `File exceeds the ${MAX_FILE_MB} MB limit.`
    );
  }

  const ext = path.extname(fileName).toLowerCase();
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ApiError(
      "UNSUPPORTED_TYPE",
      `Unsupported file type "${ext || "unknown"}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`
    );
  }

  if (!matchesMagicBytes(ext, buffer)) {
    throw new ApiError(
      "UNSUPPORTED_TYPE",
      `File contents do not match its "${ext}" extension.`
    );
  }
}

/** Best-effort content sniff. Text formats have no signature, so they pass. */
function matchesMagicBytes(ext: string, buffer: Buffer): boolean {
  switch (ext) {
    // Text formats have no magic bytes; accept any non-empty content
    // (emptiness is rejected earlier), regardless of length.
    case ".txt":
    case ".md":
      return true;
    case ".pdf":
      return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    case ".png":
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case ".jpg":
    case ".jpeg":
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    case ".webp":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
        buffer.subarray(8, 12).toString("latin1") === "WEBP"
      );
    default:
      return true;
  }
}

const threatMatchSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  pattern: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

const extractionLayerSchema = z.object({
  source: z.enum([
    "pdf_text",
    "plain_text",
    "ocr_image",
    "ocr_pdf_embedded",
    "obfuscation_signal",
  ]),
  label: z.string(),
  content: z.string(),
});

/** Response contract for POST /api/scan, parsed before sending to the client. */
export const scanResultSchema = z.object({
  status: z.enum(["threat", "clean"]),
  riskScore: z.number(),
  confidence: z.number(),
  attackType: z.string().optional(),
  summary: z.string(),
  fileName: z.string(),
  threats: z.array(threatMatchSchema),
  extractedPreview: z.string(),
  sanitized: z.string(),
  logs: z.array(z.string()),
  detectionMethod: z.enum(["regex", "hybrid", "llm", "ocr"]),
  llmUsed: z.boolean(),
  ocrUsed: z.boolean(),
  layers: z.array(extractionLayerSchema),
  obfuscationDetected: z.boolean().optional(),
  obfuscationSummary: z.string().optional(),
});
