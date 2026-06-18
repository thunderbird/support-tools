// Read-only client for the SUMO KB API.
// NOTE 1: this endpoint returns RENDERED HTML, not wiki source (see docs/DECISIONS.md, Bucket 0).
// NOTE 2: the host is behind a bot challenge, so reads go through a headless browser (browser.ts).

import { fetchJson } from "./browser.js";

export interface SumoArticle {
  id: number;
  title: string;
  slug: string;
  url: string;
  locale: string;
  products: string[];
  topics: string[];
  summary: string;
  html: string;
}

const API_BASE = "https://support.mozilla.org/api/1/kb";

/**
 * Fetch a single KB article by slug. `locale` is passed through to the API;
 * if the article doesn't exist in that locale the API typically falls back to
 * en-US, which we surface as a warning.
 */
export async function fetchArticle(slug: string, locale = "en-US"): Promise<SumoArticle> {
  const url = `${API_BASE}/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`;
  const data = await fetchJson<SumoArticle>(url);
  if (data.locale && data.locale !== locale) {
    console.warn(
      `Warning: requested locale "${locale}" but API returned "${data.locale}". ` +
        `The article may not exist in the requested locale.`,
    );
  }
  return data;
}
