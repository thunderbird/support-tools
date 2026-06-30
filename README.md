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
npm run dev -- import-source article.wiki --html       # print HTML, skip Doc (no Google needed)
```

```bash
# Convert an edited Google Doc back into paste-ready WikiMarkup
npm run dev -- to-markup <docId-or-url>
npm run dev -- to-markup <docId-or-url> --out article.wiki
```

In an imported Doc, prose is rendered for easy editing, while wiki-specific constructs
(`{for}`, `{note}`, images, templates, internal links, tables) are preserved verbatim as
**highlighted monospace tokens** — edit around them, but leave the tokens intact.

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

### Publish (semi-automated)

Copy paste-ready WikiMarkup to the clipboard and open the SUMO edit page (SUMO has no write API — submission is manual by design):

```bash
npm run dev -- publish revised.wiki --slug thunderbird-and-gmail   # edit existing
npm run dev -- publish draft.wiki --new                            # new article
```

`<source>` can be a `.wiki` file or a Google Doc URL/id (the doc you reviewed). Paste into the article's Content field and submit for review.

## Develop

```bash
npm run dev -- fetch <slug>   # run from TypeScript source
npm run typecheck             # type-check without emitting
npm run build                 # compile to dist/
```

---

* We require all those who participate in this repo to agree and adhere to the [Mozilla Community Participation Guidelines](https://www.mozilla.org/about/governance/policies/participation/)
