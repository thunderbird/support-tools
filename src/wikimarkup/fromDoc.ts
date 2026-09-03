// Convert a Google Docs API document -> SUMO WikiMarkup (the reverse of toHtml.ts).
//
// Round-trip design (see D9): protected tokens were stored as their LITERAL wiki text
// in highlighted runs, so here we emit highlighted runs verbatim and only translate
// real formatting (headings, bold/italic, lists, links, code, underline) back to wiki.

import type { docs_v1 } from "googleapis";
import { CONTENT_MARKER } from "../constants.js";
import { lintWikiMarkup } from "./lint.js";

export interface DocConversionResult {
  wiki: string;
  warnings: string[];
}

/** A highlighted run = a protected wiki token; emit its content verbatim. */
function isProtected(style: docs_v1.Schema$TextStyle | undefined): boolean {
  return !!style?.backgroundColor;
}

function isMonospace(style: docs_v1.Schema$TextStyle | undefined): boolean {
  const fam = style?.weightedFontFamily?.fontFamily ?? "";
  return /courier|consolas|menlo|monaco|mono/i.test(fam);
}

// Strip the paragraph-ending newline; map in-paragraph soft breaks to <br>.
function cleanContent(s: string): string {
  return s.replace(/\u000B/g, "<br>").replace(/\n/g, "");
}

function renderRun(el: docs_v1.Schema$ParagraphElement, highlighted?: string[]): string {
  const tr = el.textRun;
  if (!tr || tr.content == null) return "";
  const content = cleanContent(tr.content);
  if (content === "") return "";
  const style = tr.textStyle ?? {};

  if (isProtected(style)) {
    highlighted?.push(content); // kept for the outbound lint (issue #2)
    return content; // verbatim wiki token
  }

  if (style.link?.url) {
    const url = style.link.url;
    return url === content.trim() ? `[${url}]` : `[${url} ${content}]`;
  }

  let out = content;
  if (isMonospace(style)) {
    out = `<code>${out}</code>`;
  } else if (style.bold && style.italic) {
    out = `'''''${out}'''''`;
  } else if (style.bold) {
    out = `'''${out}'''`;
  } else if (style.italic) {
    out = `''${out}''`;
  }
  if (style.underline) out = `<u>${out}</u>`;
  return out;
}

function paragraphText(p: docs_v1.Schema$Paragraph, highlighted?: string[]): string {
  return (p.elements ?? []).map((el) => renderRun(el, highlighted)).join("");
}

/**
 * A paragraph holding nothing but protected tokens — a structural line (`__TOC__`,
 * `[[UI:details_start]]`, `{for win}`) or one line of a verbatim block such as a
 * multi-line <code> block. The source had no blank line around it, so neither should
 * the output: these stay glued to the line above (D20).
 */
function isTokenOnly(p: docs_v1.Schema$Paragraph): boolean {
  let sawToken = false;
  for (const el of p.elements ?? []) {
    if (cleanContent(el.textRun?.content ?? "") === "") continue;
    if (!isProtected(el.textRun?.textStyle ?? undefined)) return false;
    sawToken = true;
  }
  return sawToken;
}

function rawParagraphText(p: docs_v1.Schema$Paragraph): string {
  return (p.elements ?? []).map((e) => e.textRun?.content ?? "").join("");
}

function listPrefix(
  p: docs_v1.Schema$Paragraph,
  lists: Record<string, docs_v1.Schema$List>,
): string {
  const level = p.bullet?.nestingLevel ?? 0;
  const listId = p.bullet?.listId ?? "";
  const levels = lists[listId]?.listProperties?.nestingLevels ?? [];

  // A glyphSymbol means a bullet; ordered lists carry a numeric glyphType or a
  // format like "%0." Some importers set one but not the other, so check both.
  const isOrdered = (nl: docs_v1.Schema$NestingLevel | undefined): boolean =>
    !nl?.glyphSymbol &&
    (/DECIMAL|ALPHA|ROMAN/i.test(nl?.glyphType ?? "") || /%/.test(nl?.glyphFormat ?? ""));

  // One marker per level, read from that level's own glyph — wiki writes the whole
  // ancestry (`#*` = bullet inside a numbered step), and a Doc's levels can differ.
  let prefix = "";
  for (let l = 0; l <= level; l++) prefix += isOrdered(levels[l]) ? "#" : "*";
  return prefix;
}

export function docToWikiMarkup(doc: docs_v1.Schema$Document): DocConversionResult {
  const warnings: string[] = [];
  // Every protected run in the body, so the lint can spot highlighted prose (issue #2).
  const highlighted: string[] = [];
  const content = doc.body?.content ?? [];
  const lists = (doc.lists ?? {}) as Record<string, docs_v1.Schema$List>;

  // Skip the metadata header: start after the content marker paragraph.
  let startIdx = 0;
  let found = false;
  for (let i = 0; i < content.length; i++) {
    const p = content[i].paragraph;
    if (p && rawParagraphText(p).trim() === CONTENT_MARKER) {
      startIdx = i + 1;
      found = true;
      break;
    }
  }
  if (!found) {
    warnings.push(
      "Content marker not found — converting the whole document. If a metadata header " +
        "is present, remove it from the output manually.",
    );
  }

  const lines: string[] = [];
  let inList = false;
  // Did we add the last blank line ourselves as a paragraph separator? (As opposed to it
  // coming from a real empty paragraph in the Doc, which stands for a source blank line.)
  let autoBlank = false;

  const endList = () => {
    if (inList) {
      lines.push("");
      inList = false;
      autoBlank = false;
    }
  };

  for (const el of content.slice(startIdx)) {
    if (el.table) {
      endList();
      warnings.push("A real Google Docs table was found and skipped — convert it by hand.");
      continue;
    }
    const p = el.paragraph;
    if (!p) continue;

    const text = paragraphText(p, highlighted);

    if (p.bullet) {
      lines.push(`${listPrefix(p, lists)} ${text}`.trimEnd());
      inList = true;
      continue;
    }
    endList();

    if (isTokenOnly(p)) {
      if (autoBlank && lines[lines.length - 1] === "") lines.pop();
      lines.push(text.trimEnd()); // leading indentation is significant inside <code>
      autoBlank = false;
      continue;
    }

    const named = p.paragraphStyle?.namedStyleType ?? "NORMAL_TEXT";
    const heading = /^HEADING_([1-6])$/.exec(named);
    if (heading) {
      const eq = "=".repeat(Number(heading[1]));
      lines.push(`${eq} ${text.trim()} ${eq}`, "");
      autoBlank = true;
    } else if (text.trim() !== "") {
      lines.push(text.trimEnd(), "");
      autoBlank = true;
    } else if (lines.length && lines[lines.length - 1] !== "") {
      lines.push("");
      autoBlank = false; // a real empty paragraph = a blank line the source had
    }
  }

  const wiki = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  warnings.push(...lintWikiMarkup({ wiki, highlighted }));
  return { wiki, warnings };
}
