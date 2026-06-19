// Load an existing article's WikiMarkup from various sources, for `revise` and `publish`.
//   - .wiki/.txt file        → as-is (best fidelity)
//   - Google Doc URL or id   → to-markup (docToWikiMarkup)
//   - SUMO slug or KB URL    → rendered HTML → text (lossy fallback, D3)

import { promises as fs } from "node:fs";
import path from "node:path";
import { authorize } from "./google/auth.js";
import { getDocument } from "./google/docs.js";
import { docToWikiMarkup } from "./wikimarkup/fromDoc.js";
import { parseDocId } from "./commands/toMarkup.js";
import { fetchArticle } from "./sumo.js";
import { htmlToText } from "./html.js";

export interface ExistingArticle {
  wiki: string;
  title?: string;
  note?: string; // set when loaded via a lossy path
}

const SUMO_KB = /^https?:\/\/support\.mozilla\.org\/[a-z]{2}-[A-Z]{2}\/kb\/([^/?#]+)/i;
const LOSSY = "rendered HTML (lossy — paste the .wiki source for full fidelity)";

export async function loadExistingWiki(ref: string): Promise<ExistingArticle> {
  // Google Doc (URL or bare id)
  if (/docs\.google\.com|\/document\/d\//.test(ref) || /^[A-Za-z0-9_-]{30,}$/.test(ref)) {
    const auth = await authorize();
    const doc = await getDocument(auth, parseDocId(ref));
    const { wiki } = docToWikiMarkup(doc);
    return { wiki, title: doc.title ?? undefined };
  }

  // SUMO KB article URL
  const sumo = SUMO_KB.exec(ref);
  if (sumo) {
    const art = await fetchArticle(sumo[1]);
    return { wiki: htmlToText(art.html), title: art.title, note: LOSSY };
  }
  if (/^https?:\/\//i.test(ref)) {
    throw new Error("Only SUMO KB article URLs or Google Doc URLs are supported here.");
  }

  // Local .wiki / .txt
  const ext = path.extname(ref).toLowerCase();
  if (ext === ".wiki" || ext === ".txt") {
    return { wiki: await fs.readFile(ref, "utf8") };
  }

  // Bare SUMO slug
  if (!ref.includes("/") && !ref.includes(".")) {
    const art = await fetchArticle(ref);
    return { wiki: htmlToText(art.html), title: art.title, note: LOSSY };
  }

  throw new Error(`Cannot load "${ref}". Use a .wiki file, a SUMO slug/URL, or a Google Doc URL/id.`);
}
