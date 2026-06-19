import type { Severity, ThreatMatch } from "./types";

/**
 * Risk scoring model.
 *
 * Risk is driven by the *severity* of detected signals rather than raw count,
 * so a single critical injection scores higher than several low-signal hits.
 * The highest-severity signal dominates; each additional distinct signal adds a
 * damped contribution (diminishing returns) to avoid runaway scores on noisy
 * documents. All weights live here so the model is auditable in one place.
 */

/** Points each severity contributes to the risk score (0-100 scale). */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 12,
  medium: 24,
  high: 38,
  critical: 52,
};

/** Risk floor once any threat is present, before severity weights are added. */
const BASE_THREAT_RISK = 35;
/** Hard ceiling so we never report a misleading "100% certain" score. */
const MAX_RISK = 99;
/** Each additional signal beyond the strongest contributes weight * damping^i. */
const ADDITIONAL_SIGNAL_DAMPING = 0.45;

/** Residual risk attributed to a sub-threshold footer-concealment signal. */
const FOOTER_CONCEALMENT_RESIDUAL = 8;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function severityOf(threat: ThreatMatch): Severity {
  return threat.severity ?? "high";
}

/** Risk score (0-100) derived from the severities of all detected threats. */
export function riskFromThreats(threats: ThreatMatch[]): number {
  if (threats.length === 0) return 0;

  const weights = threats
    .map((t) => SEVERITY_WEIGHT[severityOf(t)])
    .sort((a, b) => b - a);

  let score = BASE_THREAT_RISK + weights[0];
  for (let i = 1; i < weights.length; i++) {
    score += weights[i] * Math.pow(ADDITIONAL_SIGNAL_DAMPING, i);
  }
  return clamp(Math.round(score), 0, MAX_RISK);
}

/**
 * Residual risk for a document with no flagged threats. A clean verdict is
 * exactly 0 — we deliberately do NOT inherit the model's self-reported "low"
 * score (it just hovers around its clean floor and adds no real signal). Risk
 * rises above 0 only when a genuine soft signal fires, currently a
 * sub-threshold footer-concealment hint.
 */
export function cleanResidualRisk(
  soft: { footerConcealment?: boolean } = {}
): number {
  return soft.footerConcealment ? FOOTER_CONCEALMENT_RESIDUAL : 0;
}

/**
 * Confidence model. Confidence reflects how thoroughly we could examine the
 * document and how much corroboration the verdict has — not a fixed constant.
 */
export type ConfidenceSignals = {
  /** Number of distinct threat matches (0 for a clean verdict). */
  threatCount: number;
  /** Whether the LLM layer produced a second opinion. */
  llmUsed: boolean;
  /** Whether the LLM's verdict matched the final verdict. */
  llmAgreed: boolean;
  /** Total characters of text analyzed. */
  textLength: number;
  /** Number of distinct extraction layers examined (pages, OCR passes, etc.). */
  layerCount: number;
  /** Whether OCR was part of extraction. */
  ocrUsed: boolean;
  /** Characters recovered specifically via OCR. */
  ocrYield: number;
  /** Reduced-depth (serverless single-pass) extraction. */
  liteMode: boolean;
};

const CONF = {
  base: 0.55,
  /** A second opinion from the LLM. */
  llm: 0.15,
  /** Regex and LLM agree on the verdict. */
  agreement: 0.08,
  /**
   * Content coverage. A smooth, never-fully-saturating curve over how much
   * text we actually analyzed: `weight * (1 - e^(-len / scale))`. Unlike a
   * hard cap this keeps rising with length, so two clean docs of different
   * size land at different confidences instead of a shared constant.
   */
  contentWeight: 0.17,
  contentScale: 700,
  /** Breadth credit for analyzing multiple layers, with diminishing returns. */
  layerWeight: 0.04,
  layerScale: 3,
  /** Each corroborating threat signal (capped). */
  perThreat: 0.05,
  maxThreatBonus: 4,
  /** An image whose OCR recovered almost nothing may hide content. */
  ocrLowPenalty: 0.15,
  ocrLowThreshold: 40,
  /** Reduced extraction depth lowers certainty. */
  liteModePenalty: 0.07,
  min: 0.4,
  max: 0.97,
};

/** Diminishing-returns curve in [0, 1): 0 at x=0, approaching 1 as x grows. */
function saturating(x: number, scale: number): number {
  return 1 - Math.exp(-Math.max(0, x) / scale);
}

/** Confidence (0-1) in the verdict, derived from real per-scan coverage signals. */
export function computeConfidence(signals: ConfidenceSignals): number {
  let c = CONF.base;

  if (signals.llmUsed) c += CONF.llm;
  if (signals.llmAgreed) c += CONF.agreement;

  // How much content we examined and across how many layers — both vary per
  // document, so similar-but-not-identical files get distinct scores.
  c += CONF.contentWeight * saturating(signals.textLength, CONF.contentScale);
  c += CONF.layerWeight * saturating(signals.layerCount, CONF.layerScale);

  if (signals.threatCount > 0) {
    c += CONF.perThreat * Math.min(signals.threatCount, CONF.maxThreatBonus);
  }

  // An image we OCR'd but recovered almost no text from is a coverage gap:
  // hidden/low-contrast content may have been missed, so we are less certain.
  if (signals.ocrUsed && signals.ocrYield < CONF.ocrLowThreshold) {
    c -= CONF.ocrLowPenalty;
  }

  if (signals.liteMode) c -= CONF.liteModePenalty;

  return clamp(Number(c.toFixed(3)), CONF.min, CONF.max);
}

/** Human-readable attack classification from the matched pattern labels. */
export function classifyAttack(threats: ThreatMatch[]): string | undefined {
  if (threats.length === 0) return undefined;
  const labels = new Set(threats.map((t) => t.pattern));

  if (labels.has("data_exfiltration") || labels.has("data_leak")) {
    return "Prompt Injection / Data Exfiltration";
  }
  if (labels.has("override_policy")) {
    return "Safety Policy Override";
  }
  if (labels.has("ignore_previous_instructions") || labels.has("disregard_prior")) {
    return "Direct Prompt Injection";
  }
  if ([...labels].some((l) => l.startsWith("llm"))) {
    return "LLM-Detected Instruction Override";
  }
  return "Prompt Injection";
}

/** Risk floor applied when visual/PDF obfuscation is detected without other signals. */
export const OBFUSCATION_RISK_FLOOR = 58;
/** Confidence floor for an obfuscation-only finding. */
export const OBFUSCATION_CONFIDENCE_FLOOR = 0.72;
