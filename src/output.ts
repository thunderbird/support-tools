// Shared output for generated/edited WikiMarkup: write to a Doc, a file, or stdout.

import { promises as fs } from "node:fs";
import { wikiToHtml, type WikiConversionReport } from "./wikimarkup/toHtml.js";
import { wikiToGoogleDoc } from "./stageDoc.js";

/** Title from the first heading in WikiMarkup, else a fallback. */
export function deriveTitle(source: string, fallback = "SUMO article"): string {
  const m = /^\s*=+\s*(.+?)\s*=+\s*$/m.exec(source);
  return m ? m[1] : fallback;
}

export function printReport(report: WikiConversionReport): void {
  console.log(`\nProtected tokens preserved verbatim: ${report.totalProtected}`);
  for (const [kind, n] of Object.entries(report.protectedByKind).sort()) {
    console.log(`  ${kind}: ${n}`);
  }
}

export interface EmitOptions {
  doc?: boolean;
  out?: string;
  title?: string;
}

/** Emit WikiMarkup to a Google Doc (--doc), a file (--out), or stdout. */
export async function emitWiki(
  wiki: string,
  opts: EmitOptions,
  docIntro: string,
  defaultTitle: string,
): Promise<void> {
  const { report } = wikiToHtml(wiki); // sanity-parse + token report

  if (opts.doc) {
    const title = opts.title ?? deriveTitle(wiki, defaultTitle);
    const { url } = await wikiToGoogleDoc(title, docIntro, wiki);
    console.log(`\n✅ Created Google Doc:\n   ${url}`);
  } else if (opts.out) {
    await fs.writeFile(opts.out, wiki);
    console.log(`\n✅ Wrote WikiMarkup to ${opts.out}`);
  } else {
    console.log(`\n----- WikiMarkup -----\n`);
    console.log(wiki);
  }
  printReport(report);
}
