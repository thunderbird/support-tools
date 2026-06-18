// Convert article/page HTML into readable plain text for use as LLM context
// (style corpus, .html sources, fetched web pages). Keeps headings, lists, and
// table rows legible without dragging along tags, scripts, or styling.

import * as cheerio from "cheerio";

type CheerioApi = ReturnType<typeof cheerio.load>;

function render(api: CheerioApi, node: any): string {
  if (node.type === "text") return node.data ?? "";
  if (node.type !== "tag") return "";

  const tag: string = node.name?.toLowerCase?.() ?? "";
  const inner = api(node)
    .contents()
    .map((_i: number, c: any) => render(api, c))
    .get()
    .join("");

  if (/^h[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${inner.trim()}\n\n`;
  switch (tag) {
    case "br":
      return "\n";
    case "li":
      return `\n- ${inner.trim()}`;
    case "tr":
      return `\n${api(node)
        .children()
        .map((_i: number, c: any) => api(c).text().trim())
        .get()
        .join(" | ")}`;
    case "p":
    case "div":
    case "section":
    case "ul":
    case "ol":
    case "table":
    case "blockquote":
    case "pre":
      return `\n${inner}\n`;
    case "a": {
      const href = api(node).attr("href");
      return href && !href.startsWith("#") ? `${inner} (${href})` : inner;
    }
    default:
      return inner;
  }
}

export function htmlToText(html: string): string {
  const api = cheerio.load(html);
  api("script,style,noscript").remove();
  const root = api("body").length ? api("body")[0] : api.root()[0];
  return render(api, root)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
