// `sumo to-markup <docId|url>` — convert an edited Google Doc back into paste-ready
// WikiMarkup (the reverse trip; closes the semi-automated publish loop). See Bucket 3.

import { promises as fs } from "node:fs";
import { authorize } from "../google/auth.js";
import { getDocument } from "../google/docs.js";
import { docToWikiMarkup } from "../wikimarkup/fromDoc.js";

/** Accept a raw Doc id or a full Docs URL. */
function parseDocId(input: string): string {
  const m = /\/document\/d\/([a-zA-Z0-9_-]+)/.exec(input);
  return m ? m[1] : input.trim();
}

export async function runToMarkup(
  docRef: string,
  options: { out?: string; debugLists?: boolean },
): Promise<void> {
  const documentId = parseDocId(docRef);

  console.log("Authorizing with Google…");
  const auth = await authorize();

  console.log(`Reading Google Doc ${documentId}…`);
  const doc = await getDocument(auth, documentId);

  if (options.debugLists) {
    console.log(JSON.stringify(doc.lists ?? {}, null, 2));
    return;
  }

  const { wiki, warnings } = docToWikiMarkup(doc);

  if (options.out) {
    await fs.writeFile(options.out, wiki);
    console.log(`\n✅ Wrote paste-ready WikiMarkup to ${options.out}`);
  } else {
    console.log("\n----- WikiMarkup (paste into SUMO) -----\n");
    console.log(wiki);
  }

  if (warnings.length) {
    console.warn("\nWarnings:");
    for (const w of warnings) console.warn(`  - ${w}`);
  }
}
