import { isLlmEnabled } from "./env";
import { analyzeWithLlm } from "./llm";
import { logger, type Logger } from "./logger";
import {
  buildScanMetrics,
  detectThreats,
  locateQuoteInText,
  mergeThreatLists,
  sanitizeText,
} from "./scan";
import { OBFUSCATION_CONFIDENCE_FLOOR, OBFUSCATION_RISK_FLOOR } from "./scoring";
import type {
  ExtractionResult,
  LlmAnalysis,
  ScanResult,
  ThreatMatch,
} from "./types";

function threatsFromLlmEvidence(
  text: string,
  llm: LlmAnalysis
): ThreatMatch[] {
  const threats: ThreatMatch[] = [];

  for (const item of llm.evidence) {
    const located = locateQuoteInText(text, item.quote);
    if (located) {
      threats.push({
        ...located,
        pattern: `llm:${item.reason.slice(0, 40).replace(/\s+/g, "_")}`,
        severity: "high",
      });
    }
  }

  return threats;
}

function resolveMetrics(
  regexThreats: ThreatMatch[],
  llm: LlmAnalysis | null
) {
  const regexMetrics = buildScanMetrics(regexThreats);

  if (!llm) {
    return {
      ...regexMetrics,
      detectionMethod: "regex" as const,
      llmUsed: false,
    };
  }

  const hasThreat = regexMetrics.hasThreat || llm.threatDetected;
  const riskScore = hasThreat
    ? Math.max(regexMetrics.riskScore, llm.riskScore)
    : Math.min(regexMetrics.riskScore, llm.riskScore);

  const confidence = hasThreat
    ? Math.max(regexMetrics.confidence, llm.confidence)
    : (regexMetrics.confidence + llm.confidence) / 2;

  return {
    hasThreat,
    riskScore,
    confidence,
    attackType: llm.attackType ?? regexMetrics.attackType,
    summary: llm.summary || regexMetrics.summary,
    detectionMethod: regexThreats.length > 0 && llm.threatDetected
      ? ("hybrid" as const)
      : llm.threatDetected
        ? ("llm" as const)
        : regexThreats.length > 0
          ? ("hybrid" as const)
          : ("llm" as const),
    llmUsed: true,
  };
}

function applyObfuscationSuspicion(
  extraction: ExtractionResult,
  base: {
    hasThreat: boolean;
    riskScore: number;
    confidence: number;
    attackType?: string;
    summary: string;
  }
) {
  const obfuscation =
    extraction.obfuscation?.detected || extraction.pdfTextLayerLeak;
  if (!obfuscation) {
    return {
      ...base,
      obfuscationDetected: false,
      obfuscationSummary: undefined,
    };
  }

  const obfuscationSummary =
    extraction.pdfTextLayerLeak
      ? "PDF text layer contains content not visible in OCR — possible white-overlay concealment."
      : extraction.obfuscation?.description ??
        "Visual white-cover obfuscation detected.";

  if (base.hasThreat) {
    return {
      ...base,
      obfuscationDetected: true,
      obfuscationSummary,
      attackType: base.attackType ?? "Visual Obfuscation / Prompt Injection",
      summary: `${base.summary} ${obfuscationSummary}`,
    };
  }

  return {
    hasThreat: true,
    riskScore: Math.max(base.riskScore, OBFUSCATION_RISK_FLOOR),
    confidence: Math.max(base.confidence, OBFUSCATION_CONFIDENCE_FLOOR),
    attackType: "Visual Obfuscation (concealed region)",
    summary: `${obfuscationSummary} Content may be hidden under a white rectangle; review PDF text layer or source file.`,
    obfuscationDetected: true,
    obfuscationSummary,
  };
}

export async function analyzeDocument(
  extraction: ExtractionResult,
  fileName: string,
  logs: string[],
  log: Logger = logger
): Promise<ScanResult> {
  const { fullText, layers } = extraction;
  const ocrUsed = layers.some(
    (l) => l.source === "ocr_image" || l.source === "ocr_pdf_embedded"
  );

  if (extraction.obfuscation?.detected) {
    logs.push(
      `Obfuscation: white-cover signal (${extraction.obfuscation.coveragePercent}% near-white area)`
    );
  }
  if (extraction.pdfTextLayerLeak) {
    logs.push("Obfuscation: PDF text layer has hidden/extra text vs visible OCR");
  }

  logs.push(
    `Extracted ${fullText.length} chars from ${layers.length} layer(s)${
      ocrUsed ? " (OCR enabled)" : ""
    }`
  );

  const regexThreats = detectThreats(fullText);
  logs.push(
    regexThreats.length > 0
      ? `Regex: ${regexThreats.length} pattern match(es)`
      : "Regex: no pattern matches"
  );

  const layerSummary = layers
    .map((l) => `- ${l.label} (${l.source}): ${l.content.length} chars`)
    .join("\n");

  let llm: LlmAnalysis | null = null;
  if (isLlmEnabled()) {
    logs.push("Running LLM threat analysis…");
    llm = await analyzeWithLlm(fullText, layerSummary, log);
    if (llm) {
      logs.push(
        llm.threatDetected
          ? `LLM: threat detected (risk ${llm.riskScore})`
          : "LLM: no threat detected"
      );
    } else {
      logs.push("LLM: unavailable or timed out — using regex only");
    }
  } else {
    logs.push("LLM: skipped (set OPENAI_API_KEY for AI analysis)");
  }

  const llmThreats = llm ? threatsFromLlmEvidence(fullText, llm) : [];
  const threats = mergeThreatLists(regexThreats, llmThreats);

  const metrics = resolveMetrics(regexThreats, llm);
  let hasThreat =
    metrics.hasThreat || threats.length > 0 || (llm?.threatDetected ?? false);

  const withObfuscation = applyObfuscationSuspicion(extraction, {
    hasThreat,
    riskScore: metrics.riskScore,
    confidence: metrics.confidence,
    attackType: metrics.attackType,
    summary: metrics.summary,
  });

  hasThreat = withObfuscation.hasThreat;

  const status: ScanResult["status"] = hasThreat ? "threat" : "clean";
  const sanitized = hasThreat ? sanitizeText(fullText, threats) : fullText;

  let detectionMethod: ScanResult["detectionMethod"] = metrics.detectionMethod;
  if (ocrUsed && hasThreat && !metrics.llmUsed && regexThreats.length === 0) {
    detectionMethod = "ocr";
  } else if (ocrUsed && hasThreat) {
    detectionMethod = "hybrid";
  }
  if (withObfuscation.obfuscationDetected && hasThreat && !threats.length) {
    detectionMethod = "hybrid";
  }

  return {
    status,
    riskScore: withObfuscation.riskScore,
    confidence: withObfuscation.confidence,
    attackType: withObfuscation.attackType,
    summary: withObfuscation.summary,
    fileName,
    threats,
    extractedPreview: fullText.slice(0, 4000),
    sanitized,
    logs,
    detectionMethod,
    llmUsed: metrics.llmUsed,
    ocrUsed,
    layers,
    obfuscationDetected: withObfuscation.obfuscationDetected,
    obfuscationSummary: withObfuscation.obfuscationSummary,
  };
}
