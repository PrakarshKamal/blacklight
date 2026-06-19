import { describe, expect, it, vi } from "vitest";

// Enable the LLM layer and stub the model call so the test is deterministic.
vi.mock("@/lib/env", () => ({
  isLlmEnabled: () => true,
  env: { openAiApiKey: "test-key", openAiModel: "gpt-4o-mini", appUrl: "http://localhost:3000" },
}));

const { analyzeWithLlm } = vi.hoisted(() => ({ analyzeWithLlm: vi.fn() }));
vi.mock("@/lib/llm", () => ({ analyzeWithLlm }));

import { analyzeDocument } from "@/lib/analyze";
import type { ExtractionResult } from "@/lib/types";

function extraction(fullText: string): ExtractionResult {
  return {
    fullText,
    layers: [{ source: "plain_text", label: "Plain text", content: fullText }],
  };
}

/** A clean, text-rich document — high content-coverage credit. */
const TEXT_RICH = "This document describes our quarterly operations review. ".repeat(
  20
);

describe("analyzeDocument clean risk", () => {
  it("returns risk 0 for a clean document", async () => {
    analyzeWithLlm.mockResolvedValueOnce({
      threatDetected: false,
      riskScore: 0,
      confidence: 0.2,
      summary: "No prompt injection detected.",
      evidence: [],
    });

    const result = await analyzeDocument(extraction(TEXT_RICH), "clean.txt", []);

    expect(result.status).toBe("clean");
    expect(result.riskScore).toBe(0);
  });

  it("stays at 0 even when the LLM reports a low non-zero riskScore", async () => {
    // The model hovers near its clean floor (e.g. 8); we must not surface that
    // as residual risk — a clean verdict is exactly 0.
    analyzeWithLlm.mockResolvedValueOnce({
      threatDetected: false,
      riskScore: 8,
      confidence: 0.2,
      summary: "No prompt injection detected.",
      evidence: [],
    });

    const result = await analyzeDocument(extraction(TEXT_RICH), "clean.txt", []);

    expect(result.status).toBe("clean");
    expect(result.riskScore).toBe(0);
  });
});

describe("analyzeDocument confidence with LLM enabled", () => {
  it("stays high on a text-rich clean doc the LLM agrees on", async () => {
    analyzeWithLlm.mockResolvedValueOnce({
      threatDetected: false,
      riskScore: 0,
      confidence: 0.1,
      summary: "No prompt injection detected.",
      evidence: [],
    });

    const result = await analyzeDocument(extraction(TEXT_RICH), "resume.txt", []);

    expect(result.status).toBe("clean");
    expect(result.llmUsed).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("varies with how much text was analyzed (not a flat constant)", async () => {
    analyzeWithLlm
      .mockResolvedValueOnce({
        threatDetected: false,
        riskScore: 0,
        confidence: 0.2,
        summary: "No prompt injection detected.",
        evidence: [],
      })
      .mockResolvedValueOnce({
        threatDetected: false,
        riskScore: 0,
        confidence: 0.2,
        summary: "No prompt injection detected.",
        evidence: [],
      });

    const rich = await analyzeDocument(extraction(TEXT_RICH), "rich.txt", []);
    const sparse = await analyzeDocument(
      extraction("Short note."),
      "sparse.txt",
      []
    );

    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });

  it("uses the LLM verdict when it flags a threat regex missed", async () => {
    const quote = "the quarterly synergy alignment";
    analyzeWithLlm.mockResolvedValueOnce({
      threatDetected: true,
      riskScore: 80,
      confidence: 0.95,
      attackType: "Hidden instruction",
      summary: "Hidden instruction detected.",
      evidence: [{ quote, reason: "concealed directive" }],
    });

    const result = await analyzeDocument(
      extraction(`${TEXT_RICH} Please follow ${quote} before replying.`),
      "doc.txt",
      []
    );

    expect(result.status).toBe("threat");
    expect(result.riskScore).toBe(80);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});
