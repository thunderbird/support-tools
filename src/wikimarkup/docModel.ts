// Parse the clean HTML produced by toHtml.ts into a structured document model.
// This is the bridge between the (tested) WikiMarkup→HTML converter and the Docs API
// builder — building Docs programmatically lets us preserve ordered-vs-bulleted lists,
// which Drive's HTML import cannot (see docs/DECISIONS.md D11).

import * as cheerio from "cheerio";

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  mono?: boolean; // <code> → monospace
  token?: boolean; // protected wiki token → highlighted monospace, verbatim
  link?: string;
}

export type Block =
  | { type: "heading"; level: number; runs: Run[] }
  | { type: "paragraph"; runs: Run[] }
  | { type: "listItem"; ordered: boolean; level: number; runs: Run[] }
  | { type: "hr" };

type CheerioApi = ReturnType<typeof cheerio.load>;

function inlineRuns(api: CheerioApi, el: unknown, skipLists = false): Run[] {
  const runs: Run[] = [];

  const visit = (node: any, style: Partial<Run>): void => {
    if (node.type === "text") {
      const d: string = node.data ?? "";
      if (d) runs.push({ text: d, ...style });
      return;
    }
    if (node.type !== "tag") return;
    const tag: string = node.name?.toLowerCase?.() ?? "";

    if (skipLists && (tag === "ul" || tag === "ol")) return;
    if (tag === "br") {
      runs.push({ text: String.fromCharCode(0x0b) }); // in-paragraph line break
      return;
    }
    if (tag === "a") {
      runs.push({ text: api(node).text(), link: api(node).attr("href") ?? "" });
      return;
    }
    if (tag === "span") {
      // toHtml wraps protected tokens in a styled <span>; emit the verbatim text.
      runs.push({ text: api(node).text(), token: true });
      return;
    }

    const next: Partial<Run> = { ...style };
    if (tag === "strong" || tag === "b") next.bold = true;
    else if (tag === "em" || tag === "i") next.italic = true;
    else if (tag === "u") next.underline = true;
    else if (tag === "code") next.mono = true;

    api(node)
      .contents()
      .each((_i: number, c: any) => visit(c, next));
  };

  api(el as any)
    .contents()
    .each((_i: number, c: any) => visit(c, {}));
  return runs;
}

function walkList(
  api: CheerioApi,
  listEl: any,
  ordered: boolean,
  level: number,
  blocks: Block[],
): void {
  api(listEl)
    .children()
    .each((_i: number, child: any) => {
      const tag: string = child.name?.toLowerCase?.() ?? "";
      if (tag === "li") {
        blocks.push({ type: "listItem", ordered, level, runs: inlineRuns(api, child, true) });
        // Nested lists may sit inside the <li> (semantic) — recurse.
        api(child)
          .children()
          .each((_j: number, sub: any) => {
            const st: string = sub.name?.toLowerCase?.() ?? "";
            if (st === "ul" || st === "ol") walkList(api, sub, st === "ol", level + 1, blocks);
          });
      } else if (tag === "ul" || tag === "ol") {
        // ...or as a sibling of <li> (how buildList emits nesting).
        walkList(api, child, tag === "ol", level + 1, blocks);
      }
    });
}

export function htmlToModel(html: string): Block[] {
  const api = cheerio.load(html);
  const blocks: Block[] = [];

  api("body")
    .children()
    .each((_i: number, el: any) => {
      const tag: string = el.name?.toLowerCase?.() ?? "";
      if (/^h[1-6]$/.test(tag)) {
        blocks.push({ type: "heading", level: Number(tag[1]), runs: inlineRuns(api, el) });
      } else if (tag === "p") {
        blocks.push({ type: "paragraph", runs: inlineRuns(api, el) });
      } else if (tag === "hr") {
        blocks.push({ type: "hr" });
      } else if (tag === "ul" || tag === "ol") {
        walkList(api, el, tag === "ol", 1, blocks);
      }
    });

  return blocks;
}
