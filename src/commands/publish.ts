// `sumo publish <source>` — Bucket 6: the semi-automated publish step (D2). Copies
// the WikiMarkup to the clipboard and opens the SUMO edit page so the editor pastes
// and submits. SUMO has no write API, so submission stays manual by design.

import { loadExistingWiki } from "../existing.js";
import { copyToClipboard, openUrl } from "../clipboard.js";

interface PublishOptions {
  slug?: string;
  new?: boolean;
  locale: string;
  copy?: boolean; // --no-copy sets false
  open?: boolean; // --no-open sets false
}

export async function runPublish(source: string, options: PublishOptions): Promise<void> {
  if (!options.slug && !options.new) {
    throw new Error("Specify --slug <existing-slug> to edit an article, or --new for a new one.");
  }
  if (options.slug && options.new) {
    throw new Error("Use either --slug or --new, not both.");
  }

  const { wiki, note } = await loadExistingWiki(source);
  if (note) console.warn(`Note: content loaded from ${note}`);

  const base = `https://support.mozilla.org/${options.locale}/kb`;
  const url = options.new ? `${base}/new` : `${base}/${options.slug}/edit`;

  const copied = options.copy === false ? false : await copyToClipboard(wiki);
  console.log(copied ? "✅ WikiMarkup copied to clipboard." : "⚠️ Could not copy to clipboard automatically.");

  if (options.open === false) {
    console.log(`SUMO edit page:\n   ${url}`);
  } else {
    openUrl(url);
    console.log(`🌐 Opened SUMO edit page:\n   ${url}`);
  }

  console.log(
    `\nPaste the WikiMarkup into the article's Content field, then save / submit for review.\n` +
      `(SUMO has no write API — submission is manual by design.)`,
  );

  if (!copied) {
    console.log(`\n----- WikiMarkup (copy manually) -----\n${wiki}`);
  }
}
