# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A toolset to draft, edit, and publish **SUMO Knowledge Base articles** (support.mozilla.org) using **Google Docs** as a staging/collaboration surface. SUMO is the source of truth; Google Docs is for drafting and review only. Primary users are the Thunderbird support team + trusted community contributors.

Read [`docs/DECISIONS.md`](docs/DECISIONS.md) first — it is the canonical record of goals, scope, discovery findings, and every architectural decision (Dn). Keep it updated as decisions are made; do not let the code drift from it.

## Working style (agreed with the project owner)

- Build in **small agile buckets, one at a time**. For each bucket: present a plan, then stop at a **checkpoint** for review before moving on.
- **Verify key decisions explicitly** to avoid drift from the original intent.

## Hard constraints from discovery (Bucket 0)

These shape the whole architecture — see DECISIONS.md for detail:

- **Read** SUMO via `GET https://support.mozilla.org/api/1/kb/<slug>` → JSON; the body comes back as **rendered HTML, not wiki source**. The host is behind a **bot challenge**: plain HTTP and *headless* Chromium are blocked (CAPTCHA), so reads go through a **headed Playwright browser** (`src/browser.ts`, D7). A Chromium window opens briefly on each fetch.
- There is **no write API** for KB articles. Publishing is **semi-automated**: the tool produces paste-ready **WikiMarkup** and a human pastes it into the SUMO edit form.
- SUMO articles are authored in **WikiMarkup** (`'''bold'''`, `== heading ==`, `{for win,mac}`, `{note}`, templates) — see https://support.mozilla.org/en-US/kb/markup-chart. HTML↔WikiMarkup conversion is a central concern.
- **Editing existing articles:** primary path is the editor pasting the real WikiMarkup source; reconstructing from API HTML is a lossy fallback.

## Stack & commands

TypeScript + Node.js (ESM, `NodeNext`). Official SDKs: `googleapis` (Docs/Drive), and `@anthropic-ai/sdk` (Claude) for later LLM buckets.

```bash
npm install
npm run dev -- <command>   # run CLI from source via tsx
npm run typecheck          # tsc --noEmit
npm run build              # compile to dist/
npm run fetch -- <slug>    # Bucket 1: fetch a SUMO article into a Google Doc
```

Note: ESM + `NodeNext` means relative imports must use `.js` extensions (e.g. `import { x } from "./sumo.js"`) even though the source is `.ts`.

## Layout

- `src/index.ts` — CLI entry (commander).
- `src/sumo.ts` — read-only SUMO KB API client.
- `src/browser.ts` — headed Playwright `fetchJson` (gets past the SUMO bot wall).
- `src/google/auth.ts` — Google OAuth desktop flow; caches token (+ granted scopes) in `token.json`; auto re-consents when required scopes change.
- `src/google/drive.ts` — create Docs by importing HTML (used by `fetch` only; lossy for lists).
- `src/google/docs.ts` — read a Doc's structured content via the Docs API.
- `src/google/docsCreate.ts` — build a Doc programmatically via Docs API `batchUpdate` (used by `import-source`; preserves list numbering — D11).
- `src/wikimarkup/toHtml.ts` — WikiMarkup → HTML ("readable + protected tokens", D9).
- `src/wikimarkup/docModel.ts` — parse that HTML into a block/run model (cheerio) for the Docs API builder.
- `src/wikimarkup/fromDoc.ts` — Docs API document → WikiMarkup (reverse of toHtml; protected tokens are highlighted runs emitted verbatim).
- `src/constants.ts` — `CONTENT_MARKER` boundary line separating metadata header from article body.
- `src/stageDoc.ts` — shared WikiMarkup → Google Doc stage (used by `import-source` and `draft`).
- `src/html.ts` — HTML → readable text (style corpus, `.html`/web-page sources).
- `src/sources.ts` — load/normalize `draft` sources (text + Claude-native PDF/image blocks).
- `src/prompts.ts` — load the style corpus + build the generation system prompt.
- `src/anthropic/draft.ts` — Claude call (Opus 4.8, adaptive thinking, streamed).
- `src/existing.ts` — load an existing article's WikiMarkup (`.wiki` file / Google Doc → to-markup / SUMO slug-URL → rendered text) for `revise`/`publish`.
- `src/output.ts` — shared emit (Doc / file / stdout) + `deriveTitle`/`printReport`.
- `src/clipboard.ts` — clipboard copy + open-in-browser for `publish`.
- `src/commands/` — one file per CLI command (`fetch`, `import-source`, `to-markup`, `build-style`, `draft`, `revise`, `publish`).
- `prompts/sumo-style/` — compiled SUMO style corpus (regenerate with `build-style`).
- `samples/` — `.wiki` fixtures (incl. `real.wiki`) for testing the converters.

## Generation (Bucket 4)

`draft` outputs WikiMarkup (D12) via Claude **Opus 4.8** (`claude-opus-4-8`, adaptive thinking, streamed; `@anthropic-ai/sdk`) and feeds it through the same `import-source` pipeline. On-style via the compiled SUMO style corpus (D14). Needs `ANTHROPIC_API_KEY`. Drafts are review-first: uncertainties become `{note}TODO{/note}` / `[[Image:PLACEHOLDER]]` (D15).

## Secrets

`credentials.json` (OAuth client) and `token.json` (cached token) live in the repo root and are gitignored. Never commit them.
