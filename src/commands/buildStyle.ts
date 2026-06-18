// `sumo build-style` — compile the SUMO KB style corpus used as the generation
// system prompt (D14). Discovers the style articles dynamically: the root
// `improve-knowledge-base` article plus every KB article it links to.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fetchArticle, extractKbSlugs } from "../sumo.js";
import { htmlToText } from "../html.js";

const ROOT_SLUG = "improve-knowledge-base";
const STYLE_DIR = path.resolve(process.cwd(), "prompts", "sumo-style");

// Linked /kb/ articles that aren't writing guidance (product articles, etc.) — skip them.
const EXCLUDE = new Set(["access-mozilla-services-firefox-account"]);

export async function runBuildStyle(options: { locale: string }): Promise<void> {
  console.log(`Fetching root style article "${ROOT_SLUG}"…`);
  const root = await fetchArticle(ROOT_SLUG, options.locale);
  const slugs = extractKbSlugs(root.html, ROOT_SLUG).filter((s) => !EXCLUDE.has(s));
  console.log(`Found ${slugs.length} linked style articles (after exclusions).`);

  await fs.mkdir(STYLE_DIR, { recursive: true });
  const index: string[] = [
    "# SUMO Knowledge Base style corpus",
    "",
    `Compiled from /${options.locale}/kb/${ROOT_SLUG} and its linked KB articles.`,
    "Regenerate with `npm run dev -- build-style`.",
    "",
  ];

  let ok = 0;
  for (const slug of [ROOT_SLUG, ...slugs]) {
    try {
      const art = slug === ROOT_SLUG ? root : await fetchArticle(slug, options.locale);
      const body = [
        `# ${art.title}`,
        ``,
        `Source: https://support.mozilla.org${art.url}`,
        ``,
        htmlToText(art.html),
        ``,
      ].join("\n");
      await fs.writeFile(path.join(STYLE_DIR, `${slug}.md`), body);
      index.push(`- [${art.title}](${slug}.md)`);
      ok++;
      console.log(`  ✓ ${slug} — ${art.title}`);
    } catch (err) {
      console.warn(`  ✗ ${slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await fs.writeFile(path.join(STYLE_DIR, "INDEX.md"), index.join("\n") + "\n");
  console.log(`\n✅ Wrote ${ok} article(s) to ${STYLE_DIR}`);
}
