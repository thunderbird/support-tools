// Shared output for generated/edited WikiMarkup: write to a Doc, a file, or stdout.

import { promises as fs } from "node:fs";
import { wikiToHtml, type WikiConversionReport } from "./wikimarkup/toHtml.js";
import { wikiToGoogleDoc } from "./stageDoc.js";
import type { ImageAttachReport } from "./images.js";

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
  images?: string;
}

/** Report which screenshots landed, and what didn't line up (D19). */
export function printImageReport(r: ImageAttachReport): void {
  for (const i of r.inserted) {
    console.log(`   🖼  ${i.token} ← ${i.file}${i.width ? ` (scaled to ${i.width}px)` : " (natural size)"}`);
  }
  if (r.tokensWithoutFile.length) {
    console.log(`\n⚠️  No image file matched these tokens (name the file after the token):`);
    for (const t of r.tokensWithoutFile) console.log(`     ${t}`);
  }
  if (r.filesWithoutToken.length) {
    console.log(`\n⚠️  Unused files in --images (no matching [[Image:...]] token):`);
    for (const f of r.filesWithoutToken) console.log(`     ${f}`);
  }
}

/** Flag the lists whose `#*` sub-markers the Doc had to flatten (O6). */
export function printMixedListNotes(notes: number): void {
  if (!notes) return;
  console.log(
    `\n⚠️  ${notes} list${notes === 1 ? "" : "s"} with "#*" sub-bullets: the Doc shows those ` +
      `as "a./b." and to-markup returns "##". A TODO comment is in the Doc above each one — ` +
      `restore "#*" before pasting into SUMO.`,
  );
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
    const { url, images, mixedListNotes } = await wikiToGoogleDoc(
      title,
      docIntro,
      wiki,
      opts.images,
    );
    console.log(`\n✅ Created Google Doc:\n   ${url}`);
    if (images) printImageReport(images);
    printMixedListNotes(mixedListNotes);
  } else if (opts.out) {
    await fs.writeFile(opts.out, wiki);
    console.log(`\n✅ Wrote WikiMarkup to ${opts.out}`);
  } else {
    console.log(`\n----- WikiMarkup -----\n`);
    console.log(wiki);
  }
  printReport(report);
}
