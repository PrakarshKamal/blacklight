import type { ThreatMatch } from "./types";

const INJECTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /ignore\s+(all\s+)?previous\s+instructions?/gi,
    label: "ignore_previous_instructions",
  },
  { pattern: /disregard\s+(all\s+)?prior\s+instructions?/gi, label: "disregard_prior" },
  { pattern: /system\s+prompt/gi, label: "system_prompt" },
  { pattern: /developer\s+message/gi, label: "developer_message" },
  { pattern: /reveal\s+(the\s+)?(system\s+)?prompt/gi, label: "reveal_prompt" },
  { pattern: /reveal\s+customer\s+data/gi, label: "data_exfiltration" },
  { pattern: /exfiltrat/gi, label: "exfiltration" },
  { pattern: /hidden\s+instruction/gi, label: "hidden_instruction" },
  { pattern: /leak\s+(customer|user|secret)/gi, label: "data_leak" },
  { pattern: /summarize\s+this\s+as\s+safe/gi, label: "jailbreak_summarize" },
  { pattern: /you\s+are\s+now\s+/gi, label: "role_override" },
  { pattern: /do\s+not\s+follow\s+(your|the)\s+/gi, label: "instruction_override" },
];

export function detectThreats(text: string): ThreatMatch[] {
  const threats: ThreatMatch[] = [];
  const seen = new Set<string>();

  for (const { pattern, label } of INJECTION_PATTERNS) {
    const flags = pattern.flags;
    const global = flags.includes("g");
    const re = global
      ? pattern
      : new RegExp(pattern.source, flags + "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const key = `${match.index}:${match[0].toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      threats.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        pattern: label,
      });
    }
  }

  return threats.sort((a, b) => a.start - b.start);
}

/** Find quote in text (fuzzy: normalize whitespace) */
export function locateQuoteInText(
  text: string,
  quote: string
): ThreatMatch | null {
  const q = quote.trim();
  if (!q) return null;

  let idx = text.indexOf(q);
  if (idx !== -1) {
    return { text: q, start: idx, end: idx + q.length, pattern: "llm_evidence" };
  }

  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const nText = norm(text);
  const nQuote = norm(q);
  const nIdx = nText.indexOf(nQuote);
  if (nIdx === -1) return null;

  // Map back to approximate position in original
  let origIdx = 0;
  let normPos = 0;
  while (normPos < nIdx && origIdx < text.length) {
    if (/\s/.test(text[origIdx])) {
      while (origIdx < text.length && /\s/.test(text[origIdx])) origIdx++;
      normPos++;
    } else {
      origIdx++;
      normPos++;
    }
  }

  return {
    text: text.slice(origIdx, origIdx + q.length),
    start: origIdx,
    end: origIdx + q.length,
    pattern: "llm_evidence",
  };
}

export function mergeThreatLists(
  a: ThreatMatch[],
  b: ThreatMatch[]
): ThreatMatch[] {
  const merged = [...a];
  for (const t of b) {
    const overlap = merged.some(
      (m) =>
        Math.abs(m.start - t.start) < 20 ||
        m.text.toLowerCase() === t.text.toLowerCase()
    );
    if (!overlap) merged.push(t);
  }
  return merged.sort((x, y) => x.start - y.start);
}

export function sanitizeText(text: string, threats: ThreatMatch[]): string {
  if (threats.length === 0) return text;

  let result = text;
  const sorted = [...threats].sort((a, b) => b.start - a.start);

  for (const threat of sorted) {
    if (threat.start < 0 || threat.end > result.length) continue;
    const before = result.slice(0, threat.start);
    const after = result.slice(threat.end);
    result = before + "[REDACTED - prompt injection removed]" + after;
  }

  return result.replace(/\n{3,}/g, "\n\n").trim();
}

export function buildScanMetrics(threats: ThreatMatch[]) {
  const hasThreat = threats.length > 0;
  const riskScore = hasThreat
    ? Math.min(99, 65 + threats.length * 10 + Math.min(20, threats[0]?.text.length ?? 0))
    : 5;
  const confidence = hasThreat ? 0.82 + Math.min(0.12, threats.length * 0.03) : 0.9;

  let attackType: string | undefined;
  if (hasThreat) {
    const labels = new Set(threats.map((t) => t.pattern));
    if (labels.has("data_exfiltration") || labels.has("data_leak")) {
      attackType = "Prompt Injection / Data Exfiltration";
    } else if (labels.has("ignore_previous_instructions")) {
      attackType = "Direct Prompt Injection";
    } else if ([...labels].some((l) => l.startsWith("llm"))) {
      attackType = "LLM-Detected Instruction Override";
    } else {
      attackType = "LLM Instruction Override";
    }
  }

  const summary = hasThreat
    ? "Pattern-based detection found instructions targeting LLM behavior."
    : "No prompt injection patterns detected in extracted text.";

  return { hasThreat, riskScore, confidence, attackType, summary };
}
