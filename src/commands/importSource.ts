// `sumo import-source [file]` — turn pasted/real WikiMarkup source into an editable
// Google Doc (the high-fidelity (b) edit path). Reads from a file arg or stdin.
// See docs/DECISIONS.md D8/D9/D11.

import { promises as fs } from "node:fs";
import { wikiToHtml } from "../wikimarkup/toHtml.js";
import { wikiToGoogleDoc } from "../stageDoc.js";
import { deriveTitle, printReport } from "../output.js";

interface ImportOptions {
  title?: string;
  html?: boolean; // print HTML and skip Google Doc creation (for testing without creds)
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

  console.log(`Authorizing with Google and creating Doc "${title}"…`);
  const { url, report } = await wikiToGoogleDoc(
    title,
    "⚠️ Draft staged from WikiMarkup — SUMO is the source of truth, not this Doc.",
    source,
  );

  console.log(`\n✅ Created Google Doc:\n   ${url}`);
  printReport(report);
}
