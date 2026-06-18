// Load and normalize `--source` inputs for generation (D16). Text-like sources
// become labeled text; PDFs and images become Claude-native content blocks.

import { promises as fs } from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { fetchArticle } from "./sumo.js";
import { fetchPageHtml } from "./browser.js";
import { htmlToText } from "./html.js";

export interface LoadedSources {
  texts: { label: string; text: string }[];
  media: Anthropic.ContentBlockParam[]; // pdf (document) + image blocks
}

const IMAGE_MEDIA: Record<string, "image/png" | "image/jpeg" | "image/gif" | "image/webp"> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const SUMO_KB = /^https?:\/\/support\.mozilla\.org\/[a-z]{2}-[A-Z]{2}\/kb\/([^/?#]+)/i;

async function loadOne(ref: string, out: LoadedSources): Promise<void> {
  // Remote sources
  if (/^https?:\/\//i.test(ref)) {
    const sumo = SUMO_KB.exec(ref);
    if (sumo) {
      const art = await fetchArticle(sumo[1]);
      out.texts.push({ label: `SUMO article: ${art.title} (rendered)`, text: htmlToText(art.html) });
    } else {
      out.texts.push({ label: `Web page: ${ref}`, text: htmlToText(await fetchPageHtml(ref)) });
    }
    return;
  }

  // A bare SUMO slug (no extension, no path separators)
  if (!ref.includes("/") && !ref.includes(".")) {
    const art = await fetchArticle(ref);
    out.texts.push({ label: `SUMO article: ${art.title} (rendered)`, text: htmlToText(art.html) });
    return;
  }

  // Local file
  const ext = path.extname(ref).toLowerCase();
  if ([".txt", ".md", ".markdown", ".wiki"].includes(ext)) {
    out.texts.push({ label: path.basename(ref), text: await fs.readFile(ref, "utf8") });
  } else if (ext === ".html" || ext === ".htm") {
    out.texts.push({ label: path.basename(ref), text: htmlToText(await fs.readFile(ref, "utf8")) });
  } else if (ext === ".pdf") {
    const data = (await fs.readFile(ref)).toString("base64");
    out.media.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
      title: path.basename(ref),
    });
  } else if (ext in IMAGE_MEDIA) {
    const data = (await fs.readFile(ref)).toString("base64");
    out.media.push({ type: "image", source: { type: "base64", media_type: IMAGE_MEDIA[ext], data } });
  } else {
    throw new Error(
      `Unsupported source "${ref}". Supported: .txt .md .wiki .html .pdf .png .jpg .gif .webp, ` +
        `a SUMO slug or URL, or any http(s):// page.`,
    );
  }
}

export async function loadSources(refs: string[]): Promise<LoadedSources> {
  const out: LoadedSources = { texts: [], media: [] };
  for (const ref of refs) await loadOne(ref, out);
  return out;
}
