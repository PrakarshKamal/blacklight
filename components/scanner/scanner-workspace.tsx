"use client";

import { useCallback, useRef, useState } from "react";
import { FileWarning, ShieldCheck, Upload } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ScanApiResponse, ScanResult } from "@/lib/types";
import {
  checkFileClientSide,
  FILE_ACCEPT_ATTR,
  MAX_FILE_MB,
} from "@/lib/constants";
import { ThreatPreview } from "@/components/scanner/threat-preview";
import { ThreatResults } from "@/components/scanner/threat-results";

type ScanState = "idle" | "scanning" | "threat" | "clean";

/** Stagger between revealed log lines — a readability choice, not simulated work. */
const LOG_REVEAL_MS = 110;

export function ScannerWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const runScan = useCallback(async (formData: FormData, displayName: string) => {
    setError(null);
    setResult(null);
    setScanState("scanning");
    setActiveFile(displayName);
    setScanProgress(10);
    setVisibleLogs([]);

    let progressTimer: ReturnType<typeof setInterval> | undefined;

    try {
      // Indeterminate progress while the request is genuinely in flight.
      progressTimer = setInterval(() => {
        setScanProgress((p) => Math.min(p + 7, 80));
      }, 300);

      const response = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });

      if (progressTimer) clearInterval(progressTimer);
      setScanProgress(85);

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "The scanner returned an unexpected response. Please try again."
        );
      }

      const data = (await response.json()) as ScanApiResponse;

      if (!response.ok || "error" in data) {
        const message =
          ("error" in data && data.error?.message) ||
          "Scan failed. Please try again.";
        throw new Error(message);
      }

      // Reveal log lines with a small stagger so progress reads clearly.
      const logs = data.logs ?? [];
      for (let i = 0; i < logs.length; i++) {
        setVisibleLogs((prev) => [...prev, logs[i]]);
        setScanProgress(85 + ((i + 1) / Math.max(logs.length, 1)) * 14);
        if (i < logs.length - 1) {
          await new Promise((r) => setTimeout(r, LOG_REVEAL_MS));
        }
      }

      setScanProgress(100);
      setResult(data);
      setScanState(data.status === "threat" ? "threat" : "clean");
    } catch (e) {
      if (progressTimer) clearInterval(progressTimer);
      setError(e instanceof Error ? e.message : "Scan failed. Please try again.");
      setScanState("idle");
      setScanProgress(0);
    }
  }, []);

  const scanSample = (sampleId: string, label: string) => {
    const fd = new FormData();
    fd.append("sampleId", sampleId);
    void runScan(fd, label);
  };

  const onFile = (file: File) => {
    const validationError = checkFileClientSide(file);
    if (validationError) {
      setResult(null);
      setActiveFile(file.name);
      setScanState("idle");
      setScanProgress(0);
      setError(validationError);
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    void runScan(fd, file.name);
  };

  const isScanning = scanState === "scanning";

  const openFileDialog = () => {
    if (!isScanning) inputRef.current?.click();
  };

  return (
    <section id="scanner" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
      <div className="mb-5">
        <p className="section-label">Live scanner</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-100">
          Scan uploads before your LLM reads them
        </h2>
        <p className="mt-2 text-zinc-400">
          Real-time prompt injection analysis with highlighted evidence and sanitized output.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-4">
          <p className="text-xs text-zinc-500">Last scan risk</p>
          <p
            className={`font-mono text-2xl font-bold ${
              result
                ? result.status === "threat"
                  ? "text-red-400"
                  : "text-emerald-400"
                : "text-zinc-500"
            }`}
          >
            {result ? `${result.riskScore}/100` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-4">
          <p className="text-xs text-zinc-500">Detection layers</p>
          <p className="font-mono text-sm text-emerald-400">PDF · OCR · LLM</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-4">
          <p className="text-xs text-zinc-500">RAG ingestion status</p>
          <p className="font-mono text-sm text-zinc-300">
            {scanState === "threat"
              ? "Unsafe for RAG ingestion"
              : scanState === "clean"
                ? "Safe for AI ingestion"
                : "Awaiting document"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MagicCard>
          <CardHeader>
            <CardTitle className="text-base">Document</CardTitle>
            <CardDescription>
              Upload PDF or text · Pre-scan before LLM ingestion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={isScanning ? -1 : 0}
              aria-label="Upload a document to scan. Accepted types: PDF, TXT, Markdown, PNG, JPG, WebP."
              aria-disabled={isScanning}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 px-6 py-10 transition hover:border-red-500/50 hover:bg-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              onClick={openFileDialog}
              onKeyDown={(e) => {
                if (isScanning) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openFileDialog();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (isScanning) return;
                const file = e.dataTransfer.files[0];
                if (file) onFile(file);
              }}
            >
              <Upload className="mb-2 h-8 w-8 text-zinc-500" />
              <p className="text-sm font-medium">Drop file or click to upload</p>
              <p className="mt-1 text-xs text-zinc-500">
                PDF, TXT, PNG/JPG (OCR) · max {MAX_FILE_MB} MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept={FILE_ACCEPT_ATTR}
                aria-label="Document file upload"
                tabIndex={-1}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Demo files</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-950/50"
                  onClick={() => scanSample("malicious-invoice", "invoice-malicious.pdf")}
                  disabled={isScanning}
                >
                  <FileWarning className="mr-1.5 h-3.5 w-3.5" />
                  Try Malicious Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700"
                  onClick={() => scanSample("clean-resume", "resume-clean.pdf")}
                  disabled={isScanning}
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  Try Clean Resume
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-900/60 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40"
                  onClick={() =>
                    scanSample("malicious-screenshot", "malicious-screenshot.png")
                  }
                  disabled={isScanning}
                >
                  <FileWarning className="mr-1.5 h-3.5 w-3.5" />
                  Try OCR Screenshot
                </Button>
              </div>
            </div>

            {activeFile && (
              <p className="font-mono text-xs text-zinc-500">
                {isScanning ? "Scanning" : "Selected"}: {activeFile}
              </p>
            )}

            <div role="status" aria-live="polite" aria-busy={isScanning}>
              {isScanning && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-amber-400/90">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    Analyzing document…
                  </div>
                  <Progress value={scanProgress} className="h-1.5" />
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <ThreatPreview result={result} />
          </CardContent>
        </MagicCard>

        <MagicCard>
          <CardHeader>
            <CardTitle className="text-base">Threat Analysis</CardTitle>
            <CardDescription>Prompt injection detection · Sanitization</CardDescription>
          </CardHeader>
          <CardContent>
            <div aria-live="polite">
              <ThreatResults scanState={scanState} result={result} logs={visibleLogs} />
            </div>
          </CardContent>
        </MagicCard>
      </div>
    </section>
  );
}
