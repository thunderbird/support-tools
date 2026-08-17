# Protected wiki tokens in a staged Google Doc

**There is a Google Doc version of this page, with every token already highlighted:**
<https://docs.google.com/document/d/1cZLEQwU-4WXeWSSOspTJWD9EgxZAE4hPpJHzCQ9ciOk/edit>

Copy a token straight out of that Doc into an article Doc and it keeps its formatting,
which plain Markdown cannot do. The Doc leads with the pasteable tokens and keeps the
explanation in one "Fine print" section at the end, so a contributor can collapse it (see
[Regenerating the Doc](#regenerating-the-doc)).

The rest of this page is the same content in Markdown, for reading on GitHub. (If you do
paste *this* file into a Doc, turn on *Tools → Preferences → Automatically detect Markdown*
first — but note the tokens will arrive as plain text, not highlighted.)

## Copy from here — the 16 protected kinds

These are the labels the CLI reports after a conversion ("Protected tokens preserved
verbatim"). Anything not on this list is reversible formatting and is rendered normally
in the Doc. House highlight colour: `#FFF2CC`.

Inline constructs:

1. **`for`** — `{for win,mac}` … `{/for}`, the OS/version conditionals
2. **`note`** — `{note}` … `{/note}`
3. **`warning`** — `{warning}` … `{/warning}`
4. **`key`** — a keyboard shortcut, `{key Ctrl+T}`
5. **`menu`** — a menu path or label, `{menu Account Settings}`
6. **`button`** — a button label, `{button Add WebDAV}`
7. **`filepath`** — a file name or path, `{filepath prefs.js}`
8. **`pref`** — a preference name or value, `{pref mail.server.default}`
9. **`image`** — `[[Image:Name of screenshot]]`
10. **`template`** — `[[Template:…]]` and `[[Include:…]]`
11. **`internal-link`** — any other `[[Article Title]]` link to a KB article
12. **`magic-word`** — `__TOC__`, `__NOTOC__`, and friends

Whole-block constructs (protected in one piece, newlines included):

13. **`table`** — a wiki table, `{|` … `|}`
14. **`code-block`** — a `<code>` block spanning more than one line; it is preformatted on
    SUMO, so its line breaks and indentation are kept exactly. A **single-line** `<code>`
    is *not* in this list — it becomes real monospace formatting instead.
15. **`comment`** — an HTML comment, `<!-- … -->`, including a multi-line one
16. **`indent`** — the leading `;` / `:` definition-list and indent markers on a line

## Fine print

### The one rule that matters

**A highlighted run is wiki source and is copied back out verbatim. Everything else is
treated as prose.**

* **Any** highlight colour counts — the detector looks only for "this run has a background
  colour", never for a specific one (`isProtected` in `src/wikimarkup/fromDoc.ts`).
* **Please use the standard pale yellow, `#FFF2CC`,** which is what the tool applies when it
  stages a Doc. Other colours work, but a consistent colour is what makes "don't touch
  this" readable at a glance.
* The **Courier New** font is only a visual cue; it is not part of the test.

Three ways that plays out when you edit:

| What you leave behind | What comes back out |
| --- | --- |
| Highlighted (any colour) | The text **verbatim**, as wiki source |
| Courier New with **no** highlight | An inline `<code>…</code>` span |
| Neither | Ordinary prose — any wiki meaning is lost |

So: edit the words *around* a token, never the characters inside it. If you highlight a
whole sentence by accident, it will be published as raw wiki markup instead of prose. If
you delete a token's highlight, the article silently loses that construct.

### Practical notes

* **A line that is nothing but tokens gets its own paragraph** (`__TOC__`,
  `[[UI:details_start]]`, a `{for win}` marker, one line of a code block). Keep it on its
  own line; that is how the article's structure survives the trip back.
* **Do not "fix" a token's spacing or capitalisation.** It is source code, not prose.
* **A `<!-- TODO (sumo-kb-tools): … -->` comment** is a note the tool added for you — act on
  it, then delete the comment before publishing.
* Adding a *new* token by hand works: type the wiki text, then highlight it in `#FFF2CC`.

### What is *not* a token

Rendered as normal Doc formatting, and converted back automatically: headings, **bold**,
*italic*, bulleted and numbered lists, external links, single-line `<code>`, `<u>`, `<s>`,
`<del>`, `<sub>`, `<sup>`, `<blockquote>`, `<br>`. Edit these like ordinary text.

One known limitation: a `#*` bullet nested under a numbered step cannot be shown as a
bullet by the Docs API, so it appears as `a.` / `b.` and converts back as `##`. The tool
leaves a TODO comment above any list where this happens.

## Regenerating the Doc

The Doc is generated from [`protected-tokens.wiki`](protected-tokens.wiki) by the tool
itself, so every example is formatted by the same code path it documents. Rewrite the
existing Doc in place — that keeps the published URL above and everyone's sharing, and the
old version stays in the Doc's version history:

```bash
npm run dev -- import-source docs/protected-tokens.wiki --no-header \
  --replace 1cZLEQwU-4WXeWSSOspTJWD9EgxZAE4hPpJHzCQ9ciOk \
  --title "SUMO KB — protected wiki tokens (cheat sheet)"
```

`--no-header` skips the "⚠️ Draft staged from WikiMarkup" banner and the `CONTENT_MARKER`
line: this Doc is reference material, not a staged article.

**Two clicks the API cannot do.** The Docs API has no way to set pageless mode or to
collapse a heading (there is no such field in `documents.batchUpdate`), so after a
regeneration an editor has to, once:

1. *File → Page setup → Pageless* — collapsible headings only exist in pageless mode.
2. Click the triangle next to **Fine print** to collapse it.

An editor's collapse is saved with the Doc, so readers then open it collapsed with the
pasteable tokens on screen; a viewer's own expand/collapse is never saved.
