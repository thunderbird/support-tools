# Decisions Log

ADR-style log of decisions for the SUMO KB authoring tool. Newest context at the top of each section. "Confirmed" = agreed with the project owner; "Proposed" = awaiting confirmation.

## ⏯️ Resume here (updated 2026-08-04)

### Filelink article — issue #230 (in progress)

The exact command. Paths contain a leading space in the directory name, so **keep the quotes**.

```bash
export ANTHROPIC_API_KEY=...   # required

# Local folder holding the article's .wiki plus its screenshots. Note the LEADING SPACE
# in the directory name — keep the quotes or the argument splits.
SHOTS="<your-screenshots-dir>/ modernize-filelink-article-for-thundmail-and-send-230"

npm run dev -- revise "$SHOTS/filelink-large-attachments.wiki" \
  -i "Apply every item in the checklist from the linked issue." \
  -s https://github.com/thunderbird/knowledgebase-issues/issues/230 \
  --images "$SHOTS" \
  --doc
```

`-m` is no longer needed — `claude-opus-5` is the default (D13).

**Before re-running, add a comment to issue #230 naming the replacement images**, e.g.
`Replace [[Image:Proton-FileLink-LargeFileNotification]] with [[Image:cropped-tb153-windows-11-offer-to-use-filelink]]`,
plus `Do not add image slots beyond these three.` Two reasons: the loader reads issue comments (D17), and
`--images` matches files to tokens **by filename** (D19) — the `[[Image:PLACEHOLDER - …]]` tokens the last run
produced match nothing, so name the tokens after the actual `.png` files in `$SHOTS`.

Then: review the Doc → upload the keepers to the SUMO gallery manually → `to-markup <doc-url> --out x.wiki`
→ `publish x.wiki --slug filelink-large-attachments`.

**Last run (before D19 existed):** https://docs.google.com/document/d/12VkSE2RZcsDg_WPY_zKRYHhG3EFEbmTlE7O0g7ht5Fc/edit
— all 6 checklist items applied, but 4 `[[Image:PLACEHOLDER]]` tokens and 1 `{note}TODO` (is
`Getting Started with Thunderbird Pro` / `Template:TBproEarlyBirdInviteOnly` renamed for Thundermail?) still
need resolving. It also invented a 4th image slot the issue didn't ask for.

### Queued (GitHub issues)

- **#2 — token palette in the Doc header + lint on `to-markup`** (next session). Protection is triggered by *any* background colour (`fromDoc.isProtected` = `!!backgroundColor`); Courier New is only a visual cue. Includes the "highlighting prose for review emits it raw" trap.
- **#3 — Docs add-on with a real markup dropdown** (nice-to-have, may never build).

