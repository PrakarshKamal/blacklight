import { NextRequest, NextResponse } from "next/server";
import { analyzeDocument } from "@/lib/analyze";
import { extractFromBuffer, loadSampleFile } from "@/lib/extract";
import { isServerlessEnvironment } from "@/lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const logs: string[] = ["Initializing Blacklight scanner…"];
  if (isServerlessEnvironment()) {
    logs.push("Mode: serverless-safe scan (PDF text layer + light OCR)");
  }

  try {
    const formData = await request.formData();
    const sampleId = formData.get("sampleId")?.toString();
    const file = formData.get("file");

    let buffer: Buffer;
    let fileName: string;

    if (sampleId) {
      const sample = await loadSampleFile(sampleId);
      buffer = sample.buffer;
      fileName = sample.fileName;
      logs.push(`Loaded sample: ${fileName}`);
    } else if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileName = file.name;
      logs.push(`Uploaded: ${fileName}`);
    } else {
      return NextResponse.json(
        { error: "Provide a file or sampleId" },
        { status: 400 }
      );
    }

    logs.push("Extracting text (PDF parser + OCR layers)…");
    const extraction = await extractFromBuffer(buffer, fileName);

    if (!extraction.fullText.trim()) {
      return NextResponse.json(
        {
          error:
            "No text could be extracted. Try a PDF with text, or an image with visible text.",
        },
        { status: 422 }
      );
    }

    logs.push("Checking regex injection patterns…");
    const result = await analyzeDocument(extraction, fileName, logs);
    logs.push("Scan complete.");

    return NextResponse.json({ ...result, logs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan document";
    console.error("Scan error:", error);
    return NextResponse.json(
      {
        error: message,
        logs: [...logs, `Error: ${message}`],
      },
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
