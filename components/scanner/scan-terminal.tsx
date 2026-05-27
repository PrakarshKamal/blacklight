import { Terminal } from "lucide-react";

type ScanTerminalProps = {
  logs: string[];
};

export function ScanTerminal({ logs }: ScanTerminalProps) {
  return (
    <div className="rounded-md border border-zinc-800 bg-black/50 p-3 font-mono text-[11px] text-emerald-500/90">
      <div className="mb-2 flex items-center gap-2 text-zinc-500">
        <Terminal className="h-3.5 w-3.5" />
        blacklight scan
      </div>
      {logs.map((log, i) => (
        <div key={`${log}-${i}`} className="text-zinc-400">
          <span className="text-emerald-600">{">"}</span> {log}
        </div>
      ))}
      <div className="mt-1 animate-pulse text-zinc-600">_</div>
    </div>
  );
}
