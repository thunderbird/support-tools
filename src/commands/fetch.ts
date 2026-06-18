// `sumo fetch <slug>` — pull a SUMO KB article into a new Google Doc.
// This is the Bucket 1 read path and the fallback (a) edit path. See docs/DECISIONS.md.

import { fetchArticle, type SumoArticle } from "../sumo.js";
import { authorize } from "../google/auth.js";
import { createDocFromHtml } from "../google/drive.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A traceability banner so a staged Doc always points back to its SUMO source. */
function buildHeader(article: SumoArticle, fetchedAt: string): string {
  const sumoUrl = `https://support.mozilla.org${article.url}`;
  return [
    `<p><strong>⚠️ Draft staged from SUMO — SUMO is the source of truth, not this Doc.</strong></p>`,
    `<table>`,
    `<tr><td>Source slug</td><td>${escapeHtml(article.slug)}</td></tr>`,
    `<tr><td>SUMO URL</td><td><a href="${sumoUrl}">${sumoUrl}</a></td></tr>`,
    `<tr><td>Locale</td><td>${escapeHtml(article.locale)}</td></tr>`,
    `<tr><td>Fetched</td><td>${fetchedAt}</td></tr>`,
    `</table>`,
    `<hr/>`,
  ].join("");
}

export async function runFetch(slug: string, options: { locale: string }): Promise<void> {
  console.log(`Fetching "${slug}" (${options.locale}) from SUMO…`);
  const article = await fetchArticle(slug, options.locale);

  const fetchedAt = new Date().toISOString();
  const docHtml = `<h1>${escapeHtml(article.title)}</h1>${buildHeader(article, fetchedAt)}${article.html}`;

  console.log(`Authorizing with Google…`);
  const auth = await authorize();

  console.log(`Creating Google Doc "${article.title}"…`);
  const doc = await createDocFromHtml(auth, article.title, docHtml);

  console.log(`\n✅ Created Google Doc:\n   ${doc.url}`);
}
