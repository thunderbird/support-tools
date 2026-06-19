# Decisions Log

ADR-style log of decisions for the SUMO KB authoring tool. Newest context at the top of each section. "Confirmed" = agreed with the project owner; "Proposed" = awaiting confirmation.

## ⏯️ Resume here (updated 2026-06-18)

**Done & committed:** Buckets 0–4 + `revise` + `publish` (Bucket 6). `draft` validated live by the owner (on-style; app-menu house rule applied). Everything else compiles and is offline-verified (dry-runs, URL construction); the items below need a live API key / browser / SUMO login, so they could not be auto-verified.

**🔲 LIVE-RUN TODOs (owner — do next, e.g. tomorrow). Requires `export ANTHROPIC_API_KEY=...` for 1 & 3.**

1. **`revise`** — run:
   ```bash
   npm run dev -- revise https://support.mozilla.org/en-US/kb/thunderbird-desktop-and-thundermail \
     --instruction "add a short troubleshooting section; use the app menu for menu steps" --out /tmp/revised.wiki
   ```
   Check: full revised article; correct content preserved; menu steps use `{menu ☰}`; unknowns flagged as `{note}TODO`. (For full fidelity pass real `.wiki` source, not a slug — D3.) Also try `--doc`.

2. **`publish`** — run:
   ```bash
   npm run dev -- publish /tmp/revised.wiki --slug thunderbird-desktop-and-thundermail
   ```
   Check: WikiMarkup copied to clipboard; SUMO edit page opens; paste works. Try `--new` for a new article. (Manual submit by design — D2.)

3. **Full loop (optional)** — `draft "..." --doc` → edit in Google Docs → `to-markup <doc-url> --out x.wiki` → `publish x.wiki --slug ...`.

After running, note any prompt/style tweaks (e.g. add house rules to `prompts/thunderbird-conventions.md`).

**Later:** Bucket 7 (style checker across the KB). Bucket 5 convert-path is largely covered by `draft --source`.

## Project intent

- **Goal:** Reduce the effort/time for the Thunderbird support team and trusted community contributors to get a **publish-ready KB article into SUMO** (support.mozilla.org) — for both **new articles** and **edits to existing ones**.
- **Core decision the tool supports:** *"Is this article publish-ready and on-style for SUMO?"*
- **On-style consistency** across all Thunderbird KB articles is an explicit success criterion.
- **Users:** Thunderbird support staff + trusted community contributors (shared tool, not fully public/anonymous).
- **Source of truth:** SUMO is canonical. Google Docs is a **staging / collaboration / drafting** surface only — never the canonical copy.
- **Pipeline:** generate drafts → convert existing content → create new / edit existing → review in Docs → publish/sync to SUMO.

## Bucket 0 — Discovery findings (verified 2026-06-17)

- **Read API:** `GET https://support.mozilla.org/api/1/kb/<slug>` returns JSON with `id`, `title`, `slug`, `url`, `locale`, `products`, `topics`, `summary`, and `html` (rendered body). The API returns **rendered HTML, not wiki source.**
- **BOT-PROTECTION BLOCKER (found in Bucket 1, 2026-06-17):** the API host is behind a **"Client Challenge" JS/TLS-fingerprint bot wall**. Plain HTTP clients (`curl`, Node `fetch`) consistently get a challenge HTML page (200, `text/html`) instead of JSON — even with full browser headers. Only a real browser engine (or an allowlisted fetcher) solves it. **Open question O1 below.**
- **No write API:** The official Kitsune API is read-only — no create/update/delete for KB articles. Editing is only via the web UI (`/<locale>/kb/<slug>/edit`, requires login + CSRF + KB-editor/reviewer permissions). Scripting that form is possible but brittle (last resort).
- **Authoring format is WikiMarkup**, not HTML (`'''bold'''`, `== heading ==`, `[[Image:...]]`, `{for win,mac}`, `{note}`, `{warning}`, `{key}`, templates). Reference: https://support.mozilla.org/en-US/kb/markup-chart
- **Asymmetric round-trip:** inbound = easy (API gives HTML → import to Doc). Outbound = hard (must become WikiMarkup pasted by a human). API HTML has already stripped/expanded `{for}` blocks, notes, and template includes, so reconstructing source from it is **lossy**.
- **Google Docs:** Drive API converts uploaded HTML → native Doc on import; Docs export back to HTML. Auth via OAuth or service account.

