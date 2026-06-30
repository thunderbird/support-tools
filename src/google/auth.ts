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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let credentials: any;
  try {
    credentials = JSON.parse(await fs.readFile(TOKEN_PATH, "utf-8"));
  } catch {
    return null; // no token file yet, or it's unreadable — fall through to consent.
  }

  // Force re-consent if the cached token doesn't cover all currently-required scopes.
  const saved: string[] = credentials.scopes ?? [];
  if (!SCOPES.every((s) => saved.includes(s))) return null;
  const client = google.auth.fromJSON(credentials) as unknown as OAuth2Client;

  // Proactively exchange the refresh token for an access token. A stale token
  // (revoked, or expired after 7 days under a "Testing" consent screen) fails
  // here with `invalid_grant`; delete it and fall through to consent so the
  // error surfaces as a fresh login rather than mid-command. Other errors
  // (e.g. transient network) propagate — we don't want to wipe a good token.
  try {
    await client.getAccessToken();
  } catch (err) {
    if (!isInvalidGrant(err)) throw err;
    await fs.rm(TOKEN_PATH, { force: true });
    return null;
  }
  return client;
}

/** Detect Google's "this refresh token can no longer be used" OAuth error. */
function isInvalidGrant(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { message?: string; response?: { data?: { error?: string } } };
  return e.response?.data?.error === "invalid_grant" || /invalid_grant/.test(e.message ?? "");
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
