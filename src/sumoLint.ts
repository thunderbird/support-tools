// Bridge to sumo-linter (https://github.com/thunderbird/sumo-linter) — issue #4.
//
// It lints the same WikiMarkup we emit, but properly: a real lexer that seals
// `<code>`/`<nowiki>` into opaque regions, then rules over the token stream. That makes
// it strictly better than our own regex counting at the one thing both do (unclosed
// `{note}`/`{warning}`/`{for}`), and it adds checks we never had — unbalanced `'''`,
// mismatched heading `=` runs, unknown `[[Image:]]` parameters, unmatched `[[`, empty
// list items, and Markdown syntax leaking into wiki source (a plausible failure in a
// Claude draft).
//
// So: delegate the wiki-text rules to it, keep only the Doc/workflow checks of our own
// (see lintDoc in wikimarkup/lint.ts). It is an optional dependency — if the binary is
// not installed we fall back to the weaker built-in checks rather than to nothing.
//
// Warn-only, deliberately: `--fix` and `--style` exist but rewriting the editor's markup
// behind their back is exactly what D26 says not to do.

import { spawn } from "node:child_process";
import { lintWikiText } from "./wikimarkup/lint.js";

/** One diagnostic from `sumo-lint --format json`. */
interface SumoLintDiagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  severity: string;
  message: string;
  fixable: boolean;
}

export interface WikiTextLint {
  warnings: string[];
  /** Which engine produced them — reported so a missing binary is visible, not silent. */
  engine: "sumo-lint" | "built-in";
  /** Set when the binary ran but misbehaved (bad usage, unparseable output). */
  error?: string;
}

const BIN = process.env.SUMO_LINT_BIN ?? "sumo-lint";

const INSTALL_HINT =
  "sumo-lint not found — using the weaker built-in checks. For lexer-based linting " +
  "(bold balance, heading levels, [[Image:]] parameters, Markdown syntax) install " +
  "https://github.com/thunderbird/sumo-linter, or set SUMO_LINT_BIN.";

/**
 * Run `sumo-lint --format json -` over `wiki` on stdin.
 *
 * Resolves to `undefined` when the binary is not installed, which is a normal state, not
 * an error. Exit code 1 means "found errors" and is expected; only 2 (bad usage) is a
 * real failure.
 */
function runSumoLint(wiki: string): Promise<SumoLintDiagnostic[] | undefined> {
  return new Promise((resolve, reject) => {
    const child = spawn(BIN, ["--format", "json", "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";

    child.on("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") resolve(undefined);
      else reject(e);
    });
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));

    child.on("close", (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`${BIN} exited ${code}${err.trim() ? `: ${err.trim()}` : ""}`));
        return;
      }
      let parsed: SumoLintDiagnostic[];
      try {
        parsed = JSON.parse(out.trim() || "[]") as SumoLintDiagnostic[];
      } catch {
        reject(new Error(`could not parse ${BIN} output as JSON`));
        return;
      }
      // Exit 1 means "at least one error-level diagnostic", so an empty array with it is
      // contradictory — most likely SUMO_LINT_BIN points at something that is not
      // sumo-lint. Fail loudly rather than reporting a false all-clear.
      if (code === 1 && parsed.length === 0) {
        reject(new Error(`${BIN} exited 1 but reported no diagnostics`));
        return;
      }
      resolve(parsed);
    });

    // The markup can be long; ignore EPIPE if the child bails out early.
    child.stdin.on("error", () => {});
    child.stdin.end(wiki);
  });
}

function format(d: SumoLintDiagnostic): string {
  return `line ${d.line}:${d.column} ${d.severity} [${d.code}] ${d.message}`;
}

/**
 * Lint the wiki text we are about to hand over, preferring sumo-linter and degrading to
 * the built-in regex checks when it is not installed.
 *
 * The Doc-specific checks (highlighted prose, `[[UI:details_start]]` balance, leftover
 * placeholders and TODOs) are NOT here — they run unconditionally in `lintDoc`.
 */
export async function lintWikiSource(wiki: string): Promise<WikiTextLint> {
  let diagnostics: SumoLintDiagnostic[] | undefined;
  try {
    diagnostics = await runSumoLint(wiki);
  } catch (e) {
    return {
      warnings: lintWikiText(wiki),
      engine: "built-in",
      error: e instanceof Error ? e.message : String(e),
    };
  }
  if (!diagnostics) return { warnings: lintWikiText(wiki), engine: "built-in" };
  return { warnings: diagnostics.map(format), engine: "sumo-lint" };
}

/** Print both lint passes as one section. Prints nothing when everything is clean. */
export function printLint(heading: string, docWarnings: string[], text: WikiTextLint): void {
  const all = [...docWarnings, ...text.warnings];
  if (all.length) {
    console.warn(`\n${heading}`);
    for (const w of all) console.warn(`  - ${w}`);
  }
  if (text.error) console.warn(`\n⚠️  ${BIN} could not be run (${text.error}) — used built-in checks.`);
  else if (text.engine === "built-in") console.warn(`\nℹ️  ${INSTALL_HINT}`);
}
