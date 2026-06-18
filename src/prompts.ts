// Build the generation system prompt: output rules + accuracy guardrails, plus
// SUMO's own style articles as the style corpus (D14/D15).

import { promises as fs } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";

const STYLE_DIR = path.resolve(process.cwd(), "prompts", "sumo-style");
const CONVENTIONS_PATH = path.resolve(process.cwd(), "prompts", "thunderbird-conventions.md");

const OUTPUT_RULES = `You are an expert writer for the Mozilla Support (SUMO) Knowledge Base, writing Thunderbird help articles. Follow the official SUMO style guidance provided below.

Your task:
- Write an ORIGINAL article that fulfills the brief. Decide the structure, headings, and steps yourself based on the brief and SUMO conventions.
- "Source material" = facts to ground in. Synthesize from it in your own words; do not invent specifics beyond it.
- "Reference articles" = existing SUMO articles provided for style, structure, terminology, and cross-links. Follow their conventions and link to them where relevant, but NEVER copy or reproduce them — write fresh prose scoped to the brief.
- Do not reproduce any single input verbatim or near-verbatim.

Output rules:
- Output ONLY the article body in SUMO WikiMarkup. No code fences, no preamble, no closing commentary.
- Use SUMO WikiMarkup exactly as documented in the style guidance: "== Heading ==", "'''bold'''", "''italic''", numbered steps with "#", bulleted lists with "*", "{for win,mac,linux}...{/for}" for OS-specific content, "{note}...{/note}" and "{warning}...{/warning}", "{menu ...}", "{button ...}", "{key ...}", "{filepath ...}", "{pref ...}", "[[Image:placeholder]]", "[[Internal article link]]", and "__TOC__" for long articles.
- Follow SUMO conventions for structure, tone, and second-person voice as described in the writing guide.

Accuracy guardrails (critical — this is a help article people rely on):
- Ground every factual claim (menu paths, button labels, preference names, version numbers, UI behavior) in the provided source material. Do NOT invent specifics.
- Where a needed detail is missing or you are unsure, insert a visible "{note}TODO: <what the editor must verify>{/note}" instead of guessing.
- Insert "[[Image:PLACEHOLDER - <description of the screenshot needed>]]" wherever a screenshot would help, rather than describing an image you can't see.
- This is a draft for human review; it is better to flag a gap than to state something that might be wrong.`;

export async function loadStyleCorpus(): Promise<string> {
  let files: string[];
  try {
    files = (await fs.readdir(STYLE_DIR)).filter((f) => f.endsWith(".md") && f !== "INDEX.md").sort();
  } catch {
    throw new Error(`Style corpus not found at ${STYLE_DIR}. Run: npm run dev -- build-style`);
  }
  if (files.length === 0) {
    throw new Error(`Style corpus is empty at ${STYLE_DIR}. Run: npm run dev -- build-style`);
  }
  const parts: string[] = [];
  for (const f of files) parts.push(await fs.readFile(path.join(STYLE_DIR, f), "utf8"));
  return parts.join("\n\n---\n\n");
}

/** Project-owned house conventions that override generic SUMO guidance; "" if absent. */
export async function loadConventions(): Promise<string> {
  try {
    return (await fs.readFile(CONVENTIONS_PATH, "utf8")).trim();
  } catch {
    return "";
  }
}

/** System prompt as cacheable blocks: stable rules + house conventions first, large corpus cached. */
export function buildSystemBlocks(corpus: string, conventions: string): Anthropic.TextBlockParam[] {
  const rules = conventions
    ? `${OUTPUT_RULES}\n\n# Thunderbird house conventions (these OVERRIDE the general SUMO guidance below where they conflict)\n\n${conventions}`
    : OUTPUT_RULES;
  return [
    { type: "text", text: rules },
    {
      type: "text",
      text: `# Official SUMO Knowledge Base style guidance\n\n${corpus}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}
