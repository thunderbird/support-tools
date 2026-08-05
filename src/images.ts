// Show local screenshots inside the staged Google Doc, next to their
// [[Image:Name]] tokens, so reviewers see the article with its visuals (D19).
//
// Docs' insertInlineImage fetches a PUBLIC uri — local bytes can't be pushed
// directly. So: upload to Drive (drive.file), share anyone:reader, insert, then
// delete the Drive original. Verified 2026-08-04: Docs copies the bytes into the
// document (contentUri becomes googleusercontent/docsz/...), so the image
// survives deletion of the Drive file and nothing stays publicly shared.
//
// The [[Image:...]] token stays in place as the source of truth; the picture is
// review-only decoration. fromDoc reads only textRun elements, so inline images
// are dropped on to-markup — which is exactly right here.

import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { google, type docs_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

/** SUMO renders KB images at at most 620px wide. */
export const SUMO_MAX_WIDTH_PX = 620;
const PT_PER_PX = 72 / 96;

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

export interface ImageAttachReport {
  inserted: { token: string; file: string; width: number }[];
  tokensWithoutFile: string[];
  filesWithoutToken: string[];
}

/** Natural pixel size, parsed from the file header. null when unrecognized. */
export function imageSize(buf: Buffer): { w: number; h: number } | null {
  // PNG: 8-byte signature, then IHDR with width/height as big-endian uint32.
  if (buf.length > 24 && buf.toString("hex", 0, 8) === "89504e470d0a1a0a") {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // GIF: "GIF87a"/"GIF89a", then little-endian uint16 width/height.
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  // WebP: RIFF....WEBP, then a VP8X / VP8 / VP8L chunk.
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { w: (buf.readUIntLE(24, 3) & 0xffffff) + 1, h: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (chunk === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  // JPEG: walk markers to a start-of-frame (SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15).
  if (buf.length > 4 && buf.readUInt16BE(0) === 0xffd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** objectSize capped at SUMO's 620px, aspect preserved. undefined = natural size. */
export function objectSizeFor(buf: Buffer): docs_v1.Schema$Size | undefined {
  const nat = imageSize(buf);
  if (!nat || nat.w <= SUMO_MAX_WIDTH_PX) return undefined;
  const scale = SUMO_MAX_WIDTH_PX / nat.w;
  return {
    width: { magnitude: SUMO_MAX_WIDTH_PX * PT_PER_PX, unit: "PT" },
    height: { magnitude: nat.h * scale * PT_PER_PX, unit: "PT" },
  };
}

/** Normalize for matching a file basename against an [[Image:Name]] token. */
function key(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Index every usable image file in a directory, by normalized basename. */
async function indexDir(dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const name of await fs.readdir(dir)) {
    const ext = path.extname(name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    out.set(key(path.basename(name, ext)), path.join(dir, name));
  }
  return out;
}

const IMAGE_TOKEN = /\[\[Image:([^\]|]+)(?:\|[^\]]*)?\]\]/gi;

/** Every [[Image:Name]] token in the doc, with the index to insert after. */
function findTokens(doc: docs_v1.Schema$Document): { name: string; at: number }[] {
  const found: { name: string; at: number }[] = [];
  for (const el of doc.body?.content ?? []) {
    for (const pe of el.paragraph?.elements ?? []) {
      const content = pe.textRun?.content;
      if (!content || pe.startIndex == null) continue;
      for (const m of content.matchAll(IMAGE_TOKEN)) {
        found.push({ name: m[1].trim(), at: pe.startIndex + m.index! + m[0].length });
      }
    }
  }
  return found;
}

/**
 * Insert local screenshots into an existing Doc, after each matching token.
 *
 * Runs as a SECOND batchUpdate against the finished document rather than folding
 * into buildRequests: reading real post-bullet indices avoids interacting with the
 * tab-stripping that createParagraphBullets does (D11). Insertions are applied in
 * reverse document order so earlier indices stay valid.
 */
export async function attachImages(
  auth: OAuth2Client,
  documentId: string,
  dir: string,
): Promise<ImageAttachReport> {
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  const files = await indexDir(dir);
  const tokens = findTokens((await docs.documents.get({ documentId })).data);

  const report: ImageAttachReport = { inserted: [], tokensWithoutFile: [], filesWithoutToken: [] };
  const used = new Set<string>();

  // Resolve token -> file first, so we upload each file once.
  const work: { token: string; at: number; file: string }[] = [];
  for (const t of tokens) {
    const file = files.get(key(t.name));
    if (!file) {
      report.tokensWithoutFile.push(t.name);
      continue;
    }
    used.add(key(t.name));
    work.push({ token: t.name, at: t.at, file });
  }
  for (const [k, file] of files) if (!used.has(k)) report.filesWithoutToken.push(path.basename(file));
  if (work.length === 0) return report;

  const uploaded = new Map<string, { uri: string; fileId: string; size?: docs_v1.Schema$Size }>();
  try {
    for (const w of work) {
      if (uploaded.has(w.file)) continue;
      const buf = await fs.readFile(w.file);
      const created = await drive.files.create({
        requestBody: { name: path.basename(w.file) },
        media: { body: createReadStream(w.file) },
        fields: "id",
      });
      const fileId = created.data.id!;
      await drive.permissions.create({ fileId, requestBody: { role: "reader", type: "anyone" } });
      uploaded.set(w.file, {
        fileId,
        uri: `https://drive.google.com/uc?export=view&id=${fileId}`,
        size: objectSizeFor(buf),
      });
    }

    // Reverse document order: later insertions don't invalidate earlier indices.
    const requests: docs_v1.Schema$Request[] = [...work]
      .sort((a, b) => b.at - a.at)
      .map((w) => {
        const u = uploaded.get(w.file)!;
        return {
          insertInlineImage: { location: { index: w.at }, uri: u.uri, objectSize: u.size },
        };
      });

    await docs.documents.batchUpdate({ documentId, requestBody: { requests } });

    for (const w of work) {
      const u = uploaded.get(w.file)!;
      report.inserted.push({
        token: w.token,
        file: path.basename(w.file),
        width: u.size?.width?.magnitude ? Math.round(u.size.width.magnitude / PT_PER_PX) : 0,
      });
    }
  } finally {
    // Docs copied the bytes, so the Drive originals (and their public share) go away.
    for (const u of uploaded.values()) {
      await drive.files.delete({ fileId: u.fileId }).catch(() => {});
    }
  }

  return report;
}
