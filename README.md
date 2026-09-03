# support-tools

Tools to draft, edit, and publish [SUMO](https://support.mozilla.org) Knowledge Base articles using Google Docs as a staging/collaboration surface. SUMO is the source of truth; Google Docs is for drafting and review.

See [`docs/DECISIONS.md`](docs/DECISIONS.md) for goals, scope, and architectural decisions.

## Requirements

- Node.js >= 18

## Install

```bash
npm install
```

## Google setup (one-time)

The `fetch` command creates Google Docs, which needs an OAuth credential.

1. Open the [Google Cloud Console](https://console.cloud.google.com) and create a project (e.g. `thunderbird-sumo-tools`).
2. Enable the **Google Docs API** and **Google Drive API** (APIs & Services → Library).
3. Configure the **OAuth consent screen** (User type *External*; add your Google address under *Test users*).
4. Create credentials → **OAuth client ID** → Application type **Desktop app** → download the JSON.
5. Save it as **`credentials.json`** in the project root. (It is gitignored — never commit it.)

On first run a browser window opens for consent; the refresh token is cached in `token.json` (also gitignored). If the required scopes change (e.g. when first using `to-markup`), the tool automatically re-runs consent.

> **Avoid the 7-day token expiry.** While the OAuth consent screen is in **Testing** status, Google expires refresh tokens after 7 days, so you'll be re-prompted to log in roughly weekly (the old `invalid_grant` symptom). To stop this, set the consent screen's **Publishing status** to **In production** (OAuth consent screen → *Publish app*). For an External app used only by yourself you can stay on the unverified-app warning screen — just click *Advanced → Go to … (unsafe)* once during consent. If a token does go stale, the tool now detects it, deletes `token.json`, and re-runs consent automatically.

## Usage

```bash
# Fetch a SUMO article into a new Google Doc
npm run fetch -- thunderbird-and-gmail

# Choose a locale
npm run fetch -- thunderbird-and-gmail --locale de

# Convert WikiMarkup source (e.g. copied from SUMO's edit view) into an editable Doc
npm run dev -- import-source article.wiki
cat article.wiki | npm run dev -- import-source        # or via stdin
pbpaste | npm run dev -- import-source --title "Custom OAuth for Thunderbird"
npm run dev -- import-source article.wiki --html       # print HTML, skip Doc (no Google needed)

# Rewrite an existing Doc in place, keeping its URL and sharing (old content stays in
# the Doc's version history). --no-header omits the "staged draft" banner + marker.
npm run dev -- import-source article.wiki --replace <docId-or-url> --no-header
```

`-t, --title` names the Doc. Without it the title comes from the first heading in the
source, falling back to "Imported SUMO article" — worth setting when you pipe in a
fragment that has no heading of its own. `draft` and `revise --doc` take the same option.
The option must come *after* the command name.


```bash
# Convert an edited Google Doc back into paste-ready WikiMarkup
npm run dev -- to-markup <docId-or-url>
npm run dev -- to-markup <docId-or-url> --out article.wiki
```

In an imported Doc, prose is rendered for easy editing, while wiki-specific constructs
(`{for}`, `{note}`, images, templates, internal links, tables) are preserved verbatim as
**highlighted monospace tokens** — edit around them, but leave the tokens intact.

[`docs/protected-tokens.md`](docs/protected-tokens.md) lists all 16 protected kinds and the
editing rules, and is written to be pasted into a review Doc as a contributor cheat sheet.
The highlight is the load-bearing signal — **any** colour marks a run as wiki source, so
prefer the standard pale pink (`#F4CCCC`) and don't highlight prose by accident.

A staged Doc's metadata header also carries a **token palette**: the tokens you are most
likely to need, already highlighted. Copy one from there instead of typing the wiki text
and then remembering to highlight it — the palette sits above the content marker, so
`to-markup` strips it and it never reaches the article.

`to-markup` and `publish` **lint** the markup on the way out and print warnings; they
never rewrite it. Two passes run together.

Ours covers the Google Docs staging surface and this tool's own leftovers: highlighted
runs that are not wiki markup at all (the "I highlighted a sentence so my reviewer would
see it" trap — a highlight means *publish verbatim*, so it goes out as raw text and any
bold/italic/link inside it is dropped; use a Google Docs comment instead), unbalanced
`[[UI:details_start]]`/`_end`, `{token}` names that are not in the SUMO markup chart, and
leftovers that would publish as visible junk: `[[Image:PLACEHOLDER …]]`, `{note}TODO`, and
the tool's own `<!-- TODO (sumo-kb-tools): … -->` reminders.

The wiki-markup rules themselves are delegated to
[**sumo-linter**](https://github.com/thunderbird/sumo-linter) — a real lexer beats our
regexes — which adds unclosed `{note}`/`{warning}`/`{for}` reported at the offending
token, unbalanced `'''`, mismatched heading `=` runs, unknown `[[Image:]]` parameters,
unmatched `[[`, empty list items, and Markdown syntax leaking into wiki source. Install
its `sumo-lint` binary and both commands pick it up automatically (`SUMO_LINT_BIN`
overrides the path); without it they fall back to weaker built-in checks and say so. It is
only ever run in report mode — `--fix`/`--style` are never invoked on your markup.

The command prints the URL of the created Google Doc.

> **A Chromium window will briefly open during fetch.** The SUMO API is behind a bot
> challenge that blocks plain HTTP clients and even headless browsers (it shows a CAPTCHA),
> so reads run through a real (headed) browser. Don't close the window; it closes itself.

### Generate a draft article (Bucket 4)

Requires an **`ANTHROPIC_API_KEY`** in your environment. First compile SUMO's style guidance once (re-run to refresh):

```bash
npm run dev -- build-style          # writes prompts/sumo-style/ (opens ~14 browser windows)
```

Then generate from a brief, optionally grounded in source material (repeatable, mixed types — local `.txt/.md/.wiki/.html/.pdf`, images, SUMO slugs/URLs, or any web URL):

`--source` = facts to ground in (synthesized). `--reference` = existing articles for style/structure/cross-links (never copied). Both accept the same input types and are repeatable.

```bash
npm run dev -- draft "Gmail setup for Thunderbird on Windows, beginner-friendly" \
  --source release-notes.pdf \
  --reference https://support.mozilla.org/en-US/kb/thunderbird-and-gmail

npm run dev -- draft "..." --out draft.wiki   # write WikiMarkup to a file
npm run dev -- draft "..." --doc              # stage as an editable Google Doc
npm run dev -- draft "..." --dry-run          # assemble the prompt only, no API call
```

The draft is **AI-generated for human review**: facts are grounded in your sources, and anything uncertain is flagged as a visible `{note}TODO{/note}` or `[[Image:PLACEHOLDER]]`.

### Revise an existing article

Revise a `.wiki` file, a SUMO slug/URL, or a Google Doc per an instruction (same `--source`/`--reference`/`--out`/`--doc`/`--dry-run` options as `draft`):

```bash
npm run dev -- revise https://support.mozilla.org/en-US/kb/thunderbird-and-gmail \
  --instruction "Update for Thunderbird 128 and add a troubleshooting section" --out revised.wiki
```

(For high-fidelity edits, pass the real `.wiki` source rather than a slug/URL — see D3.)

### Work from a GitHub issue checklist

A KB issue is usually the actual work order — a link to the article plus a checklist of
changes. Pass the issue URL as a `--source` and it is loaded as raw Markdown via the `gh`
CLI (falling back to the REST API), so checkboxes, fenced code blocks and inline
`` `{button}` ``/`` `{menu}` `` spans survive intact. Don't paste the rendered page
instead: it is ~85% GitHub chrome and silently drops checklist items (D17).

Worked example — [knowledgebase-issues#230](https://github.com/thunderbird/knowledgebase-issues/issues/230),
"Modernize Filelink article for Thundermail and send", which lists the article, its wiki
source, and a checklist of things to write:

```bash
# Revise the existing article against the issue's checklist.
# The issue links the real wiki source, so start from that rather than the rendered page.
curl -sO https://raw.githubusercontent.com/thunderbird/sumo-linter/main/corpus/en-US/filelink-large-attachments.wiki

npm run dev -- revise filelink-large-attachments.wiki \
  --instruction "Work through the checklist in the issue, item by item" \
  --source https://github.com/thunderbird/knowledgebase-issues/issues/230 \
  --images ./screenshots \
  --doc

# Then review the Doc, convert it back, and open SUMO's edit form:
npm run dev -- to-markup <docId-or-url> --out filelink-revised.wiki
npm run dev -- publish filelink-revised.wiki --slug filelink-large-attachments
```

Creating a *new* article the issue asks for is the same `--source`, with `draft` instead
of `revise` — the brief is the article you want, the issue supplies the facts:

```bash
npm run dev -- draft "Close to Tray replaces Minimize to Tray in Thunderbird 154 on Windows" \
  --source https://github.com/thunderbird/knowledgebase-issues/issues/216 \
  --reference https://support.mozilla.org/en-US/kb/filelink-large-attachments \
  --doc --title "Close to tray starting in 154"
```

Worth knowing:

* **Comments are included and attributed**, so a checklist item or correction added in a comment is picked up along with the body.
* **Screenshots embedded in the issue are not fetched** — they arrive as literal `<img src="…user-attachments…">` HTML. Download them and pass the folder with `--images <dir>` so they appear in the Doc for review (D19).
* Keep the checklist *in the issue* and keep `--instruction` short ("work through the checklist"); mixing the two just duplicates it in the prompt.
* Add anything else the issue references (a bug report, release notes, a linked article) as further `--source`/`--reference` values — both are repeatable.
* Private repos work as long as `gh auth status` is happy; public repos need no auth at all.
* `--dry-run` assembles the prompt and reports sizes without calling Claude — a cheap way to confirm the issue loaded (`Sources: 1 text`) before spending a request.

### Publish (semi-automated)

Copy paste-ready WikiMarkup to the clipboard and open the SUMO edit page (SUMO has no write API — submission is manual by design):

```bash
npm run dev -- publish revised.wiki --slug thunderbird-and-gmail   # edit existing
npm run dev -- publish draft.wiki --new                            # new article
```

`<source>` can be a `.wiki` file or a Google Doc URL/id (the doc you reviewed). Paste into the article's Content field and submit for review.

### The loop, end to end

```
SUMO wiki source ──import-source──▶ Google Doc ──review──▶ to-markup ──▶ .wiki ──publish──▶ SUMO
       ▲                                                                                     │
       └──────────────────────── paste the published source back ────────────────────────────┘
```

1. **Start from real wiki source, never from an old Doc.** Either the sumo-linter corpus
   (`https://raw.githubusercontent.com/thunderbird/sumo-linter/main/corpus/en-US/<slug>.wiki`,
   no login, but a periodic snapshot so it can lag) or copy it out of SUMO's edit view.
   `import-source <file>` stages it as a Doc; `revise <file> -i "…" --doc` does the same with
   an LLM pass first.
2. **Review in the Doc**, then `to-markup <doc-url> --out <slug>.wiki`. This is the only
   place the Doc-specific lint can run — highlighted prose is invisible once it is a file.
3. **`publish <slug>.wiki --slug <slug>`** (or `--new`) copies the markup and opens the SUMO
   form. Paste into the Content field, preview, submit. Metadata fields are hand-entered.
4. **Paste the published source back into the repo.** Anything fixed in SUMO's editor is
   invisible to both the `.wiki` and the Doc, and nothing syncs it back — the read API
   returns rendered HTML, not source (D3). So from the edit view:
   `pbpaste > <slug>.wiki`, then `sumo-lint <slug>.wiki`, then commit. Skip this and the
   fixtures quietly become stale drafts, and the next edit starts from the wrong text.
5. **Retire the Doc.** SUMO is the source of truth now. Trash it, keeping any Doc whose
   comment threads are worth preserving as the review record.

Rewriting a Doc in place (`import-source --replace`) deletes its whole body, which orphans
every comment anchor — check `drive.comments.list` first, and prefer surgical edits if the
Doc is still under review.

## Develop

```bash
npm run dev -- fetch <slug>   # run from TypeScript source
npm run typecheck             # type-check without emitting
npm run build                 # compile to dist/
```

---

* We require all those who participate in this repo to agree and adhere to the [Mozilla Community Participation Guidelines](https://www.mozilla.org/about/governance/policies/participation/)
