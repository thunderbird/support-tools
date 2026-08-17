// Shared staging step: WikiMarkup -> editable Google Doc, built via the Docs API
// (preserves list numbering — D11). Used by `import-source` and `draft`.

import { wikiToHtml, type WikiConversionReport } from "./wikimarkup/toHtml.js";
import { htmlToModel, type Block } from "./wikimarkup/docModel.js";
import { noteMixedListMarkers } from "./wikimarkup/mixedLists.js";
import { createDocFromModel, replaceDocFromModel } from "./google/docsCreate.js";
import { authorize } from "./google/auth.js";
import { attachImages, type ImageAttachReport } from "./images.js";
import { CONTENT_MARKER } from "./constants.js";

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
            "tokens themselves intact so the article converts back cleanly.",
        },
      ],
    },
    { type: "paragraph", runs: [{ text: `Staged: ${importedAt}` }] },
    { type: "paragraph", runs: [{ text: CONTENT_MARKER }] },
  ];
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