## Confirmed decisions

- **D1 — Discovery first.** Start with a Bucket 0 discovery spike before pipeline code. *(Confirmed)*
- **D2 — Publishing is semi-automated.** Tool produces paste-ready WikiMarkup; a human pastes it into the SUMO edit form. No one-click publish (forced by the missing write API). *(Confirmed)*
- **D3 — Editing existing articles:** PRIMARY path = editor pastes the real WikiMarkup source (copied from SUMO's edit view) to preserve `{for}`/templates with full fidelity. FALLBACK path = reconstruct from the API's HTML (lossy). *(Confirmed)*
- **D4 — Tech stack: TypeScript + Node.js.** Rationale: one language from CLI now to a web app later (real users are non-developers); first-class official SDKs (`googleapis`, `@anthropic-ai/sdk`); strong HTML/markup tooling for the central HTML↔WikiMarkup conversion. Replaced the Python `.gitignore` with a Node one. *(Confirmed 2026-06-17)*
- **D5 — LLM provider: Claude (Anthropic).** Default for all generation/rewriting/style work. *(Confirmed — default)*
- **D6 — Auth for Bucket 1: Google OAuth desktop flow, single user.** Token cached locally in `token.json`. Bucket 1 requests only the least-privilege `drive.file` scope (create/access files the app creates). The shared staff+contributor auth model (service account / shared Drive, and OAuth app verification for >7-day tokens / >100 users) is deferred to a later bucket. *(Confirmed)*
- **D8 — Build the inbound converter first** (WikiMarkup source → editable Google Doc), before the outbound one. Rationale: editing existing articles is the project owner's most common case. *(Confirmed 2026-06-17)*
- **D11 — `import-source` builds the Doc via the Docs API, not HTML import.** Drive's HTML import destroys the ordered/bulleted list distinction (O4). Pipeline: WikiMarkup → HTML (`toHtml`) → block model (`docModel.ts`, cheerio) → `documents.batchUpdate` (`docsCreate.ts`) with heading styles, `NUMBERED_*`/`BULLET_*` presets, and bold/italic/highlight by range. List nesting via leading tabs; bullet requests applied last in reverse doc order to survive tab-stripping. Needs the full `documents` (write) scope. `fetch` still uses HTML import (lossy (a) path). *(Confirmed 2026-06-18; validated offline against `real.wiki` — 6 ordered + 16 unordered items, correct presets; live round-trip pending.)*
- **D10 — Reverse trip reads the Doc via the Docs API** (`documents.get` structured JSON), not Drive HTML export — more reliable to reverse. Adds the `documents.readonly` scope (auth auto-re-consents). Protected tokens are detected as highlighted (`backgroundColor`) runs and emitted verbatim; a `CONTENT_MARKER` line separates the metadata header from the body. *(Confirmed 2026-06-17; reverse converter unit-tested offline, live round-trip pending.)*
- **D9 — Fidelity strategy: "Readable + protected tokens".** Reversible constructs (headings, bold, italic, lists, code, blockquote, external links) render to real Google Docs formatting. Irreversible / wiki-specific constructs (`{for}`, `{note}`, `{warning}`, `{key}`/`{menu}`/`{button}`/`{filepath}`/`{pref}`, `[[Image:...]]`, templates, internal `[[links]]`, tables) are preserved **verbatim as visually-marked protected tokens** so the round-trip never loses them. Guiding rule: never transform anything we can't reverse exactly. *(Confirmed 2026-06-17)*
- **D7 — Reads go through a headed Playwright Chromium.** The SUMO API host is behind a bot challenge: plain HTTP gets a JS challenge, and *headless* Chromium gets an image CAPTCHA. A *headed* browser passes cleanly and returns JSON. So `src/browser.ts` launches headed by default (`SUMO_HEADLESS=1` to override). Same engine will drive the later semi-automated publish path. Trade-off tracked in O2. *(Confirmed 2026-06-17, verified live against `thunderbird-desktop-and-thundermail`.)*

## Open questions

- **O4 — Ordered lists round-trip as unordered.** Live round-trip (2026-06-17) of `real.wiki` was semantically faithful (all protected tokens, headings, bold/italic preserved); only bug: `#` numbered lists came back as `*`. ROOT CAUSE (from `--debug-lists`): Google Drive's HTML importer discarded the `<ol>`/`<ul>` distinction — every list imported as `glyphType: GLYPH_TYPE_UNSPECIFIED`, so the info was lost at *import*, not export. Attempted fix (explicit `list-style-type:decimal/disc` + `type="1"` on `<ol>`/`<ul>`) DID NOT WORK — re-import still yields `GLYPH_TYPE_UNSPECIFIED` (confirmed 2026-06-17). CONCLUSION: Drive's HTML→Docs import cannot preserve ordered-vs-bulleted lists at all. Resolution → D11 (build the Doc via the Docs API instead of HTML import). RESOLVED 2026-06-18: live round-trip via Docs API construction preserves `#`/`*` correctly, and also fixed the double-space collapse (direct text insertion, no HTML normalization). Remaining diffs are cosmetic (extra blank lines + trailing whitespace), accepted.

- **O5 — RESOLVED (2026-06-18).** Bare single newlines were becoming `<br>`. Per project owner, Kitsune joins a single newline into flowing text, so `toHtml` now joins consecutive paragraph lines with a SPACE (not `<br>`); blank-line-separated paragraphs stay separate; explicit `<br>` tags in source are preserved. Numbered steps and bullets confirmed rendering correctly in the Doc.

- **O1 — RESOLVED → D7.** Chosen: headless browser (Playwright). Still worth pursuing (b) an official/allowlisted SUMO API path with the SUMO team as a longer-term simplification.

- **O3 — Real-article parser hardening.** *Validated against one real article (`thunderbird main window`, 2026-06-17).* Conversion was highly faithful (59 tokens preserved). Two gaps found and fixed: `__TOC__` magic word (now `magic-word` token) and leading `;`/`:` definition-list/indent markers (now `indent` token). Still only one real article — more will surface more (tables to render, `<nowiki>`, etc.). Keep `real.wiki` as a regression fixture.

- **O2 — Server/web deployment of the browser fetch.** D7 requires *headed* Chromium today (headless is CAPTCHA-walled). A future web-app backend has no display, so it will need xvfb, a stealth/anti-detection layer, or an allowlisted API (O1b). Revisit at the web-app bucket.

## Bucket 4 — Generation design (decided 2026-06-18)

- **D12 — Generation outputs WikiMarkup**, fed through the existing `import-source` pipeline (→ Doc) so drafts round-trip and reuse Buckets 2–3. Claude emits SUMO WikiMarkup directly.
- **D13 — Model: Claude Opus 4.8 (`claude-opus-4-8`)** via the official `@anthropic-ai/sdk`, `thinking: {type:"adaptive"}`, **streamed** (`.stream()`/`.finalMessage()`). Configurable via flag. Requires `ANTHROPIC_API_KEY`. Cache the (stable) style-guide system prompt so repeated drafts are cheap.
- **D14 — On-style via SUMO's OWN style articles, compiled — not hand-drafted.** Source of truth = `support.mozilla.org/en-US/kb/improve-knowledge-base` + every article it links to under `/en-US/kb/`. A `build-style` command discovers those links dynamically (fetch root → parse `/en-US/kb/` hrefs → fetch each via the existing `fetch` path → cheerio text) and compiles them into `prompts/sumo-style/` (committed, refreshable). This corpus also supplies the WikiMarkup syntax rules (it includes markup-chart, markup-cheat-sheet, how-to-use-for, using-templates). Currently 13 linked articles: anatomy-of-a-knowledge-base-article, create-new-knowledge-base-article, edit-knowledge-base-article, markup-cheat-sheet, about-knowledge-base, writing-guide-knowledge-base-articles, article-metadata, when-and-how-to-use-keywords, how-to-make-screenshots, how-place-images-article, markup-chart, how-to-use-for, using-templates. `access-mozilla-services-firefox-account` is also linked but EXCLUDED (a product article, not writing guidance) via an exclusion set in `build-style`.
- **D15 — Accuracy guardrails:** ground claims in `--source` material; do NOT invent UI specifics; mark uncertainties as visible `{note}` TODOs and `[[Image:PLACEHOLDER]]`; human review in the Doc makes it publish-ready (matches the core decision).
- **D16 — `--source` is repeatable and mixed-type.** v1 supports ALL of: local `.txt`/`.md`/`.wiki`/`.html` (→ text; HTML stripped via cheerio), local `.pdf` (Claude-native document block), local images `.png`/`.jpg`/`.jpeg`/`.gif`/`.webp` (Claude-native vision), SUMO articles by slug/URL (reuse `fetch` → rendered text), and generic web pages by URL (Playwright → text). Detection by `http(s)://` prefix (SUMO host → KB article path) else file extension; unknown types error clearly. For reference articles, `.wiki` source is preferred over a slug/URL's rendered text (D3 fidelity tradeoff). **Source role split (added 2026-06-18 after first draft reproduced its source article):** `--source` = facts to ground in (synthesized, not invented beyond); `--reference` = existing articles for style/structure/terminology/cross-links, explicitly NEVER copied. The system prompt names both roles and forbids verbatim reproduction of any input.
- **Scope:** `build-style` + `draft` (new articles) this bucket; `revise <existing>` (to-markup an article → feed to Claude with an instruction) is a composing follow-on.

## Bucket roadmap

| # | Bucket | Value |
|---|--------|-------|
| 0 | Discovery spike | De-risk the plan *(done)* |
| 1 | Read path: slug → Google Doc | First workflow + Google auth plumbing; fallback (a) edit path *(done — verified live 2026-06-17)* |
| 2 | **Inbound converter: WikiMarkup source → editable Google Doc** (high-fidelity (b) edit path) | Editing existing articles — the most common case *(done — validated on synthetic sample 2026-06-17; real-article hardening pending, O3)* |
| 3 | Outbound converter: Google Doc → paste-ready WikiMarkup | Closes the semi-automated publish loop *(DONE 2026-06-18 — faithful round-trip validated live on real.wiki: lists, headings, bold/italic, protected tokens all preserved; only cosmetic blank-line/whitespace diffs)* |
| 4 | Generation (Claude drafts on-style into a Doc) | Core time-saver *(built 2026-06-18 — `build-style` + `draft`; offline-verified, live API run pending owner's key)* |
| 5 | Convert path (threads/release notes → KB draft) | Broaden inputs — *largely subsumed by `draft --source` (D16)* |
| 6 | Publish/sync (open SUMO edit page with paste-ready WikiMarkup) | Close the loop *(built 2026-06-18 — `publish` copies WikiMarkup + opens edit page; manual submit per D2)* |
| 7 | Style checker across the KB | Sustain consistency |
| — | `revise <existing>` (edit existing per instruction) | *(built 2026-06-18 — composes existing-loader + generation + emit)* |

## Bucket 1 — Scope

- **CLI:** `fetch <slug> [--locale en-US]`
- Fetch article JSON from the read API; create a Google Doc from its HTML (Drive import-conversion); prepend a traceability header (slug, SUMO URL, locale, fetched date); print the Doc URL.
- **Out of scope:** WikiMarkup conversion, paste-source path, LLM generation, publishing, style checking, multi-user auth.
- **Checkpoint:** run `fetch` on a real slug, open the resulting Doc, confirm clean editable content.
