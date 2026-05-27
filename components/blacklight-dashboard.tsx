"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Upload,
  FileWarning,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScanResult } from "@/lib/types";

type ScanState = "idle" | "scanning" | "threat" | "clean";

const MIN_SCAN_MS = 2800;

function highlightThreats(text: string, result: ScanResult | null) {
  if (!result?.threats.length) return text;

  const parts: { text: string; threat: boolean }[] = [];
  let cursor = 0;
  const sorted = [...result.threats].sort((a, b) => a.start - b.start);

  for (const threat of sorted) {
    if (threat.start > cursor) {
      parts.push({ text: text.slice(cursor, threat.start), threat: false });
    }
    parts.push({ text: text.slice(threat.start, threat.end), threat: true });
    cursor = threat.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), threat: false });
  }

  return parts.map((part, i) =>
    part.threat ? (
      <mark
        key={i}
        className="rounded bg-red-500/30 px-0.5 text-red-200 ring-1 ring-red-500/50"
      >
        {part.text}
      </mark>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );
}

export function BlacklightDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const runScan = useCallback(
    async (formData: FormData, displayName: string) => {
      setError(null);
      setResult(null);
      setScanState("scanning");
      setActiveFile(displayName);
      setScanProgress(8);
      setVisibleLogs([]);

      const started = Date.now();

      try {
        const responsePromise = fetch("/api/scan", {
          method: "POST",
          body: formData,
        });

        const logInterval = setInterval(() => {
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

        clearInterval(logInterval);
        setScanProgress(100);
        setResult(data as ScanResult);
        setScanState(data.status === "threat" ? "threat" : "clean");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scan failed");
        setScanState("idle");
      }
    },
    []
  );

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
    <div className="min-h-screen bg-[#0a0e17] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(239,68,68,0.08),_transparent_50%)]" />

      <header className="relative border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg ring-1 ring-zinc-700/80">
              <Image
                src="/branding/blacklight-logo.png"
                alt="Blacklight logo"
                width={40}
                height={40}
                className="h-10 w-10 object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Blacklight
              </h1>
              <p className="text-xs text-zinc-500">
                AI firewall · Prompt injection scanner
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-400 font-mono text-[10px]"
          >
            LLM Supply Chain Protection
          </Badge>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-4">
              <p className="text-xs text-zinc-500">Threats prevented (demo)</p>
              <p className="font-mono text-2xl font-bold text-red-400">1,247</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-4">
              <p className="text-xs text-zinc-500">Scan engine</p>
              <p className="font-mono text-sm text-emerald-400">
                PDF + OCR + LLM
              </p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/50">
            <CardContent className="pt-4">
              <p className="text-xs text-zinc-500">RAG ingestion status</p>
              <p className="font-mono text-sm text-zinc-300">
                {scanState === "threat"
                  ? "Unsafe for RAG ingestion"
                  : scanState === "clean"
                    ? "Safe for AI ingestion"
                    : "Awaiting document"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: document */}
          <Card className="border-zinc-800 bg-zinc-950/80">
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
                <p className="mt-1 text-xs text-zinc-500">
                  PDF, TXT, PNG/JPG (OCR)
                </p>
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

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-950/50"
                  onClick={() =>
                    scanSample("malicious-invoice", "invoice-malicious.pdf")
                  }
                  disabled={scanState === "scanning"}
                >
                  <FileWarning className="mr-1.5 h-3.5 w-3.5" />
                  Try Malicious Invoice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700"
                  onClick={() =>
                    scanSample("clean-resume", "resume-clean.pdf")
                  }
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
                    scanSample(
                      "malicious-screenshot",
                      "malicious-screenshot.png"
                    )
                  }
                  disabled={scanState === "scanning"}
                >
                  <FileWarning className="mr-1.5 h-3.5 w-3.5" />
                  Try OCR Screenshot
                </Button>
              </div>

              {activeFile && (
                <p className="font-mono text-xs text-zinc-500">
                  Scanning: {activeFile}
                </p>
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

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <ScrollArea className="h-[320px] rounded-md border border-zinc-800 bg-black/40 p-4 font-mono text-xs leading-relaxed text-zinc-400">
                {result ? (
                  highlightThreats(result.extractedPreview, result)
                ) : (
                  <span className="text-zinc-600">
                    Document preview will appear here after scan…
                  </span>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right: analysis */}
          <Card className="border-zinc-800 bg-zinc-950/80">
            <CardHeader>
              <CardTitle className="text-base">Threat Analysis</CardTitle>
              <CardDescription>
                Prompt injection detection · Sanitization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {scanState === "idle" && (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                  <Shield className="mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm">Upload a document to begin scan</p>
                </div>
              )}

              {scanState === "scanning" && (
                <div className="space-y-3">
                  <div className="rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-[11px] text-emerald-500/90">
                    <div className="mb-2 flex items-center gap-2 text-zinc-500">
                      <Terminal className="h-3.5 w-3.5" />
                      blacklight scan
                    </div>
                    {visibleLogs.map((log, i) => (
                      <div key={i} className="text-zinc-400">
                        <span className="text-emerald-600">{">"}</span> {log}
                      </div>
                    ))}
                    <div className="mt-1 animate-pulse text-zinc-600">_</div>
                  </div>
                </div>
              )}

              {(scanState === "threat" || scanState === "clean") && result && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {scanState === "threat" ? (
                      <>
                        <Badge className="bg-red-600/90 hover:bg-red-600">
                          <ShieldAlert className="mr-1 h-3 w-3" />
                          Injection Detected
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-red-800 text-red-300"
                        >
                          Prompt Injection Risk
                        </Badge>
                      </>
                    ) : (
                      <Badge className="bg-emerald-700/90 hover:bg-emerald-700">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        No Threats Found
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Risk Score
                      </p>
                      <p
                        className={`font-mono text-3xl font-bold ${
                          scanState === "threat"
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {result.riskScore}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Confidence
                      </p>
                      <p className="font-mono text-3xl font-bold text-zinc-200">
                        {Math.round(result.confidence * 100)}%
                      </p>
                    </div>
                  </div>

                  {result.attackType && (
                    <div>
                      <p className="text-xs text-zinc-500">Attack type</p>
                      <p className="text-sm font-medium text-red-300">
                        {result.attackType}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">
                      Detection: {result.detectionMethod}
                    </Badge>
                    {result.llmUsed && (
                      <Badge variant="outline" className="border-violet-800 text-violet-300 text-[10px]">
                        LLM analyzed
                      </Badge>
                    )}
                    {result.ocrUsed && (
                      <Badge variant="outline" className="border-amber-800 text-amber-300 text-[10px]">
                        OCR layer
                      </Badge>
                    )}
                    {result.obfuscationDetected && (
                      <Badge variant="outline" className="border-orange-800 text-orange-300 text-[10px]">
                        White-cover signal
                      </Badge>
                    )}
                  </div>

                  {result.obfuscationSummary && (
                    <div className="rounded-lg border border-orange-900/40 bg-orange-950/20 p-3">
                      <p className="text-xs font-medium text-orange-300">
                        Visual obfuscation
                      </p>
                      <p className="text-sm text-orange-100/90">
                        {result.obfuscationSummary}
                      </p>
                    </div>
                  )}

                  {result.layers.length > 0 && (
                    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-2">
                      <p className="mb-1 text-[10px] uppercase text-zinc-500">
                        Extraction layers
                      </p>
                      {result.layers.map((layer, i) => (
                        <p key={i} className="font-mono text-[10px] text-zinc-500">
                          {layer.label} ({layer.source})
                        </p>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-zinc-500">Threat summary</p>
                    <p className="text-sm text-zinc-300">{result.summary}</p>
                  </div>

                  {result.threats.length > 0 && (
                    <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-3">
                      <p className="mb-1 text-xs font-medium text-red-400">
                        Matched injection
                      </p>
                      <p className="font-mono text-sm text-red-200">
                        &ldquo;{result.threats[0].text}&rdquo;
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs text-zinc-500">Sanitized output</p>
                      {scanState === "threat" && (
                        <Badge
                          variant="outline"
                          className="border-emerald-800 text-emerald-400 text-[10px]"
                        >
                          Safe for LLM consumption
                        </Badge>
                      )}
                    </div>
                    <ScrollArea className="h-[140px] rounded-md border border-zinc-800 bg-black/40 p-3 font-mono text-[11px] text-zinc-400">
                      {result.sanitized.slice(0, 1500)}
                      {result.sanitized.length > 1500 ? "…" : ""}
                    </ScrollArea>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-600">
          Before antivirus protected computers.{" "}
          <span className="text-zinc-400">Blacklight protects AI.</span>
        </p>
      </main>
    </div>
  );
}
