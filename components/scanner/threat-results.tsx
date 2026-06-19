import type { CSSProperties } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScanResult } from "@/lib/types";
import { ScanTerminal } from "@/components/scanner/scan-terminal";

type ScanState = "idle" | "scanning" | "threat" | "clean";

type ThreatResultsProps = {
  scanState: ScanState;
  result: ScanResult | null;
  logs: string[];
};

export function ThreatResults({ scanState, result, logs }: ThreatResultsProps) {
  if (scanState === "idle") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
        <Shield className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Drop a file to start</p>
      </div>
    );
  }

  if (scanState === "scanning") {
    return <ScanTerminal logs={logs} />;
  }

  if (!result) return null;

  const isThreat = scanState === "threat";
  const risk = Math.max(0, Math.min(100, result.riskScore));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {isThreat ? (
          <>
            <Badge className="bg-red-600/90 hover:bg-red-600">
              <ShieldAlert className="mr-1 h-3 w-3" />
              Injection Detected
            </Badge>
            <Badge variant="outline" className="border-red-800 text-red-300">
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

      <div className="grid gap-3 sm:grid-cols-[132px_1fr_1fr]">
        <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div
            className="risk-ring flex h-24 w-24 items-center justify-center rounded-full"
            style={
              {
                "--risk": risk,
                "--ring-color": isThreat ? "rgb(248 113 113)" : "rgb(74 222 128)",
              } as CSSProperties
            }
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-950 text-xl font-semibold text-zinc-100">
              {risk}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Confidence
          </p>
          <p className="font-mono text-3xl font-bold text-zinc-200">
            {Math.round(result.confidence * 100)}%
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Detection
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-200">
            {result.detectionMethod.toUpperCase()}
          </p>
        </div>
      </div>

      {result.attackType && (
        <div>
          <p className="text-xs text-zinc-500">Attack type</p>
          <p className="text-sm font-medium text-red-300">{result.attackType}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
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

      <div>
        <p className="text-xs text-zinc-500">Threat summary</p>
        <p className="text-sm text-zinc-300">{result.summary}</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-zinc-500">Sanitized output</p>
          {isThreat && (
            <Badge variant="outline" className="border-emerald-800 text-emerald-400 text-[10px]">
              Safe for LLM consumption
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[140px] rounded-md border border-zinc-800 bg-black/40 p-3 font-mono text-[11px] text-zinc-400">
          {result.sanitized.slice(0, 1500)}
          {result.sanitized.length > 1500 ? "…" : ""}
        </ScrollArea>
      </div>

      <p className="border-t border-zinc-800/80 pt-3 text-[11px] leading-relaxed text-zinc-500">
        Automated heuristic + AI analysis. Results are advisory and may produce
        false positives or negatives — verify critical documents manually.
      </p>
    </div>
  );
}
