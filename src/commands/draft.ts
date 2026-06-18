// `sumo draft` — generate an on-style SUMO WikiMarkup article from a brief plus
// optional source material, and stage it as an editable Google Doc. See Bucket 4.

import { promises as fs } from "node:fs";
import { loadStyleCorpus, buildSystemBlocks } from "../prompts.js";
import { loadSources } from "../sources.js";
import { generateWikiMarkup } from "../anthropic/draft.js";
import { wikiToHtml } from "../wikimarkup/toHtml.js";
import { wikiToGoogleDoc } from "../stageDoc.js";
import { deriveTitle, printReport } from "./importSource.js";

const DEFAULT_MODEL = "claude-opus-4-8";

interface DraftOptions {
  source?: string[];
  out?: string;
  doc?: boolean;
  dryRun?: boolean;
  model: string;
  title?: string;
}

function buildUserText(brief: string, sources: { label: string; text: string }[]): string {
  const head = `# Article brief\n\n${brief}\n`;
  if (sources.length === 0) {
    return (
      head +
      `\n# Source material\n\nNone provided. Be especially careful not to invent specifics; ` +
      `mark anything uncertain as {note}TODO{/note}.\n`
    );
  }
  const body = sources
    .map((s) => `## Source: ${s.label}\n\n${s.text}`)
    .join("\n\n");
  return (
    head +
    `\n# Source material (ground all facts in this; do not invent specifics)\n\n${body}\n`
  );
}

export async function runDraft(brief: string | undefined, options: DraftOptions): Promise<void> {
  if (!brief || !brief.trim()) {
    throw new Error('Provide a brief, e.g. draft "How to set up Gmail in Thunderbird".');
  }

  const corpus = await loadStyleCorpus();
  const system = buildSystemBlocks(corpus);

  const sources = await loadSources(options.source ?? []);
  const userText = buildUserText(brief, sources.texts);
  const content = [{ type: "text" as const, text: userText }, ...sources.media];

  if (options.dryRun) {
    const sysChars = system.reduce((n, b) => n + b.text.length, 0);
    console.log(`--- dry run (no API call) ---`);
    console.log(`Model: ${options.model}`);
    console.log(`System prompt: ${sysChars} chars in ${system.length} blocks (style corpus cached)`);
    console.log(`Text sources: ${sources.texts.length}  |  media blocks (pdf/image): ${sources.media.length}`);
    console.log(`\n----- user text (truncated) -----\n${userText.slice(0, 2500)}`);
    return;
  }

  const streamProgress = Boolean(options.doc || options.out);
  console.log(`Generating draft with ${options.model}…${streamProgress ? "\n" : ""}`);
  const wiki = await generateWikiMarkup({
    model: options.model,
    system,
    content,
    onText: streamProgress ? (d) => process.stderr.write(d) : undefined,
  });
  if (streamProgress) process.stderr.write("\n");

  const { report } = wikiToHtml(wiki); // sanity-parse + token report

  if (options.doc) {
    const title = options.title ?? deriveTitle(wiki, "Draft SUMO article");
    const { url } = await wikiToGoogleDoc(
      title,
      "⚠️ AI-generated DRAFT — review and verify every {note}TODO before publishing. SUMO is the source of truth.",
      wiki,
    );
    console.log(`\n✅ Created Google Doc:\n   ${url}`);
  } else if (options.out) {
    await fs.writeFile(options.out, wiki);
    console.log(`\n✅ Wrote WikiMarkup to ${options.out}`);
  } else {
    console.log(`\n----- WikiMarkup -----\n`);
    console.log(wiki);
  }
  printReport(report);
}
