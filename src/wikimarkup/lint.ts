// Lint the WikiMarkup coming back OUT of a Google Doc (issue #2, part 2).
//
// Warn, never rewrite: this catches mistakes however the token got into the Doc —
// hand-typed, pasted from the header palette, or left behind by a draft — at the one
// moment they matter, which is just before a human pastes the markup into SUMO.
// Everything here is heuristic, so it is advisory text, not a gate.
//
// Split in two (issue #4). `lintDoc` holds everything with no equivalent elsewhere: the
// Google Doc staging surface and this tool's workflow, which sumo-linter never sees, plus
// the unknown-`{token}`-name check, which its SW rules do not cover either. `lintWikiText`
// holds only what sumo-linter does properly — SW001-003, on lexed tokens instead of
// regex counting — and runs as a fallback when its binary is not installed. See
// src/sumoLint.ts.

/** The complete `{token}` vocabulary of the SUMO markup chart (see prompts/sumo-style). */
const KNOWN_TOKENS = new Set(["for", "note", "warning", "key", "menu", "button", "filepath", "pref"]);

/**
 * A `{name}` / `{name arg}` / `{/name}` token: the name must be lowercase and the brace
 * must close on the same line. Deliberately narrow so that code or CSS inside a
 * protected block (`{ "manifest_version": 2 }`, `{color: red}`) cannot match.
 */
const TOKEN_RE = /\{(\/?)([a-z][a-z0-9]*)(\s[^}\n]*)?\}/g;

interface Pair {
  open: RegExp;
  openLabel: string;
  close: RegExp;
  closeLabel: string;
}

/**
 * `[[UI:details_start]]`/`_end` are ordinary internal links to Kitsune and to sumo-linter,
 * so nothing else checks that they balance — but an unclosed one leaves a collapsible
 * section open for the rest of the article (it is how the pre-refactor custom-OAuth source
 * ended at depth 2, see DECISIONS.md).
 */
const DOC_PAIRS: Pair[] = [
  {
    openLabel: "[[UI:details_start]]",
    open: /\[\[UI:details_start\]\]/gi,
    closeLabel: "[[UI:details_end]]",
    close: /\[\[UI:details_end\]\]/gi,
  },
];

/** Superseded by sumo-linter's SW001-003, which use a token stack (issue #4). */
const TEXT_PAIRS: Pair[] = [
  { openLabel: "{note}", open: /\{note\}/g, closeLabel: "{/note}", close: /\{\/note\}/g },
  {
    openLabel: "{warning}",
    open: /\{warning\}/g,
    closeLabel: "{/warning}",
    close: /\{\/warning\}/g,
  },
  { openLabel: "{for}", open: /\{for\b[^}]*\}/g, closeLabel: "{/for}", close: /\{\/for\}/g },
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

/**
 * Blank the interior of the regions Kitsune does not interpret as markup, preserving
 * length and newlines so every reported line number still lines up.
 *
 * The membership of this set is not obvious and is taken from sumo-linter's `OPAQUE`
 * (`crates/sumo-wiki-core/src/lexer.rs`), which settled it by diffing against Kitsune's
 * own rendered output: comments, `<nowiki>`, `<pre>`, and any line beginning with a
 * space. **`<code>` is deliberately not in it** — Kitsune consumes a `{/note}` sitting
 * inside a `<code>` span as a real closer, so blanking code spans would delete real
 * markup and invent "unclosed note" errors (their words, and their earlier bug).
 * Wiki tables are not blanked either: markup inside their cells is interpreted.
 */
function blankOpaque(wiki: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return wiki
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<nowiki>[\s\S]*?<\/nowiki>/gi, blank)
    .replace(/<pre>[\s\S]*?<\/pre>/gi, blank)
    .replace(/^[ \t]+.*$/gm, blank);
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

function pairWarnings(wiki: string, pairs: Pair[]): string[] {
  const out: string[] = [];
  for (const { open, openLabel, close, closeLabel } of pairs) {
    const opens = count(wiki, open);
    const closes = count(wiki, close);
    if (opens !== closes) {
      out.push(
        `Unbalanced ${openLabel}: ${opens} opening vs ${closes} ${closeLabel} — SUMO ` +
          "will mis-render everything after the missing half.",
      );
    }
  }
  return out;
}

/**
 * The always-on checks: the Google Doc staging surface (highlighted runs) and this tool's
 * own workflow leftovers. None of it overlaps sumo-linter, so it runs unconditionally.
 */
export function lintDoc({ wiki, highlighted = [] }: LintInput): string[] {
  const markup = blankOpaque(wiki);
  const warnings = pairWarnings(markup, DOC_PAIRS);

  // Token names outside the markup chart — usually a typo ({not}, {waring}). Kept here
  // rather than in the fallback: sumo-linter has no rule for an unknown macro name.
  const unknown = new Map<string, number>();
  for (const m of markup.matchAll(TOKEN_RE)) {
    const name = m[2];
    if (KNOWN_TOKENS.has(name) || unknown.has(name)) continue;
    unknown.set(name, lineOf(markup, m.index!));
  }
  for (const [name, line] of unknown) {
    warnings.push(
      `Unknown token {${name}} (line ${line}) — not in the SUMO markup chart, which has ` +
        `only ${[...KNOWN_TOKENS].map((t) => `{${t}}`).join(", ")}.`,
    );
  }

  // Highlighted prose — emitted raw, with any formatting inside it lost.
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

  // Unresolved draft placeholders and TODOs — these publish as visible junk.
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

/**
 * Fallback for sumo-linter's SW001-003: counting openers against closers, which reports a
 * per-file imbalance where its token stack would name the offending token. Only called
 * when the sumo-lint binary is missing (issue #4).
 */
export function lintWikiText(wiki: string): string[] {
  return pairWarnings(blankOpaque(wiki), TEXT_PAIRS);
}
