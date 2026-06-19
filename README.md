# Blacklight

**AI firewall for file uploads** — scan PDFs, images, and documents for hidden prompt injections before they reach LLMs.

> Antivirus protected computers. Blacklight protects what your AI reads.

## What it does

Teams upload invoices, resumes, screenshots, and docs into RAG pipelines and chat apps every day. Attackers can hide instructions inside those files — white-on-white text, PDF text layers, OCR-only content, or phrases like “ignore previous instructions.”

Blacklight extracts text through multiple layers, detects injection patterns, and returns a **risk score**, **threat evidence**, and **sanitized output** safe for model ingestion.

## Features

- **PDF text-layer extraction** — reads selectable text, including content under visual covers
- **OCR + obfuscation signals** — image and screenshot analysis with white-cover detection
- **Hybrid detection** — regex heuristics plus optional OpenAI semantic analysis
- **Live scanner UI** — upload or use demo samples with highlighted threats and scan logs
- **Sanitized output** — stripped text marked safe for RAG / chat workflows

## How detection works

1. **Extract** — PDF parsing, plain text, OCR (Tesseract.js), embedded PDF images
2. **Regex** — fast matching for known injection phrases
3. **LLM** — OpenAI classification for semantic / hidden instructions (optional)
4. **Merge** — combined threats, confidence, attack type, and sanitized text

## Quick start

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY for hybrid LLM analysis (optional)

npm install
node scripts/generate-samples.mjs
npm run dev
```

Open [https://blacklight-ai.vercel.app/](https://blacklight-ai.vercel.app/) and scroll to **Live scanner**.

## Demo samples

| Button                    | Purpose                           |
| ------------------------- | --------------------------------- |
| **Try Malicious Invoice** | Hidden injection in document text |
| **Try Clean Resume**      | Benign baseline (no threat)       |
| **Try OCR Screenshot**    | Image-style injection path        |

## API

`POST /api/scan` (`multipart/form-data`)

**Request — provide exactly one of:**

- `file` — uploaded document. Allowed: `.pdf`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, `.webp`. Max **10 MB**. Contents are sniffed (magic bytes) to confirm they match the extension.
- `sampleId` — one of `malicious-invoice`, `clean-resume`, `malicious-screenshot`.

Every response includes an `x-request-id` header for log correlation.

**Success (`200`):** a JSON `ScanResult` with `status` (`threat` | `clean`), `riskScore` (0–100), `confidence` (0–1), `attackType`, `summary`, `threats`, `extractedPreview`, `sanitized`, `detectionMethod`, `llmUsed`, `ocrUsed`, `layers`, `obfuscationDetected`, and `logs`.

**Error:** a stable envelope `{ "error": { "code", "message" }, "requestId" }`:

| Code | Status | Meaning |
| ---------------- | ------ | ----------------------------------------- |
| `INVALID_INPUT` | 400 | Missing/invalid `file` or `sampleId` |
| `UNSUPPORTED_TYPE` | 415 | Extension not allowed or bytes mismatch |
| `FILE_TOO_LARGE` | 413 | Upload exceeds the 10 MB limit |
| `NO_TEXT` | 422 | No extractable text in the document |
| `RATE_LIMITED` | 429 | Too many requests (see `Retry-After`) |
| `INTERNAL` | 500 | Unexpected server error |

**Rate limiting:** best-effort in-memory token bucket (~10 requests/min per client IP). On multi-instance/serverless deployments this is per-instance, not a global quota — back it with a shared store (Redis/Upstash) for hard enforcement.

**Lite mode:** on serverless (`VERCEL=1`) or when `BLACKLIGHT_LIGHT_SCAN=true`, extraction uses the PDF text layer plus a single fast OCR pass to stay within function limits. The **same document** is always scanned — only extraction depth changes.

## Environment variables

| Variable         | Purpose                              |
| ---------------- | ------------------------------------ |
| `OPENAI_API_KEY` | Enables LLM analysis layer           |
| `OPENAI_MODEL`   | Optional — defaults to `gpt-4o-mini` |

Without `OPENAI_API_KEY`, scans run on **regex + extraction/OCR** only.

## Tech stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · pdf-parse · Tesseract.js · Sharp · OpenAI SDK
