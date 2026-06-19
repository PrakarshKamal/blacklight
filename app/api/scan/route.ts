import { NextRequest, NextResponse } from "next/server";
import { analyzeDocument } from "@/lib/analyze";
import { ApiError } from "@/lib/api-error";
import { extractFromBuffer, loadSampleFile } from "@/lib/extract";
import { errInfo, logger } from "@/lib/logger";
import { clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";
import { isServerlessEnvironment } from "@/lib/runtime";
import type { ScanErrorCode, ScanErrorResponse } from "@/lib/types";
import {
  assertValidUpload,
  MAX_FILE_BYTES,
  scanResultSchema,
  validateScanRequest,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function errorResponse(
  code: ScanErrorCode,
  message: string,
  status: number,
  requestId: string,
  extraHeaders?: Record<string, string>
): NextResponse {
  const body: ScanErrorResponse = { error: { code, message }, requestId };
  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": requestId, ...extraHeaders },
  });
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId });
  const logs: string[] = ["Initializing Blacklight scanner…"];
  if (isServerlessEnvironment()) {
    logs.push("Mode: lite scan (PDF text layer + single-pass OCR)");
  }

  try {
    // Reject oversized bodies before buffering them into memory.
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_FILE_BYTES * 1.1) {
      return errorResponse(
        "FILE_TOO_LARGE",
        `Request body exceeds the ${MAX_FILE_BYTES / (1024 * 1024)} MB limit.`,
        413,
        requestId
      );
    }

    // Best-effort rate limiting per client.
    const clientKey = clientKeyFromHeaders(request.headers);
    const limit = rateLimit(clientKey);
    if (!limit.allowed) {
      log.warn("scan.rate_limited", { clientKey, retryAfter: limit.retryAfter });
      return errorResponse(
        "RATE_LIMITED",
        `Too many requests. Try again in ${limit.retryAfter}s.`,
        429,
        requestId,
        { "Retry-After": String(limit.retryAfter) }
      );
    }

    const formData = await request.formData();
    const input = validateScanRequest(formData);

    let buffer: Buffer;
    let fileName: string;

    if (input.kind === "sample") {
      const sample = await loadSampleFile(input.sampleId);
      buffer = sample.buffer;
      fileName = sample.fileName;
      logs.push(`Loaded sample: ${fileName}`);
    } else {
      const arrayBuffer = await input.file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileName = input.file.name;
      assertValidUpload(fileName, input.file.size, buffer);
      logs.push(`Uploaded: ${fileName}`);
    }

    logs.push("Extracting text (PDF parser + OCR layers)…");
    const extraction = await extractFromBuffer(buffer, fileName);

    if (!extraction.fullText.trim()) {
      throw new ApiError(
        "NO_TEXT",
        "No text could be extracted. Try a PDF with a text layer, or an image with visible text."
      );
    }

    logs.push("Checking regex injection patterns…");
    const result = await analyzeDocument(extraction, fileName, logs, log);
    logs.push("Scan complete.");

    const parsed = scanResultSchema.parse({ ...result, logs });
    log.info("scan.completed", {
      fileName,
      status: parsed.status,
      riskScore: parsed.riskScore,
      detectionMethod: parsed.detectionMethod,
      llmUsed: parsed.llmUsed,
    });

    return NextResponse.json(parsed, {
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      log.warn("scan.client_error", { code: error.code, message: error.message });
      return errorResponse(error.code, error.message, error.status, requestId);
    }

    // Never leak internal error details to the client.
    log.error("scan.internal_error", { err: errInfo(error) });
    return errorResponse(
      "INTERNAL",
      "An unexpected error occurred while scanning. Please try again.",
      500,
      requestId
    );
  }
}
