// `sumo import-source [file]` — turn pasted/real WikiMarkup source into an editable
// Google Doc (the high-fidelity (b) edit path). Reads from a file arg or stdin.
// See docs/DECISIONS.md D8/D9/D11.

import { promises as fs } from "node:fs";
import { wikiToHtml } from "../wikimarkup/toHtml.js";
import { wikiToGoogleDoc } from "../stageDoc.js";
import { parseDocId } from "./toMarkup.js";
import { deriveTitle, printReport, printImageReport, printMixedListNotes } from "../output.js";

interface ImportOptions {
  title?: string;
  html?: boolean; // print HTML and skip Google Doc creation (for testing without creds)
  images?: string; // folder of local screenshots to embed next to [[Image:...]] tokens
  replace?: string; // rewrite this existing Doc instead of creating a new one
  header?: boolean; // commander sets false for --no-header
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function runImportSource(file: string | undefined, options: ImportOptions): Promise<void> {
  const source = file ? await fs.readFile(file, "utf8") : await readStdin();
  if (!source.trim()) {
    throw new Error("No WikiMarkup provided (empty file/stdin).");
  }

  const title = options.title ?? deriveTitle(source, "Imported SUMO article");

  if (options.html) {
    const { html, report } = wikiToHtml(source);
    console.log(html);
    printReport(report);
    return;
  }

  const replaceDocId = options.replace ? parseDocId(options.replace) : undefined;
  console.log(
    replaceDocId
      ? `Authorizing with Google and rewriting Doc ${replaceDocId}…`
      : `Authorizing with Google and creating Doc "${title}"…`,
  );
  const { url, report, images, mixedListNotes } = await wikiToGoogleDoc(
    title,
    "⚠️ Draft staged from WikiMarkup — SUMO is the source of truth, not this Doc.",
    source,
    { imagesDir: options.images, replaceDocId, header: options.header },
  );

  console.log(`\n✅ ${replaceDocId ? "Rewrote" : "Created"} Google Doc:\n   ${url}`);
  if (images) printImageReport(images);
  printMixedListNotes(mixedListNotes);
  printReport(report);
}
