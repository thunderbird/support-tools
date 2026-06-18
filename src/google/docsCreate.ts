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
  const listItems: { start: number; end: number; ordered: boolean }[] = [];

  for (const block of blocks) {
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
      paragraphStyleReqs.push({
        updateParagraphStyle: {
          range: { startIndex: paraStart, endIndex: paraEnd },
          paragraphStyle: { namedStyleType: `HEADING_${block.level}` },
          fields: "namedStyleType",
        },
      });
    } else if (block.type === "listItem") {
      listItems.push({ start: paraStart, end: paraEnd, ordered: block.ordered });
    }
  }

  // Group contiguous list items of the same ordered-type into bullet ranges.
  const groups: { start: number; end: number; ordered: boolean }[] = [];
  for (const item of listItems) {
    const last = groups[groups.length - 1];
    if (last && last.ordered === item.ordered && last.end === item.start) {
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

  return { id: documentId, url: `https://docs.google.com/document/d/${documentId}/edit` };
}
