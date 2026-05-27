# Blacklight

AI firewall that scans uploaded files for hidden prompt injections before they reach LLMs.

## Detection pipeline

1. **Extract** — PDF text (`pdf-parse`), plain text, **OCR** on images (Tesseract.js) and embedded PDF images
2. **Regex** — Fast pattern matching for known injection phrases
3. **LLM** — OpenAI analysis for semantic / hidden instructions (requires API key)
4. **Merge** — Combined threats, risk score, and sanitized output (no hardcoded sample scores)

## Quick start

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY for full hybrid detection

npm install
node scripts/generate-samples.mjs
npm run dev
```

## Test samples

| Button | What it tests |
|--------|----------------|
| Malicious Invoice | PDF text extraction + regex/LLM |
| Clean Resume | False-positive baseline |
| OCR Screenshot | Image-only injection via Tesseract |

## API

`POST /api/scan` with `FormData`: `file` or `sampleId`

## Env

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Enables LLM layer (hybrid scoring) |
| `OPENAI_MODEL` | Optional, default `gpt-4o-mini` |

Without `OPENAI_API_KEY`, scans use **regex + OCR extraction only**.

## Deploy

```bash
npm run build
npx vercel --prod
```

Set `OPENAI_API_KEY` in Vercel project settings.
