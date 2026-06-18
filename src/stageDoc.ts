// Shared staging step: WikiMarkup -> editable Google Doc, built via the Docs API
// (preserves list numbering — D11). Used by `import-source` and `draft`.

import { wikiToHtml, type WikiConversionReport } from "./wikimarkup/toHtml.js";
import { htmlToModel, type Block } from "./wikimarkup/docModel.js";
import { createDocFromModel } from "./google/docsCreate.js";
import { authorize } from "./google/auth.js";
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
}

export async function wikiToGoogleDoc(
  title: string,
  intro: string,
  wikiSource: string,
): Promise<StagedDoc> {
  const { html, report } = wikiToHtml(wikiSource);
  const importedAt = new Date().toISOString();
  const blocks = [...headerBlocks(intro, importedAt), ...htmlToModel(html)];

  const auth = await authorize();
  const doc = await createDocFromModel(auth, title, blocks);
  return { url: doc.url, id: doc.id, report };
}
