// Asset store backed by GitHub (Phase 7). Uploaded files are committed to
// public/assets/uploads on the GITHUB_CONTENT_BRANCH (un-ignore that dir so it is
// tracked). Served statically at /assets/uploads. List/delete via the API.

import {
  getGithubConfig,
  getFile,
  putFile,
  deleteFile,
  listDir,
} from "./github";
import type { GithubConfig } from "./github";

const DIR = "public/assets/uploads";

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
  if (ext && !ALLOWED_EXT.has(ext))
    throw new Error(`File type .${ext} is not allowed`);
  return base;
}

import path from "node:path";

export async function listAssets(
  cfg: GithubConfig = getGithubConfig(),
): Promise<{ name: string; url: string }[]> {
  const entries = await listDir(cfg, DIR);
  return entries
    .filter((e) => e.type === "file")
    .map((e) => ({ name: e.name, url: `/assets/uploads/${e.name}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveAsset(
  originalName: string,
  data: Buffer,
  committer: { name: string; email: string },
  cfg: GithubConfig = getGithubConfig(),
): Promise<{ name: string; url: string }> {
  if (data.byteLength > MAX_BYTES) {
    throw new Error(
      `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`,
    );
  }
  let name = safeName(originalName);
  // avoid clobber: find a free name
  const existing = await listAssets(cfg);
  const taken = new Set(existing.map((x) => x.name));
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 1;
  while (taken.has(name)) {
    name = `${stem}-${n}${ext}`;
    n++;
  }
  const existingFile = await getFile(cfg, `${DIR}/${name}`);
  // putFile base64-encodes a UTF-8 string; pass raw bytes as latin1 so they survive
  // the round-trip (latin1 chars 0-255 map 1:1 through UTF-8).
  await putFile(
    cfg,
    `${DIR}/${name}`,
    data.toString("latin1"),
    `Upload asset: ${name}`,
    existingFile?.sha,
    cfg.contentBranch,
    committer,
  );
  return { name, url: `/assets/uploads/${name}` };
}

export async function deleteAsset(
  name: string,
  committer: { name: string; email: string },
  cfg: GithubConfig = getGithubConfig(),
): Promise<boolean> {
  const clean = path.basename(name);
  const existing = await getFile(cfg, `${DIR}/${clean}`);
  if (!existing) return false;
  await deleteFile(
    cfg,
    `${DIR}/${clean}`,
    `Delete asset: ${clean}`,
    existing.sha,
    cfg.contentBranch,
    committer,
  );
  return true;
}
