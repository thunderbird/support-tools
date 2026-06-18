// Convert SUMO WikiMarkup -> HTML using the "Readable + protected tokens" strategy (D9).
//
//   * Reversible constructs (headings, bold, italic, lists, external links, whitelisted
//     inline HTML) become real HTML so the Google Doc reads cleanly.
//   * Irreversible / wiki-specific constructs are preserved VERBATIM as visually-marked
//     "protected tokens" so the round-trip back to WikiMarkup (Bucket 3) loses nothing.
//
// Guiding rule: never transform anything we can't reverse exactly.

export interface WikiConversionReport {
  protectedByKind: Record<string, number>;
  totalProtected: number;
}

export interface WikiConversionResult {
  html: string;
  report: WikiConversionReport;
}

// Private-use sentinels delimit placeholders; they never appear in real source.
const PH_OPEN = String.fromCharCode(0xe000);
const PH_CLOSE = String.fromCharCode(0xe001);

interface ProtectedItem {
  kind: string;
  raw: string;
}

// Atomic / irreversible constructs, preserved verbatim. ORDER MATTERS: Image and
// Template must be matched before the generic internal-link pattern.
const INLINE_PROTECTED: { kind: string; re: RegExp }[] = [
  { kind: "for", re: /\{for\b[^}]*\}|\{\/for\}/g },
  { kind: "note", re: /\{\/?note\}/g },
  { kind: "warning", re: /\{\/?warning\}/g },
  { kind: "key", re: /\{key\b[^}]*\}/g },
  { kind: "menu", re: /\{menu\b[^}]*\}/g },
  { kind: "button", re: /\{button\b[^}]*\}/g },
  { kind: "filepath", re: /\{filepath\b[^}]*\}/g },
  { kind: "pref", re: /\{pref\b[^}]*\}/g },
  { kind: "image", re: /\[\[Image:[^\]]*\]\]/gi },
  { kind: "template", re: /\[\[(?:Template|Include):[^\]]*\]\]/gi },
  { kind: "internal-link", re: /\[\[[^\]]*\]\]/g },
  { kind: "magic-word", re: /__[A-Z]+__/g }, // __TOC__, __NOTOC__, etc.
];

// Inline HTML tags authored directly in wiki source that we let through unescaped.
const WHITELIST_TAGS = "u|code|s|del|sub|sup|blockquote|br";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeWhitelistedTags(s: string): string {
  return s.replace(
    new RegExp(`&lt;(/?)(${WHITELIST_TAGS})\\s*(/?)&gt;`, "gi"),
    (_m, slash: string, tag: string, selfClose: string) => `<${slash}${tag}${selfClose}>`,
  );
}

function protectedSpan(raw: string): string {
  // Highlighted monospace so editors see "don't hand-edit this" — and Bucket 3 can
  // read the verbatim source straight back out.
  return (
    `<span style="background-color:#fff2cc;font-family:'Courier New',monospace">` +
    `${escapeHtml(raw)}</span>`
  );
}

/** Inline formatting on already-escaped text (placeholders pass through untouched). */
function inline(s: string): string {
  return s
    .replace(/'''''(.+?)'''''/g, "<strong><em>$1</em></strong>")
    .replace(/'''(.+?)'''/g, "<strong>$1</strong>")
    .replace(/''(.+?)''/g, "<em>$1</em>")
    .replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1">$2</a>')
    .replace(/\[(https?:\/\/[^\s\]]+)\]/g, '<a href="$1">$1</a>');
}

// Explicit list-style-type so Google Drive's HTML importer preserves ordered vs.
// bulleted (without it, both import as GLYPH_TYPE_UNSPECIFIED and the distinction is lost).
function openTag(t: "ol" | "ul"): string {
  return t === "ol"
    ? `<ol type="1" style="list-style-type:decimal">`
    : `<ul style="list-style-type:disc">`;
}

/** Build (optionally nested) lists from a run of `#`/`*`-prefixed lines. */
function buildList(items: string[]): string {
  let html = "";
  const stack: ("ol" | "ul")[] = []; // list type per open level
  for (const item of items) {
    const m = /^([#*]+)\s?(.*)$/.exec(item);
    if (!m) continue;
    const prefix = m[1];
    const content = m[2];
    const depth = prefix.length;

    while (stack.length > depth) html += `</${stack.pop()}>`;
    while (stack.length < depth) {
      const t: "ol" | "ul" = prefix[stack.length] === "#" ? "ol" : "ul";
      html += openTag(t);
      stack.push(t);
    }
    const wantType: "ol" | "ul" = prefix[depth - 1] === "#" ? "ol" : "ul";
    if (stack[depth - 1] !== wantType) {
      html += `</${stack.pop()}>`;
      html += openTag(wantType);
      stack.push(wantType);
    }
    html += `<li>${inline(content)}</li>`;
  }
  while (stack.length) html += `</${stack.pop()}>`;
  return html;
}

/** Block-level parse: headings, lists, rules, paragraphs. */
function parseBlocks(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let i = 0;

  const flushPara = () => {
    if (para.length) {
      // Kitsune joins a single newline into flowing text, so join lines with a space
      // (a hard break needs an explicit <br> in the source). See docs/DECISIONS.md O5.
      out.push(`<p>${para.map(inline).join(" ")}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      flushPara();
      i++;
      continue;
    }

    const h = /^(={1,6})\s*(.*?)\s*\1$/.exec(trimmed);
    if (h) {
      flushPara();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    if (/^----+$/.test(trimmed)) {
      flushPara();
      out.push("<hr>");
      i++;
      continue;
    }

    if (/^[#*]+\s?/.test(trimmed)) {
      flushPara();
      const run: string[] = [];
      while (i < lines.length && /^[#*]+\s?/.test(lines[i].trim())) {
        run.push(lines[i].trim());
        i++;
      }
      out.push(buildList(run));
      continue;
    }

    para.push(trimmed);
    i++;
  }
  flushPara();
  return out.join("\n");
}

export function wikiToHtml(source: string): WikiConversionResult {
  const items: ProtectedItem[] = [];
  const report: WikiConversionReport = { protectedByKind: {}, totalProtected: 0 };

  const store = (kind: string, raw: string): string => {
    const idx = items.length;
    items.push({ kind, raw });
    report.protectedByKind[kind] = (report.protectedByKind[kind] ?? 0) + 1;
    report.totalProtected++;
    return `${PH_OPEN}${idx}${PH_CLOSE}`;
  };

  let text = source.replace(/\r\n?/g, "\n");

  // 1) Protect whole wiki tables verbatim ({| ... |}).
  text = text.replace(/^\{\|[\s\S]*?^\|\}/gm, (m) => store("table", m));

  // 1b) Protect leading definition-list / indent markers (`;`/`:` at line start),
  //     verbatim — they carry no reversible visual equivalent (D9).
  text = text.replace(/^[;:]+/gm, (m) => store("indent", m));

  // 2) Protect inline atomic constructs (order matters).
  for (const { kind, re } of INLINE_PROTECTED) {
    text = text.replace(re, (m) => store(kind, m));
  }

  // 3) Escape remaining literal text; placeholders (PUA chars) are unaffected.
  text = escapeHtml(text);

  // 4) Re-enable whitelisted inline HTML tags authored in source.
  text = unescapeWhitelistedTags(text);

  // 5) Block-level structure.
  let html = parseBlocks(text);

  // 6) Restore protected tokens as verbatim, visually-marked spans.
  html = html.replace(
    new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, "g"),
    (_m, d: string) => protectedSpan(items[Number(d)].raw),
  );

  return { html, report };
}
