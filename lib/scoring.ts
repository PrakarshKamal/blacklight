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
/** Risk for a document with no detected signals. */
export const CLEAN_RISK = 4;
/** Hard ceiling so we never report a misleading "100% certain" score. */
const MAX_RISK = 99;
/** Each additional signal beyond the strongest contributes weight * damping^i. */
const ADDITIONAL_SIGNAL_DAMPING = 0.45;

/** Confidence model: more independent signals (and LLM corroboration) raise it. */
const CONFIDENCE_BASE = 0.6;
const CONFIDENCE_PER_SIGNAL = 0.07;
const CONFIDENCE_LLM_BONUS = 0.1;
const CONFIDENCE_MIN = 0.5;
const CONFIDENCE_MAX = 0.98;
/** Confidence that a document is clean when nothing trips a signal. */
export const CLEAN_CONFIDENCE = 0.9;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function severityOf(threat: ThreatMatch): Severity {
  return threat.severity ?? "high";
}

/** Risk score (0-100) derived from the severities of all detected threats. */
export function riskFromThreats(threats: ThreatMatch[]): number {
  if (threats.length === 0) return CLEAN_RISK;

  const weights = threats
    .map((t) => SEVERITY_WEIGHT[severityOf(t)])
    .sort((a, b) => b - a);

  let score = BASE_THREAT_RISK + weights[0];
  for (let i = 1; i < weights.length; i++) {
    score += weights[i] * Math.pow(ADDITIONAL_SIGNAL_DAMPING, i);
  }
  return clamp(Math.round(score), CLEAN_RISK, MAX_RISK);
}

/** Confidence (0-1) in the verdict given signal count and LLM corroboration. */
export function confidenceFromThreats(
  threats: ThreatMatch[],
  llmCorroborated = false
): number {
  if (threats.length === 0) return CLEAN_CONFIDENCE;
  const raw =
    CONFIDENCE_BASE +
    threats.length * CONFIDENCE_PER_SIGNAL +
    (llmCorroborated ? CONFIDENCE_LLM_BONUS : 0);
  return clamp(Number(raw.toFixed(2)), CONFIDENCE_MIN, CONFIDENCE_MAX);
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
