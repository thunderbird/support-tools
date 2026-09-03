// Shared staging step: WikiMarkup -> editable Google Doc, built via the Docs API
// (preserves list numbering — D11). Used by `import-source` and `draft`.

import { wikiToHtml, type WikiConversionReport } from "./wikimarkup/toHtml.js";
import { htmlToModel, type Block } from "./wikimarkup/docModel.js";
import { noteMixedListMarkers } from "./wikimarkup/mixedLists.js";
import { createDocFromModel, replaceDocFromModel } from "./google/docsCreate.js";
import { authorize } from "./google/auth.js";
import { attachImages, type ImageAttachReport } from "./images.js";
import { CHEAT_SHEET_URL, CONTENT_MARKER } from "./constants.js";

/**
 * The palette (issue #2): the tokens a contributor is most likely to need, staged
 * through the normal converter so each one arrives already highlighted in the house
 * colour (#F4CCCC, D25). Copying a token from here carries its formatting, so the
 * token is correct by construction — the alternative is typing the wiki text and then
 * remembering to highlight it, which is where hand-added tokens go wrong.
 *
 * Paired tokens are listed as two separate tokens with plain text between them, so
 * that text typed in place of the `…` does not inherit the highlight.
 */
const PALETTE_WIKI =
  "{note} … {/note} · {warning} … {/warning} · {for win,mac} … {/for} · {key Ctrl+T} · " +
  "{menu Account Settings} · {button Add} · {filepath prefs.js} · " +
  "{pref mail.server.default} · [[Image:Screenshot name]] · [[Another KB article title]]";

/** Header blocks ending in the CONTENT_MARKER that `to-markup` strips. */
export function headerBlocks(intro: string, importedAt: string): Block[] {
  return [
    { type: "paragraph", runs: [{ text: intro, bold: true }] },
    {
      type: "paragraph",
      runs: [
        {
          text:
            "Highlighted monospace spans are protected wiki tokens ({for}, {note}, images, " +
            "templates, internal links, tables). Edit the text around them, but leave the " +
            "tokens themselves intact so the article converts back cleanly. Never highlight " +
            "ordinary prose: a highlight means “publish verbatim”, so it would go out as raw " +
            "markup and any bold/italic/link inside it is dropped — use a comment for review " +
            "notes.",
        },
      ],
    },
    {
      type: "paragraph",
      runs: [
        { text: "Need a token? Copy one from here — the highlight comes with it (" },
        { text: "full cheat sheet", link: CHEAT_SHEET_URL },
        { text: "):" },
      ],
    },
    ...paletteBlocks(),
    { type: "paragraph", runs: [{ text: `Staged: ${importedAt}` }] },
    { type: "paragraph", runs: [{ text: CONTENT_MARKER }] },
  ];
}

/**
 * Build the palette line through `wikiToHtml` -> `htmlToModel` rather than hand-writing
 * its runs, so it is highlighted by exactly the rules that protect tokens in the article
 * body — a token the converter would not protect cannot end up in the palette looking as
 * if it would.
 */
function paletteBlocks(): Block[] {
  return htmlToModel(wikiToHtml(PALETTE_WIKI).html);
}

export interface StagedDoc {
  url: string;
  id: string;
  report: WikiConversionReport;
  images?: ImageAttachReport;
  /** Reminders added above lists whose `#*` sub-markers the Doc cannot show (O6). */
  mixedListNotes: number;
}

export interface StageOptions {
  /** Folder of local screenshots to embed next to `[[Image:...]]` tokens. */
  imagesDir?: string;
  /** Rewrite this existing Doc instead of creating one (keeps its URL + sharing). */
  replaceDocId?: string;
  /** Prepend the staged-draft header + CONTENT_MARKER. Off for reference Docs. */
  header?: boolean;
}

export async function wikiToGoogleDoc(
  title: string,
  intro: string,
  wikiSource: string,
  { imagesDir, replaceDocId, header = true }: StageOptions = {},
): Promise<StagedDoc> {
  const { html, report } = wikiToHtml(wikiSource);
  const importedAt = new Date().toISOString();
  // Only on the Doc path: `--out`/stdout keep the real `#*` markers, so no reminder is due.
  const { blocks: body, notes } = noteMixedListMarkers(htmlToModel(html));
  const blocks = header ? [...headerBlocks(intro, importedAt), ...body] : body;

  const auth = await authorize();
  const doc = replaceDocId
    ? await replaceDocFromModel(auth, replaceDocId, blocks, title)
    : await createDocFromModel(auth, title, blocks);
  // Screenshots go in afterwards, against the finished doc's real indices (D19).
  const images = imagesDir ? await attachImages(auth, doc.id, imagesDir) : undefined;
  return { url: doc.url, id: doc.id, report, images, mixedListNotes: notes };
}
