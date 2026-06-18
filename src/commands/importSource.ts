// `sumo import-source [file]` — turn pasted/real WikiMarkup source into an editable
// Google Doc (the high-fidelity (b) edit path). Reads from a file arg or stdin.
// See docs/DECISIONS.md D8/D9/D11.

import { promises as fs } from "node:fs";
import { wikiToHtml, type WikiConversionReport } from "../wikimarkup/toHtml.js";
import { wikiToGoogleDoc } from "../stageDoc.js";

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
export function deriveTitle(source: string, fallback = "Imported SUMO article"): string {
  const m = /^\s*=+\s*(.+?)\s*=+\s*$/m.exec(source);
  return m ? m[1] : fallback;
}

export function printReport(report: WikiConversionReport): void {
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
