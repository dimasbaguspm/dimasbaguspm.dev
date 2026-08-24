// Read/write uploaded assets under public/assets/uploads.
// In prod, ASSET_DIR points at a mounted volume; ASSET_PUBLIC_PREFIX is the URL
// prefix the files are served from. Falls back to ./public/assets/uploads so
// local/dev works without extra config.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ASSET_DIR = process.env.ASSET_DIR
  ? path.resolve(process.env.ASSET_DIR)
  : path.resolve(__dirname, "../../../public/assets/uploads");

// URL prefix the browser uses to fetch the asset (served by the static dir).
export const ASSET_PUBLIC_PREFIX =
  process.env.ASSET_PUBLIC_PREFIX || "/assets/uploads";

// Allowed extensions + a hard size cap (default 10 MB).
const ALLOWED_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "svg",
  "ico",
  "pdf",
  "txt",
  "md",
  "json",
  "csv",
  "zip",
]);
const MAX_BYTES = Number(process.env.ASSET_MAX_BYTES || 10 * 1024 * 1024);

function safeName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
  if (ext && !ALLOWED_EXT.has(ext)) {
    throw new Error(`File type .${ext} is not allowed`);
  }
  return base;
}

export function listAssets(): { name: string; url: string; size: number }[] {
  if (!fs.existsSync(ASSET_DIR)) return [];
  return fs
    .readdirSync(ASSET_DIR)
    .filter((f) => fs.statSync(path.join(ASSET_DIR, f)).isFile())
    .map((name) => {
      const stat = fs.statSync(path.join(ASSET_DIR, name));
      return { name, url: `${ASSET_PUBLIC_PREFIX}/${name}`, size: stat.size };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function saveAsset(
  originalName: string,
  data: Buffer,
): { name: string; url: string } {
  if (data.byteLength > MAX_BYTES) {
    throw new Error(
      `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`,
    );
  }
  const name = safeName(originalName);
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  // avoid clobbering: append a short suffix if the name exists
  let finalName = name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 1;
  while (fs.existsSync(path.join(ASSET_DIR, finalName))) {
    finalName = `${stem}-${n}${ext}`;
    n++;
  }
  fs.writeFileSync(path.join(ASSET_DIR, finalName), data);
  return { name: finalName, url: `${ASSET_PUBLIC_PREFIX}/${finalName}` };
}

export function deleteAsset(name: string): boolean {
  const clean = path.basename(name);
  const file = path.join(ASSET_DIR, clean);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    return true;
  }
  return false;
}