### Earlier TODOs (updated 2026-06-18)

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
- **D19 — Local screenshots are embedded in the staged Doc via `--images <dir>`, matched to `[[Image:Name]]` tokens by filename.** So a reviewer sees the article *with* its visuals before anything is uploaded to SUMO. Mechanism (`src/images.ts`): Docs' `insertInlineImage` fetches a **public URI** — local bytes cannot be pushed — so upload to Drive (`drive.file`, already granted), share `anyone:reader`, insert, then **delete the Drive original**. Verified live 2026-08-04: Docs *copies* the bytes (`contentUri` becomes `googleusercontent/docsz/…`), so after deleting the Drive file all inline objects survive and the image still fetches `200 image/png`. Nothing stays publicly shared and no new scope/re-consent is needed. **Sizing:** 620px is SUMO's *maximum*, not a target — `width = min(natural, 620px)`, aspect preserved, natural size left alone below the cap (dimensions parsed from PNG/JPEG/GIF/WebP headers in-repo, no new dependency). **Applied as a SECOND `batchUpdate`** against the finished document rather than folded into `buildRequests`, so it reads real post-bullet indices and never interacts with the tab-stripping `createParagraphBullets` does (D11); insertions run in reverse document order. **Round-trip:** the token stays as the protected-text source of truth and the picture is review-only decoration — `fromDoc` reads only `textRun` elements, so images are dropped on `to-markup`, which is exactly right here (verified: output byte-identical). Matching is by normalized basename, and unmatched tokens / unused files are both reported as warnings. *(Confirmed 2026-08-04; verified live — narrow 310px image kept natural, wide image capped to 620px, missing token and 10 unused files warned, round-trip clean.)*
- **D18 — Consecutive prose paragraphs are separated by an empty Doc paragraph.** `docsCreate` terminated every block with a single `\n`, so two paragraphs became adjacent Doc paragraphs with no visible gap — the source's blank line was silently dropped, and long articles read as one wall of text in review. Fix: emit one empty paragraph between two consecutive `paragraph` blocks. Sound because `toHtml.flushPara` joins single newlines into one `<p>` (O5/Kitsune flowing text), so a `<p>` boundary normally means the source had a real blank line — the one exception is a token-only line (D20), which is excluded from this spacing. Deliberately **only** paragraph→paragraph: Docs heading styles carry their own `spaceAbove` (a blank there would double the gap), and a list following its intro line has no blank line in the source (adding one would change the round-trip). Round-trip is unaffected — `fromDoc` already collapses empty paragraphs and normalizes `\n{3,}`. *(Confirmed 2026-08-04, reported by the owner from a live `revise --doc` run. Verified: heading/bullet/text-style ranges all still map correctly across `real.wiki` (70 blocks) and `filelink-large-attachments.wiki` (52 blocks) — the real risk, since `createParagraphBullets` shifts indices; and `docToWikiMarkup` output is byte-identical.)*
- **D20 — A source line made up only of protected tokens gets its own Doc paragraph, and the Doc's blank lines now mirror the source exactly.** Kitsune flows single newlines into the surrounding prose (O5), so `__TOC__`, `[[UI:details_start]]`, `{for win}`, a lone `[[Image:…]]` etc. were joined onto the end of the preceding sentence — the reviewer saw `…please ignore this article.{/note} __TOC__ [[UI:details_start]]` as one run-on paragraph and could not see the article's structure. Fix, three layers: (1) `toHtml.parseBlocks` emits a token-only line as its own `<p>`; (2) every `<p>` that had **no blank line above it in the source** is marked `class="wiki-tight"` → `paragraph.tight` in the block model; (3) `docsCreate` skips the D18 spacer paragraph when the **next** paragraph is tight. Keying the gap on the *following* block is the precise rule — `tight` means "the source had no blank line here" — and it also keeps a real source blank line between two token lines (e.g. `[[UI:details_end]]` ⏎⏎ `[[UI:details_start]]`), which an "either side" rule silently dropped. Reverse trip matches: `fromDoc` emits a token-only paragraph with no blank line after it and pops the separator the previous paragraph added, so adjacency survives; an explicit empty Doc paragraph still becomes a blank line. Structural markers only — a token *inside* prose or a list item is untouched, and headings/lists are unaffected. *(Confirmed 2026-08-17, reported by the owner from a staged `custom OAuth configuration` draft. Verified live end-to-end: `{/note}` / `__TOC__` / `[[UI:details_start]]` land on three consecutive paragraphs, all 17 protected tokens still highlighted, and the `to-markup` round-trip reproduces every token line and blank line byte-for-byte.)*
- **D21 — A multi-line `<code>` block is PREFORMATTED on SUMO, so it is protected verbatim.** Kitsune keeps the newlines and indentation inside a `<code>` block spanning several lines (verified by the owner against the live rendered article — a 30-line `manifest.json` renders as an indented monospace block, *not* flowed). `toHtml` was applying the O5 flowing rule to it, collapsing the whole block onto one line and destroying the code — the Doc, and anything pasted back to SUMO from it, was wrong. Fix: protect `/<code>[^\n]*\n[\s\S]*?<\/code>/` verbatim as a `code-block` token before block parsing, exactly as whole wiki tables are (D9). Each of its lines becomes one highlighted-monospace Doc paragraph, tight (D20), so the block reads correctly in review and `fromDoc` reassembles it unchanged. **Single-line** `<code>…</code>` keeps its existing treatment (real monospace formatting, reversible). *(Confirmed 2026-08-17; verified live — the 34-line example manifest round-trips byte-identically, indentation included.)*
- **D10 — Reverse trip reads the Doc via the Docs API** (`documents.get` structured JSON), not Drive HTML export — more reliable to reverse. Adds the `documents.readonly` scope (auth auto-re-consents). Protected tokens are detected as highlighted (`backgroundColor`) runs and emitted verbatim; a `CONTENT_MARKER` line separates the metadata header from the body. *(Confirmed 2026-06-17; reverse converter unit-tested offline, live round-trip pending.)*
- **D9 — Fidelity strategy: "Readable + protected tokens".** Reversible constructs (headings, bold, italic, lists, code, blockquote, external links) render to real Google Docs formatting. Irreversible / wiki-specific constructs (`{for}`, `{note}`, `{warning}`, `{key}`/`{menu}`/`{button}`/`{filepath}`/`{pref}`, `[[Image:...]]`, templates, internal `[[links]]`, tables) are preserved **verbatim as visually-marked protected tokens** so the round-trip never loses them. Guiding rule: never transform anything we can't reverse exactly. *(Confirmed 2026-06-17)*
- **D7 — Reads go through a headed Playwright Chromium.** The SUMO API host is behind a bot challenge: plain HTTP gets a JS challenge, and *headless* Chromium gets an image CAPTCHA. A *headed* browser passes cleanly and returns JSON. So `src/browser.ts` launches headed by default (`SUMO_HEADLESS=1` to override). Same engine will drive the later semi-automated publish path. Trade-off tracked in O2. *(Confirmed 2026-06-17, verified live against `thunderbird-desktop-and-thundermail`.)*

