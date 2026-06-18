// Google OAuth (desktop flow) for a single user. See docs/DECISIONS.md D6.
// Reads credentials.json (OAuth client), caches the refresh token in token.json.

import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { promises as fs } from "node:fs";
import path from "node:path";

// Least-privilege scopes:
//   drive.file  — create/access only files the app created (fetch's HTML import)
//   documents   — create/edit Docs via the Docs API (import-source) and read them (to-markup)
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents",
];

const CREDENTIALS_PATH = path.resolve(process.cwd(), "credentials.json");
const TOKEN_PATH = path.resolve(process.cwd(), "token.json");

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, "utf-8");
    const credentials = JSON.parse(content);
    // Force re-consent if the cached token doesn't cover all currently-required scopes.
    const saved: string[] = credentials.scopes ?? [];
    if (!SCOPES.every((s) => saved.includes(s))) return null;
    return google.auth.fromJSON(credentials) as unknown as OAuth2Client;
  } catch {
    return null;
  }
}

async function saveCredentials(client: OAuth2Client): Promise<void> {
  const content = await fs.readFile(CREDENTIALS_PATH, "utf-8");
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
    scopes: SCOPES,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/** Return an authorized OAuth2 client, running the browser consent flow if needed. */
export async function authorize(): Promise<OAuth2Client> {
  const existing = await loadSavedCredentialsIfExist();
  if (existing) return existing;

  try {
    await fs.access(CREDENTIALS_PATH);
  } catch {
    throw new Error(
      `Missing credentials.json at ${CREDENTIALS_PATH}.\n` +
        `Create an OAuth Desktop client in Google Cloud and download it here. ` +
        `See the "Google setup" section in README.md.`,
    );
  }

  const client = (await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  })) as OAuth2Client;

  if (client.credentials?.refresh_token) {
    await saveCredentials(client);
  }
  return client;
}
