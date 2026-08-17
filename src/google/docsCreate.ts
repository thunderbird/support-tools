// Build a Google Doc programmatically from a document model via the Docs API.
// Unlike Drive's HTML import, this preserves ordered-vs-bulleted lists exactly (D11).

import { google, type docs_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { Block, Run } from "../wikimarkup/docModel.js";

const HIGHLIGHT = { color: { rgbColor: { red: 1, green: 0.949, blue: 0.8 } } };
const MONO = { fontFamily: "Courier New" };

/** Docs textStyle + field mask for a run; null when the run needs no styling. */
function styleForRun(run: Run): { textStyle: docs_v1.Schema$TextStyle; fields: string } | null {
  const textStyle: docs_v1.Schema$TextStyle = {};
  const fields: string[] = [];

  if (run.token) {
    textStyle.weightedFontFamily = MONO;
    textStyle.backgroundColor = HIGHLIGHT;
    fields.push("weightedFontFamily", "backgroundColor");
  } else if (run.link) {
    textStyle.link = { url: run.link };
    fields.push("link");
  } else {
    if (run.mono) {
      textStyle.weightedFontFamily = MONO;
      fields.push("weightedFontFamily");
    }
    if (run.bold) {
      textStyle.bold = true;
      fields.push("bold");
    }
    if (run.italic) {
      textStyle.italic = true;
      fields.push("italic");
    }
    if (run.underline) {
      textStyle.underline = true;
      fields.push("underline");
    }
  }

  return fields.length ? { textStyle, fields: fields.join(",") } : null;
}

/**
 * Turn the block model into Docs API requests. Strategy:
 *   1. insert all text at once (list nesting encoded as leading tabs);
 *   2. apply text + paragraph (heading) styles against the inserted text;
 *   3. apply bullet presets LAST, in reverse document order — createParagraphBullets
 *      strips the leading tabs (shifting later indices), so reverse order keeps the
 *      not-yet-processed (earlier) ranges valid.
 */
export function buildRequests(blocks: Block[]): docs_v1.Schema$Request[] {
  let text = "";
  let index = 1; // Docs body content starts at index 1.
  const textStyleReqs: docs_v1.Schema$Request[] = [];
  const paragraphStyleReqs: docs_v1.Schema$Request[] = [];
  const listItems: { start: number; end: number; ordered: boolean; level: number }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === "hr") {
      // No native HR via batchUpdate; "----" is valid wiki and round-trips cleanly.
      text += "----\n";
      index += 5;
      continue;
    }

    const paraStart = index;
    if (block.type === "listItem") {
      const tabs = "\t".repeat(Math.max(0, block.level - 1));
      text += tabs;
      index += tabs.length;
    }

    for (const run of block.runs) {
      const start = index;
      text += run.text;
      index += run.text.length;
      const style = styleForRun(run);
      if (style && index > start) {
        textStyleReqs.push({
          updateTextStyle: {
            range: { startIndex: start, endIndex: index },
            textStyle: style.textStyle,
            fields: style.fields,
          },
        });
      }
    }

    text += "\n";
    index += 1;
    const paraEnd = index;

    if (block.type === "heading") {
      // A heading style carries its own spaceAbove, which after a structural token line
      // (`[[UI:details_start]]`, `__TOC__`, …) reads as a blank line the source never had.
      // Zero it out for that case only — see TIGHT_CLASS / D20.
      paragraphStyleReqs.push({
        updateParagraphStyle: {
          range: { startIndex: paraStart, endIndex: paraEnd },
          paragraphStyle: {
            namedStyleType: `HEADING_${block.level}`,
            ...(block.tight && { spaceAbove: { magnitude: 0, unit: "PT" } }),
          },
          fields: block.tight ? "namedStyleType,spaceAbove" : "namedStyleType",
        },
      });
    } else if (block.type === "listItem") {
      listItems.push({
        start: paraStart,
        end: paraEnd,
        ordered: block.ordered,
        level: block.level,
      });
    }

    // Separate consecutive prose paragraphs with an empty paragraph: a <p> boundary
    // usually means the wiki source had a blank line there (toHtml joins single newlines
    // into one <p> — O5), but Docs renders adjacent paragraphs with no gap. Only
    // paragraph→paragraph: headings carry their own spaceAbove, and a list that follows
    // its intro line has no blank line in the source. fromDoc collapses the empty
    // paragraph, so the round-trip is unchanged. Skipped when the NEXT paragraph is
    // tight — that one had no blank line above it in the source (D20).
    const next = blocks[i + 1];
    if (block.type === "paragraph" && next?.type === "paragraph" && !next.tight) {
      text += "\n";
      index += 1;
    }
  }

  // Group contiguous list items into bullet ranges — ONE range per list, so nesting is
  // read relative to the whole list and the numbering runs unbroken (O6). Split only when
  // the OUTERMOST level changes type (`#` run → `*` run = two different lists); a nested
  // item of the other type (`#` with `#*` children) stays in its parent's range, because
  // one `createParagraphBullets` preset covers every level and Docs has no mixed
  // numbered/bulleted preset — re-presetting a sub-range rewrites the whole list's glyphs
  // (verified live). So a nested bullet under a numbered step shows that preset's level-2
  // glyph; structure and numbering survive, the sub-marker type does not.
  const groups: { start: number; end: number; ordered: boolean }[] = [];
  for (const item of listItems) {
    const last = groups[groups.length - 1];
    const contiguous = last && last.end === item.start;
    if (contiguous && (item.level > 1 || last.ordered === item.ordered)) {
      last.end = item.end;
    } else {
      groups.push({ ...item });
    }
  }

  const bulletReqs: docs_v1.Schema$Request[] = groups
    .map((g) => ({
      createParagraphBullets: {
        range: { startIndex: g.start, endIndex: g.end },
        bulletPreset: g.ordered ? "NUMBERED_DECIMAL_ALPHA_ROMAN" : "BULLET_DISC_CIRCLE_SQUARE",
      },
    }))
    .reverse();

  return [
    { insertText: { location: { index: 1 }, text } },
    ...textStyleReqs,
    ...paragraphStyleReqs,
    ...bulletReqs,
  ];
}

