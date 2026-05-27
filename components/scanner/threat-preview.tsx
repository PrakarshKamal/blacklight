import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScanResult } from "@/lib/types";

type ThreatPreviewProps = {
  result: ScanResult | null;
};

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

export function ThreatPreview({ result }: ThreatPreviewProps) {
  return (
    <ScrollArea className="h-[320px] rounded-md border border-zinc-800 bg-black/40 p-4 font-mono text-xs leading-relaxed text-zinc-400">
      {result ? (
        highlightThreats(result.extractedPreview, result)
      ) : (
        <span className="text-zinc-600">
          Document preview will appear here after scan…
        </span>
      )}
    </ScrollArea>
  );
}
