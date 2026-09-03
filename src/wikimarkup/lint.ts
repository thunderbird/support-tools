// Lint the WikiMarkup coming back OUT of a Google Doc (issue #2, part 2).
//
// Warn, never rewrite: this catches mistakes however the token got into the Doc —
// hand-typed, pasted from the header palette, or left behind by a draft — at the one
// moment they matter, which is just before a human pastes the markup into SUMO.
// Everything here is heuristic, so it is advisory text, not a gate.

/** The complete `{token}` vocabulary of the SUMO markup chart (see prompts/sumo-style). */
const KNOWN_TOKENS = new Set(["for", "note", "warning", "key", "menu", "button", "filepath", "pref"]);

/**
 * A `{name}` / `{name arg}` / `{/name}` token: the name must be lowercase and the brace
 * must close on the same line. Deliberately narrow so that code or CSS inside a
 * protected block (`{ "manifest_version": 2 }`, `{color: red}`) cannot match.
 */
const TOKEN_RE = /\{(\/?)([a-z][a-z0-9]*)(\s[^}\n]*)?\}/g;

/** Paired constructs whose halves must come in equal numbers. */
const PAIRS: { open: RegExp; openLabel: string; close: RegExp; closeLabel: string }[] = [
  { openLabel: "{note}", open: /\{note\}/g, closeLabel: "{/note}", close: /\{\/note\}/g },
  {
    openLabel: "{warning}",
    open: /\{warning\}/g,
    closeLabel: "{/warning}",
    close: /\{\/warning\}/g,
  },
  { openLabel: "{for}", open: /\{for\b[^}]*\}/g, closeLabel: "{/for}", close: /\{\/for\}/g },
  {
    openLabel: "[[UI:details_start]]",
    open: /\[\[UI:details_start\]\]/gi,
    closeLabel: "[[UI:details_end]]",
    close: /\[\[UI:details_end\]\]/gi,
  },
];

/** Anything that reads as wiki source rather than prose. */
const MARKUP_ISH = /\{[^}\n]*\}|\[\[|\]\]|__[A-Z]+__|<!--|<\/?code>|^\s*[|!:;]/;

/** Openers/closers of the blocks whose inner lines are arbitrary text, not markup. */
const BLOCK_EDGES: { open: RegExp; close: RegExp }[] = [
  { open: /^\s*<code>/, close: /<\/code>/ },
  { open: /^\s*\{\|/, close: /^\s*\|\}/ },
];

export interface LintInput {
  /** The article body WikiMarkup, metadata header already stripped. */
  wiki: string;
  /** Text of every highlighted (protected) run in the body, in document order. */
  highlighted?: string[];
}

function count(s: string, re: RegExp): number {
  return (s.match(re) ?? []).length;
}

function lineOf(wiki: string, index: number): number {
  return wiki.slice(0, index).split("\n").length;
}

function excerpt(s: string, max = 60): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/**
 * Highlighted runs that are not wiki source at all — the "I highlighted a sentence so
 * my reviewer would see it" trap. Such a run is emitted verbatim (any bold, italics or
 * link inside it is silently dropped) and would publish as raw text.
 *
 * Lines inside a protected `<code>` block or wiki table are arbitrary by design (D21),
 * so the check is suppressed between a block's opener and its closer.
 */
function proseHighlights(runs: string[]): string[] {
  const hits: string[] = [];
  let closeOf: RegExp | undefined;

  for (const run of runs) {
    // cleanContent has already turned in-paragraph breaks into <br>, so this is flat text.
    const text = run;
    if (closeOf) {
      if (closeOf.test(text)) closeOf = undefined;
      continue;
    }
    const edge = BLOCK_EDGES.find((b) => b.open.test(text));
    if (edge) {
      // A one-line `<code>x</code>` or `{| … |}` opens and closes in the same run.
      if (!edge.close.test(text.replace(edge.open, ""))) closeOf = edge.close;
      continue;
    }
    if (text.trim() === "" || MARKUP_ISH.test(text)) continue;
    hits.push(excerpt(text));
  }
  return hits;
}

/** Advisory warnings about markup that would misbehave (or embarrass) once published. */
export function lintWikiMarkup({ wiki, highlighted = [] }: LintInput): string[] {
  const warnings: string[] = [];

  // 1) Unbalanced pairs — the failure that breaks everything after it on SUMO.
  for (const { open, openLabel, close, closeLabel } of PAIRS) {
    const opens = count(wiki, open);
    const closes = count(wiki, close);
    if (opens !== closes) {
      warnings.push(
        `Unbalanced ${openLabel}: ${opens} opening vs ${closes} ${closeLabel} — SUMO ` +
          "will mis-render everything after the missing half.",
      );
    }
  }

  // 2) Token names outside the markup chart — usually a typo ({not}, {waring}).
  const unknown = new Map<string, number>();
  for (const m of wiki.matchAll(TOKEN_RE)) {
    const name = m[2];
    if (KNOWN_TOKENS.has(name) || unknown.has(name)) continue;
    unknown.set(name, lineOf(wiki, m.index!));
  }
  for (const [name, line] of unknown) {
    warnings.push(
      `Unknown token {${name}} (line ${line}) — not in the SUMO markup chart, which has ` +
        `only ${[...KNOWN_TOKENS].map((t) => `{${t}}`).join(", ")}.`,
    );
  }

  // 3) Highlighted prose — emitted raw, with any formatting inside it lost.
  const prose = proseHighlights(highlighted);
  for (const hit of prose.slice(0, 3)) {
    warnings.push(
      `Highlighted text that is not wiki markup: "${hit}" — a highlight means "publish ` +
        'verbatim", so this goes out as raw text and any bold/italic/link inside it is ' +
        "dropped. Use a Google Docs comment for review notes instead.",
    );
  }
  if (prose.length > 3) {
    warnings.push(`…and ${prose.length - 3} more highlighted run(s) that are not wiki markup.`);
  }

  // 4) Unresolved draft placeholders and TODOs — these publish as visible junk.
  for (const m of wiki.matchAll(/\[\[Image:\s*PLACEHOLDER[^\]]*\]\]/gi)) {
    warnings.push(
      `Unresolved ${excerpt(m[0])} (line ${lineOf(wiki, m.index!)}) — no such image in ` +
        "the SUMO gallery, so it would not render. Replace it or delete the token.",
    );
  }

  for (const m of wiki.matchAll(/\{note\}\s*TODO/gi)) {
    warnings.push(
      `{note}TODO still present (line ${lineOf(wiki, m.index!)}) — resolve it before ` +
        "publishing; a {note} renders as a visible callout on SUMO.",
    );
  }

  for (const m of wiki.matchAll(/<!--\s*TODO \(sumo-kb-tools\)[\s\S]*?-->/g)) {
    warnings.push(
      `A tool TODO comment is still in the markup (line ${lineOf(wiki, m.index!)}) — act ` +
        'on it (e.g. restore the "#*" sub-markers, D23), then delete the comment.',
    );
  }

  return warnings;
}