## Open questions

- **O4 — Ordered lists round-trip as unordered.** Live round-trip (2026-06-17) of `real.wiki` was semantically faithful (all protected tokens, headings, bold/italic preserved); only bug: `#` numbered lists came back as `*`. ROOT CAUSE (from `--debug-lists`): Google Drive's HTML importer discarded the `<ol>`/`<ul>` distinction — every list imported as `glyphType: GLYPH_TYPE_UNSPECIFIED`, so the info was lost at *import*, not export. Attempted fix (explicit `list-style-type:decimal/disc` + `type="1"` on `<ol>`/`<ul>`) DID NOT WORK — re-import still yields `GLYPH_TYPE_UNSPECIFIED` (confirmed 2026-06-17). CONCLUSION: Drive's HTML→Docs import cannot preserve ordered-vs-bulleted lists at all. Resolution → D11 (build the Doc via the Docs API instead of HTML import). RESOLVED 2026-06-18: live round-trip via Docs API construction preserves `#`/`*` correctly, and also fixed the double-space collapse (direct text insertion, no HTML normalization). Remaining diffs are cosmetic (extra blank lines + trailing whitespace), accepted.

- **O6 — A bullet nested under a numbered step (`#*`) loses its nesting on the round-trip.** Found 2026-08-17 while verifying D20/D21 on the custom-OAuth article. Source `#For the Exchange URL enter:` + `#*For EWS: …` comes back from `to-markup` as `# For the Exchange URL enter:` + `* For EWS: …` — level-1 bullet, no longer inside the step. ROOT CAUSE is in `docsCreate.buildRequests`, not the reverse converter: contiguous list items are grouped into one `createParagraphBullets` range only while `ordered` stays the same, so a `#`→`#*` switch starts a *new* list whose first item sits at nesting level 0 (its leading tab is stripped with nothing to attach to). `fromDoc` then reads `nestingLevel: 0` and correctly writes a single `*`. Same-type nesting (`*` → `**`) is unaffected and round-trips fine. IMPACT: on SUMO the numbered list restarts at 1 after each nested bullet run, so a 19-step procedure renumbers mid-way. NOT YET FIXED — needs the grouping in `buildRequests` to keep mixed-type nested items in the parent list (and `listPrefix` to emit a mixed `#*` prefix rather than a repeated single glyph). Own bucket; touches the index-shifting logic D11 warns about.

- **O5 — RESOLVED (2026-06-18).** Bare single newlines were becoming `<br>`. Per project owner, Kitsune joins a single newline into flowing text, so `toHtml` now joins consecutive paragraph lines with a SPACE (not `<br>`); blank-line-separated paragraphs stay separate; explicit `<br>` tags in source are preserved. Numbered steps and bullets confirmed rendering correctly in the Doc.

- **O1 — RESOLVED → D7.** Chosen: headless browser (Playwright). Still worth pursuing (b) an official/allowlisted SUMO API path with the SUMO team as a longer-term simplification.