export interface CreatedDoc {
  id: string;
  url: string;
}

function docUrl(id: string): string {
  return `https://docs.google.com/document/d/${id}/edit`;
}

/** Create a new Doc and populate it from the block model. */
export async function createDocFromModel(
  auth: OAuth2Client,
  title: string,
  blocks: Block[],
): Promise<CreatedDoc> {
  const docs = google.docs({ version: "v1", auth });
  const created = await docs.documents.create({ requestBody: { title } });
  const documentId = created.data.documentId;
  if (!documentId) throw new Error("Docs API did not return a documentId.");

  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: buildRequests(blocks) },
  });

  return { id: documentId, url: docUrl(documentId) };
}

/**
 * Rewrite an existing Doc's body from the block model, keeping its id, URL and
 * sharing (for reference Docs whose link is published, e.g. the token cheat sheet).
 * The previous content stays recoverable in the Doc's version history.
 */
export async function replaceDocFromModel(
  auth: OAuth2Client,
  documentId: string,
  blocks: Block[],
  title?: string,
): Promise<CreatedDoc> {
  const docs = google.docs({ version: "v1", auth });
  const existing = await docs.documents.get({ documentId });
  const content = existing.data.body?.content ?? [];
  const bodyEnd = content[content.length - 1]?.endIndex ?? 2;

  // A Doc always keeps one final empty paragraph, so the deletable range stops one
  // short of the body end. That survivor's styling has to be reset as well: text
  // inserted at index 1 inherits whatever the paragraph there carries (a heading
  // style, a bullet, a highlight), and buildRequests only ever *sets* styles.
  const wipe: docs_v1.Schema$Request[] = [];
  if (bodyEnd - 1 > 1) {
    wipe.push({ deleteContentRange: { range: { startIndex: 1, endIndex: bodyEnd - 1 } } });
  }
  const survivor = { startIndex: 1, endIndex: 2 };
  wipe.push(
    { deleteParagraphBullets: { range: survivor } },
    {
      updateParagraphStyle: {
        range: survivor,
        paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        fields: "namedStyleType",
      },
    },
    {
      updateTextStyle: {
        range: survivor,
        textStyle: {},
        fields: "bold,italic,underline,strikethrough,backgroundColor,weightedFontFamily,link",
      },
    },
  );
  await docs.documents.batchUpdate({ documentId, requestBody: { requests: wipe } });
  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: buildRequests(blocks) },
  });

  if (title && title !== existing.data.title) {
    // The Docs API can't rename a Doc; Drive can (drive.file covers app-created files).
    await google.drive({ version: "v3", auth }).files.update({
      fileId: documentId,
      requestBody: { name: title },
    });
  }

  return { id: documentId, url: docUrl(documentId) };
}
