// `sumo draft` — generate an on-style SUMO WikiMarkup article from a brief plus
// optional source/reference material, and emit it (Doc / file / stdout). See Bucket 4.

import { loadStyleCorpus, loadConventions, buildSystemBlocks } from "../prompts.js";
import { loadSources } from "../sources.js";
import { generateWikiMarkup } from "../anthropic/draft.js";
import { emitWiki } from "../output.js";

interface DraftOptions {
  source?: string[];
  reference?: string[];
  out?: string;
  doc?: boolean;
  dryRun?: boolean;
  model: string;
  title?: string;
  images?: string;
}

type Labeled = { label: string; text: string };

function buildUserText(brief: string, sources: Labeled[], references: Labeled[]): string {
  let t = `# Article brief\n\n${brief}\n`;

  if (sources.length > 0) {
    const body = sources.map((s) => `## Source: ${s.label}\n\n${s.text}`).join("\n\n");
    t += `\n# Source material (ground all facts in these; do not invent specifics)\n\n${body}\n`;
  } else {
    t +=
      `\n# Source material\n\nNone provided. Be especially careful not to invent specifics; ` +
      `mark anything uncertain as {note}TODO{/note}.\n`;
  }

  if (references.length > 0) {
    const body = references.map((r) => `## Reference: ${r.label}\n\n${r.text}`).join("\n\n");
    t +=
      `\n# Reference articles (for SUMO style, structure, terminology, and cross-links — ` +
      `do NOT copy or reproduce these; write an original article for the brief)\n\n${body}\n`;
  }

  return t;
}

export async function runDraft(brief: string | undefined, options: DraftOptions): Promise<void> {
  if (!brief || !brief.trim()) {
    throw new Error('Provide a brief, e.g. draft "How to set up Gmail in Thunderbird".');
  }

  const corpus = await loadStyleCorpus();
  const conventions = await loadConventions();
  const system = buildSystemBlocks(corpus, conventions);

  const sources = await loadSources(options.source ?? []);
  const references = await loadSources(options.reference ?? []);
  const userText = buildUserText(brief, sources.texts, references.texts);
  const content = [
    { type: "text" as const, text: userText },
    ...sources.media,
    ...references.media,
  ];

  if (options.dryRun) {
    const sysChars = system.reduce((n, b) => n + b.text.length, 0);
    console.log(`--- dry run (no API call) ---`);
    console.log(`Model: ${options.model}`);
    console.log(`System prompt: ${sysChars} chars in ${system.length} blocks (style corpus cached)`);
    console.log(
      `Sources: ${sources.texts.length} text + ${sources.media.length} media  |  ` +
        `References: ${references.texts.length} text + ${references.media.length} media`,
    );
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

  await emitWiki(
    wiki,
    options,
    "⚠️ AI-generated DRAFT — review and verify every {note}TODO before publishing. SUMO is the source of truth.",
    "Draft SUMO article",
  );
}