- **O3 — Real-article parser hardening.** *Validated against one real article (`thunderbird main window`, 2026-06-17).* Conversion was highly faithful (59 tokens preserved). Two gaps found and fixed: `__TOC__` magic word (now `magic-word` token) and leading `;`/`:` definition-list/indent markers (now `indent` token). Still only one real article — more will surface more (tables to render, `<nowiki>`, etc.). Keep `real.wiki` as a regression fixture.

- **O2 — Server/web deployment of the browser fetch.** D7 requires *headed* Chromium today (headless is CAPTCHA-walled). A future web-app backend has no display, so it will need xvfb, a stealth/anti-detection layer, or an allowlisted API (O1b). Revisit at the web-app bucket.

## Bucket 4 — Generation design (decided 2026-06-18)

- **D12 — Generation outputs WikiMarkup**, fed through the existing `import-source` pipeline (→ Doc) so drafts round-trip and reuse Buckets 2–3. Claude emits SUMO WikiMarkup directly.
- **D13 — Model: Claude Opus 5 (`claude-opus-5`)** — the default for `draft` and `revise`, set once as `DEFAULT_MODEL` in `index.ts` so the two commands can't drift. *(Switched from Opus 4.8 on 2026-08-04 at the owner's request; drop-in — same pricing, and the existing call already used adaptive thinking + streaming with no sampling params, so no request changes were needed.)* Previously: **Claude Opus 4.8 (`claude-opus-4-8`)** via the official `@anthropic-ai/sdk`, `thinking: {type:"adaptive"}`, **streamed** (`.stream()`/`.finalMessage()`). Configurable via flag. Requires `ANTHROPIC_API_KEY`. Cache the (stable) style-guide system prompt so repeated drafts are cheap.
- **D14 — On-style via SUMO's OWN style articles, compiled — not hand-drafted.** Source of truth = `support.mozilla.org/en-US/kb/improve-knowledge-base` + every article it links to under `/en-US/kb/`. A `build-style` command discovers those links dynamically (fetch root → parse `/en-US/kb/` hrefs → fetch each via the existing `fetch` path → cheerio text) and compiles them into `prompts/sumo-style/` (committed, refreshable). This corpus also supplies the WikiMarkup syntax rules (it includes markup-chart, markup-cheat-sheet, how-to-use-for, using-templates). Currently 13 linked articles: anatomy-of-a-knowledge-base-article, create-new-knowledge-base-article, edit-knowledge-base-article, markup-cheat-sheet, about-knowledge-base, writing-guide-knowledge-base-articles, article-metadata, when-and-how-to-use-keywords, how-to-make-screenshots, how-place-images-article, markup-chart, how-to-use-for, using-templates. `access-mozilla-services-firefox-account` is also linked but EXCLUDED (a product article, not writing guidance) via an exclusion set in `build-style`.
- **D15 — Accuracy guardrails:** ground claims in `--source` material; do NOT invent UI specifics; mark uncertainties as visible `{note}` TODOs and `[[Image:PLACEHOLDER]]`; human review in the Doc makes it publish-ready (matches the core decision).
- **D17 — GitHub issues/PRs load as raw Markdown via the API, never by scraping the page.** `github.com/<owner>/<repo>/(issues|pull)/<n>` gets its own branch in `sources.ts` (ahead of the generic web-page branch) backed by `src/github.ts`. Auth order: the **`gh` CLI** first (`gh issue view --json title,body,comments`) because it reuses the owner's existing login and so covers private repos with no token plumbing; falls back to the REST API (`GITHUB_TOKEN`/`GH_TOKEN` if set, else unauthenticated — fine for public repos). Comments are included and attributed. Rationale, measured on `thunderbird/knowledgebase-issues#230`: the Playwright page scrape produced **12,101 chars, ~85% of it GitHub navigation chrome**, and flattened the markdown that carries the meaning — task checkboxes, fenced ```` ```wiki ```` blocks, and inline `` `{button}` ``/`` `{menu}` `` code spans. The API path produces **1,814 chars of pure signal**. The scrape also silently *lost a checklist item* (the `Thunderbird app menu {menu ☰} > {menu Settings}` rewording), which the API path applied. Not solved: issue bodies embed screenshots as `<img src="…user-attachments/assets/…">`; those URLs pass through as literal HTML and are **not** fetched, so image content still has to be supplied as a local `--source` file. *(Confirmed 2026-08-04; verified live against issue #230.)*
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
