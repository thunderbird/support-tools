// Read a Google Doc's structured content via the Docs API (more reliable to reverse
// than scraping exported HTML). See docs/DECISIONS.md, Bucket 3.

import { google, type docs_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export async function getDocument(
  auth: OAuth2Client,
  documentId: string,
): Promise<docs_v1.Schema$Document> {
  const docs = google.docs({ version: "v1", auth });
  const res = await docs.documents.get({ documentId });
  return res.data;
}
