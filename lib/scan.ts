import {
  classifyAttack,
  confidenceFromThreats,
  riskFromThreats,
} from "./scoring";
import type { Severity, ThreatMatch } from "./types";

type InjectionPattern = { pattern: RegExp; label: string; severity: Severity };

const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    pattern: /ignore\s+(all\s+)?previous\s+instructions?/gi,
    label: "ignore_previous_instructions",
    severity: "critical",
  },
  {
    pattern: /disregard\s+(all\s+)?prior\s+instructions?/gi,
    label: "disregard_prior",
    severity: "critical",
  },
  {
    pattern: /forget\s+(everything|all\s+previous|your\s+instructions)/gi,
    label: "forget_context",
    severity: "high",
  },
  {
    pattern: /(?:^|\b)new\s+instructions?\s*[:\-]/gi,
    label: "new_instructions",
    severity: "high",
  },
  { pattern: /system\s+prompt/gi, label: "system_prompt", severity: "high" },
  { pattern: /developer\s+message/gi, label: "developer_message", severity: "high" },
  {
    pattern: /reveal\s+(the\s+)?(system\s+)?prompt/gi,
    label: "reveal_prompt",
    severity: "high",
  },
  {
    pattern: /(print|output|repeat|show)\s+(your\s+|the\s+)?(system\s+)?(prompt|instructions)/gi,
    label: "print_prompt",
    severity: "high",
  },
  {
    pattern: /reveal\s+customer\s+data/gi,
    label: "data_exfiltration",
    severity: "critical",
  },
  { pattern: /exfiltrat/gi, label: "exfiltration", severity: "high" },
  { pattern: /hidden\s+instruction/gi, label: "hidden_instruction", severity: "high" },
  {
    pattern: /leak\s+(customer|user|secret)/gi,
    label: "data_leak",
    severity: "critical",
  },
  {
    pattern: /summarize\s+this\s+as\s+safe/gi,
    label: "jailbreak_summarize",
    severity: "medium",
  },
  { pattern: /you\s+are\s+now\s+/gi, label: "role_override", severity: "high" },
  {
    pattern: /do\s+not\s+follow\s+(your|the)\s+/gi,
    label: "instruction_override",
    severity: "high",
  },
  {
    pattern: /\b(do\s+anything\s+now|DAN\s+mode)\b/gi,
    label: "jailbreak_dan",
    severity: "high",
  },
  {
    pattern: /override\s+(the\s+)?(safety|content|security)\s+(polic\w+|filters?|rules?)/gi,
    label: "override_policy",
    severity: "critical",
  },
];

export function detectThreats(text: string): ThreatMatch[] {
  const threats: ThreatMatch[] = [];
  const seen = new Set<string>();

  for (const { pattern, label, severity } of INJECTION_PATTERNS) {
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
        severity,
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

  const idx = text.indexOf(q);
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
  const riskScore = riskFromThreats(threats);
  const confidence = confidenceFromThreats(threats);
  const attackType = classifyAttack(threats);

  const summary = hasThreat
    ? "Pattern-based detection found instructions targeting LLM behavior."
    : "No prompt injection patterns detected in extracted text.";

  return { hasThreat, riskScore, confidence, attackType, summary };
}
