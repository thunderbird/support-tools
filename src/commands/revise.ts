// `sumo revise <existing>` — revise an existing article per an instruction, using
// Claude + the SUMO style corpus, and emit the full revised WikiMarkup. Composes
// the existing-article loader, generation, and output staging.

import { loadStyleCorpus, loadConventions, buildSystemBlocks } from "../prompts.js";
import { loadSources } from "../sources.js";
import { loadExistingWiki } from "../existing.js";
import { generateWikiMarkup } from "../anthropic/draft.js";
import { emitWiki } from "../output.js";

interface ReviseOptions {
  instruction?: string;
  source?: string[];
  reference?: string[];
  out?: string;
  doc?: boolean;
  dryRun?: boolean;
  model: string;
  title?: string;
}

type Labeled = { label: string; text: string };

function buildReviseText(
  instruction: string,
  existingWiki: string,
  sources: Labeled[],
  references: Labeled[],
): string {
  let t = `# Revision instruction\n\n${instruction}\n`;
  t +=
    `\n# Existing article — revise THIS. Output the FULL revised article in SUMO WikiMarkup. ` +
    `Preserve content that is still correct, and keep existing protected tokens ({for}, {note}, ` +
    `[[Image:...]], templates, internal links) intact unless the instruction requires changing them.\n\n` +
    `${existingWiki}\n`;

  if (sources.length > 0) {
    const body = sources.map((s) => `## Source: ${s.label}\n\n${s.text}`).join("\n\n");
    t += `\n# New source material (ground new facts in these; do not invent specifics)\n\n${body}\n`;
  }
  if (references.length > 0) {
    const body = references.map((r) => `## Reference: ${r.label}\n\n${r.text}`).join("\n\n");
    t += `\n# Reference articles (style/structure/cross-links — do NOT copy)\n\n${body}\n`;
  }
  return t;
}

export async function runRevise(existing: string, options: ReviseOptions): Promise<void> {
  if (!options.instruction || !options.instruction.trim()) {
    throw new Error('Provide --instruction, e.g. revise <article> --instruction "update for Thunderbird 128".');
  }

  const corpus = await loadStyleCorpus();
  const conventions = await loadConventions();
  const system = buildSystemBlocks(corpus, conventions);

  const base = await loadExistingWiki(existing);
  if (base.note) console.warn(`Note: existing article loaded from ${base.note}`);

  const sources = await loadSources(options.source ?? []);
  const references = await loadSources(options.reference ?? []);
  const userText = buildReviseText(options.instruction, base.wiki, sources.texts, references.texts);
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
    console.log(`Existing article: ${base.wiki.length} chars${base.title ? ` ("${base.title}")` : ""}`);
    console.log(
      `Sources: ${sources.texts.length} text + ${sources.media.length} media  |  ` +
        `References: ${references.texts.length} text + ${references.media.length} media`,
    );
    console.log(`\n----- user text (truncated) -----\n${userText.slice(0, 2500)}`);
    return;
  }

  const streamProgress = Boolean(options.doc || options.out);
  console.log(`Revising with ${options.model}…${streamProgress ? "\n" : ""}`);
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
    "⚠️ AI-revised DRAFT — review every change and {note}TODO before publishing. SUMO is the source of truth.",
    base.title ?? "Revised SUMO article",
  );
}
