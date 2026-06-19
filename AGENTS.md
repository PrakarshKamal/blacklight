# Agent instructions

> How to use this file: each section below is a slot for a specific kind of context.
> Add or edit bullets as the project evolves. Keep entries short, concrete, and skimmable —
> these are rules an agent reads on every task, not prose. Lines in `<!-- comments -->`
> are prompts for you to fill in and can be deleted once answered.

## Project context

Blacklight is an "AI firewall" for file uploads: it scans PDFs, images, and documents for hidden
prompt injections before they reach an LLM, returning a risk score, threat evidence, and sanitized output.

Key directories:

- `app/` — Next.js App Router pages, layout, and routes. API lives in `app/api/scan/route.ts`.
- `lib/` — core scanning logic: `scan.ts`, `analyze.ts`, `extract.ts`, `ocr.ts`, `obfuscation.ts`, `llm.ts`, `types.ts`, `runtime.ts`, `utils.ts`.
- `components/ui/` — shadcn/ui primitives (buttons, cards, tabs, etc.).
- `components/marketing/` — landing-page sections.
- `components/scanner/` — the live scanner workspace UI.
- `public/samples/` — demo files (generated; see below).
- `scripts/` — build-time helpers, e.g. `generate-samples.mjs`.

<!-- Add: domain glossary, links to design docs, anything an agent should know before touching code. -->

## Tech stack & versions

- Next.js `16.2.6` (App Router) — read `node_modules/next/dist/docs/` before writing Next.js code.
- React `19.2.4`, TypeScript `^5` (strict mode), Tailwind CSS v4, shadcn/ui.
- OpenAI SDK (optional LLM layer), pdf-parse, Tesseract.js (OCR), Sharp (image processing).
- Path alias: `@/*` maps to the repo root (see `tsconfig.json`).

## Next.js Version Notes

This project uses a recent version of Next.js with App Router and APIs that may differ from older examples.

Before making changes:

- Check package.json for the installed version.
- Follow existing project patterns and conventions.
- Prefer official Next.js documentation for the installed version.
- Pay attention to deprecation warnings and TypeScript errors.

## Setup & commands

```bash
npm install
cp .env.example .env.local      # optional: add OPENAI_API_KEY for the LLM layer
node scripts/generate-samples.mjs
npm run dev                      # start dev server
npm run build                   # regenerates samples, then next build
npm run lint                    # eslint
```

- `OPENAI_API_KEY` is optional. Without it, scans run on regex + extraction/OCR only.
- Always run `npm run lint` after making edits.

## Code style

- TypeScript strict; no `any` unless unavoidable, and prefer types from `lib/types.ts`.
- Import via the `@/*` alias (e.g. `@/lib/scan`), not long relative paths.
- React: functional components with hooks; co-locate component-only helpers.
- Styling: Tailwind utility classes; compose conditional classes with `cn()` from `lib/utils.ts`.
- Follow existing shadcn/ui patterns when adding UI primitives.
- No narrating comments. Comments should explain non-obvious intent, not restate the code.

<!-- Add: naming conventions, file structure rules, formatting preferences specific to you. -->

## Guardrails

- Do NOT hand-edit `package-lock.json`; let the package manager manage it.
- Do NOT commit secrets. Keys belong in `.env.local` (gitignored), never in source.
- Generated assets in `public/samples/` come from `scripts/generate-samples.mjs` — regenerate, don't hand-edit.
- Treat file parsing/extraction in `lib/` as security-sensitive: validate inputs, fail closed.
- Ask before adding new dependencies or changing the public API of `POST /api/scan`.

<!-- Add: files/dirs that are off-limits, destructive actions to avoid, approval gates. -->

## Workflows

- **Add a detection layer:** implement extraction/analysis in `lib/`, wire it into `lib/scan.ts`, surface results through `app/api/scan/route.ts`, then render in `components/scanner/`.
- **Add a UI component:** prefer existing `components/ui/` primitives; new primitives follow shadcn/ui conventions and use `cn()` for class composition.
- **Change the scan API:** update the handler in `app/api/scan/route.ts`, keep `lib/types.ts` in sync, and update the API section in `README.md`.
- After any change: run `npm run lint` and verify the dev server compiles.

<!-- Add: step-by-step recipes for the tasks you ask for most often. -->

## Best practices

- Make small, focused changes; avoid unrelated refactors in the same edit.
- Verify changes (lint, build, or manual scan run) before declaring done.
- Keep `README.md` and this file in sync when behavior, commands, or structure change.
- Prefer editing existing files over creating new ones; don't add docs files unless asked.

<!-- Add: testing expectations, review checklist, definition of done. -->

## Adding new context (template)

Copy this block when introducing a new area of guidance:

```md
## <Topic>

- <Concrete rule or fact the agent should follow.>
- <Another rule. Keep it short and unambiguous.>
```
