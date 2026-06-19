export type Severity = "low" | "medium" | "high" | "critical";

export type ThreatMatch = {
  text: string;
  start: number;
  end: number;
  pattern: string;
  severity?: Severity;
};

export type ExtractionLayer = {
  source:
    | "pdf_text"
    | "plain_text"
    | "ocr_image"
    | "ocr_pdf_embedded"
    | "obfuscation_signal";
  label: string;
  content: string;
};

export type ObfuscationFinding = {
  detected: boolean;
  description: string;
  coveragePercent: number;
  footerConcealment: boolean;
};

export type ExtractionResult = {
  fullText: string;
  layers: ExtractionLayer[];
  obfuscation?: ObfuscationFinding;
  /** PDF text layer had substantially more than visible OCR (hidden text likely) */
  pdfTextLayerLeak?: boolean;
};

export type LlmAnalysis = {
  threatDetected: boolean;
  riskScore: number;
  confidence: number;
  attackType?: string;
  summary: string;
  evidence: { quote: string; reason: string }[];
};

export type ScanResult = {
  status: "threat" | "clean";
  riskScore: number;
  confidence: number;
  attackType?: string;
  summary: string;
  fileName: string;
  threats: ThreatMatch[];
  extractedPreview: string;
  sanitized: string;
  logs: string[];
  detectionMethod: "regex" | "hybrid" | "llm" | "ocr";
  llmUsed: boolean;
  ocrUsed: boolean;
  layers: ExtractionLayer[];
  obfuscationDetected?: boolean;
  obfuscationSummary?: string;
};

/** Stable error codes returned by POST /api/scan. */
export type ScanErrorCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_TYPE"
  | "FILE_TOO_LARGE"
  | "NO_TEXT"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ScanErrorResponse = {
  error: { code: ScanErrorCode; message: string };
  requestId: string;
};

/** Either a successful scan result or a structured error envelope. */
export type ScanApiResponse = ScanResult | ScanErrorResponse;
