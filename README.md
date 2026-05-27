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

Open [http://localhost:3000](http://localhost:3000) and scroll to **Live scanner**.

## Demo samples

| Button | Purpose |
|--------|---------|
| **Try Malicious Invoice** | Hidden injection in document text |
| **Try Clean Resume** | Benign baseline (no threat) |
| **Try OCR Screenshot** | Image-style injection path |

## API

`POST /api/scan`

**FormData fields:**

- `file` — uploaded document (PDF, TXT, PNG, JPG, WebP)
- `sampleId` — one of `malicious-invoice`, `clean-resume`, `malicious-screenshot`

**Response:** `status`, `riskScore`, `confidence`, `threats`, `extractedPreview`, `sanitized`, `logs`, and layer metadata.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Enables LLM analysis layer |
| `OPENAI_MODEL` | Optional — defaults to `gpt-4o-mini` |

Without `OPENAI_API_KEY`, scans run on **regex + extraction/OCR** only.

## Tech stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · pdf-parse · Tesseract.js · Sharp · OpenAI SDK
