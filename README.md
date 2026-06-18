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

## Develop

```bash
npm run dev -- fetch <slug>   # run from TypeScript source
npm run typecheck             # type-check without emitting
npm run build                 # compile to dist/
```

---

* We require all those who participate in this repo to agree and adhere to the [Mozilla Community Participation Guidelines](https://www.mozilla.org/about/governance/policies/participation/)
