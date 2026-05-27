"use client";

import { useCallback, useRef, useState } from "react";
import { FileWarning, ShieldCheck, Upload } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ScanResult } from "@/lib/types";
import { ThreatPreview } from "@/components/scanner/threat-preview";
import { ThreatResults } from "@/components/scanner/threat-results";

type ScanState = "idle" | "scanning" | "threat" | "clean";
const MIN_SCAN_MS = 2800;

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
    setScanProgress(8);
    setVisibleLogs([]);

    const started = Date.now();
    let logInterval: ReturnType<typeof setInterval> | undefined;

    try {
      const responsePromise = fetch("/api/scan", {
        method: "POST",
        body: formData,
      });

      logInterval = setInterval(() => {
        setScanProgress((p) => Math.min(p + 12, 85));
      }, 400);

      const response = await responsePromise;
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Scan failed");
      }

      const logs: string[] = data.logs ?? [];
      for (let i = 0; i < logs.length; i++) {
        await new Promise((r) => setTimeout(r, 350));
        setVisibleLogs((prev) => [...prev, logs[i]]);
        setScanProgress(20 + ((i + 1) / logs.length) * 65);
      }

      const elapsed = Date.now() - started;
      if (elapsed < MIN_SCAN_MS) {
        await new Promise((r) => setTimeout(r, MIN_SCAN_MS - elapsed));
      }

      if (logInterval) clearInterval(logInterval);
      setScanProgress(100);
      setResult(data as ScanResult);
      setScanState(data.status === "threat" ? "threat" : "clean");
    } catch (e) {
      if (logInterval) clearInterval(logInterval);
      setError(e instanceof Error ? e.message : "Scan failed");
      setScanState("idle");
    }
  }, []);

  const scanSample = (sampleId: string, label: string) => {
    const fd = new FormData();
    fd.append("sampleId", sampleId);
    void runScan(fd, label);
  };

  const onFile = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    void runScan(fd, file.name);
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
          <p className="text-xs text-zinc-500">Threats prevented (demo)</p>
          <p className="font-mono text-2xl font-bold text-red-400">1,247</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/55 p-4">
          <p className="text-xs text-zinc-500">Scan engine</p>
          <p className="font-mono text-sm text-emerald-400">PDF + OCR + LLM</p>
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
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 px-6 py-10 transition hover:border-red-500/50 hover:bg-zinc-900"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) onFile(file);
              }}
            >
              <Upload className="mb-2 h-8 w-8 text-zinc-500" />
              <p className="text-sm font-medium">Drop file or click to upload</p>
              <p className="mt-1 text-xs text-zinc-500">PDF, TXT, PNG/JPG (OCR)</p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
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
                  disabled={scanState === "scanning"}
                >
                  <FileWarning className="mr-1.5 h-3.5 w-3.5" />
                  Try Malicious Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700"
                  onClick={() => scanSample("clean-resume", "resume-clean.pdf")}
                  disabled={scanState === "scanning"}
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
                  disabled={scanState === "scanning"}
                >
                  <FileWarning className="mr-1.5 h-3.5 w-3.5" />
                  Try OCR Screenshot
                </Button>
              </div>
            </div>

            {activeFile && (
              <p className="font-mono text-xs text-zinc-500">Scanning: {activeFile}</p>
            )}

            {scanState === "scanning" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-400/90">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  Analyzing document…
                </div>
                <Progress value={scanProgress} className="h-1.5" />
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <ThreatPreview result={result} />
          </CardContent>
        </MagicCard>

        <MagicCard>
          <CardHeader>
            <CardTitle className="text-base">Threat Analysis</CardTitle>
            <CardDescription>Prompt injection detection · Sanitization</CardDescription>
          </CardHeader>
          <CardContent>
            <ThreatResults scanState={scanState} result={result} logs={visibleLogs} />
          </CardContent>
        </MagicCard>
      </div>
    </section>
  );
}
