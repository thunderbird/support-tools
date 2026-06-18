// `sumo import-source [file]` — turn pasted/real WikiMarkup source into an editable
// Google Doc (the high-fidelity (b) edit path). Reads from a file arg or stdin.
// The Doc is built via the Docs API (D11) so ordered/bulleted lists survive.
// See docs/DECISIONS.md D8/D9/D11.

import { promises as fs } from "node:fs";
import { wikiToHtml, type WikiConversionReport } from "../wikimarkup/toHtml.js";
import { htmlToModel, type Block } from "../wikimarkup/docModel.js";
import { authorize } from "../google/auth.js";
import { createDocFromModel } from "../google/docsCreate.js";
import { CONTENT_MARKER } from "../constants.js";

interface ImportOptions {
  title?: string;
  html?: boolean; // print HTML and skip Google Doc creation (for testing without creds)
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Derive a Doc title from the first top-level heading, else a default. */
function deriveTitle(source: string): string {
  const m = /^\s*=+\s*(.+?)\s*=+\s*$/m.exec(source);
  return m ? m[1] : "Imported SUMO article";
}

/** Metadata header blocks, ending in the CONTENT_MARKER that to-markup strips. */
function headerBlocks(importedAt: string): Block[] {
  return [
    {
      type: "paragraph",
      runs: [
        {
          text: "⚠️ Draft staged from WikiMarkup — SUMO is the source of truth, not this Doc.",
          bold: true,
        },
      ],
    },
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
    { type: "paragraph", runs: [{ text: `Imported: ${importedAt}` }] },
    { type: "paragraph", runs: [{ text: CONTENT_MARKER }] },
  ];
}

function printReport(report: WikiConversionReport): void {
  console.log(`\nProtected tokens preserved verbatim: ${report.totalProtected}`);
  for (const [kind, n] of Object.entries(report.protectedByKind).sort()) {
    console.log(`  ${kind}: ${n}`);
  }
}

export async function runImportSource(file: string | undefined, options: ImportOptions): Promise<void> {
  const source = file ? await fs.readFile(file, "utf8") : await readStdin();
  if (!source.trim()) {
    throw new Error("No WikiMarkup provided (empty file/stdin).");
  }

  const title = options.title ?? deriveTitle(source);
  const { html, report } = wikiToHtml(source);

  if (options.html) {
    console.log(html);
    printReport(report);
    return;
  }

  const importedAt = new Date().toISOString();
  const blocks = [...headerBlocks(importedAt), ...htmlToModel(html)];

  console.log(`Authorizing with Google…`);
  const auth = await authorize();
  console.log(`Creating Google Doc "${title}"…`);
  const doc = await createDocFromModel(auth, title, blocks);

  console.log(`\n✅ Created Google Doc:\n   ${doc.url}`);
  printReport(report);
}
