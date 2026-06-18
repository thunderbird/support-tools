// Create Google Docs by importing HTML (Drive converts text/html -> native Doc).

import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export interface CreatedDoc {
  id: string;
  url: string;
}

/** Create a new Google Doc from an HTML string and return its id + editor URL. */
export async function createDocFromHtml(
  auth: OAuth2Client,
  title: string,
  html: string,
): Promise<CreatedDoc> {
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.document",
    },
    media: {
      mimeType: "text/html",
      body: html,
    },
    fields: "id, webViewLink",
  });

  const id = res.data.id;
  const url = res.data.webViewLink;
  if (!id || !url) {
    throw new Error("Drive did not return an id/URL for the created Doc.");
  }
  return { id, url };
}
