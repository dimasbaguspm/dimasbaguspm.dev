// GitHub-backed content store. The admin writes Markdown/JSON/assets directly to
// the repo (no server filesystem), so the site is rebuilt from Git on publish.
//
// Design (Phase 7, option B): writes go to GITHUB_CONTENT_BRANCH (default
// `content`); a "Publish" action merges that branch into GITHUB_BRANCH
// (default `main`), which triggers the existing deploy CI. Reads for the admin
// UI come from the content branch via the GitHub API.
//
// All values are read from process.env at runtime (never import.meta.env).

import type { APIContext } from "astro";

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export interface GithubConfig {
  token: string;
  repo: string; // owner/name
  contentBranch: string;
  mainBranch: string;
}

export function getGithubConfig(): GithubConfig {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPO", "dimasbaguspm/dimasbaguspm.dev");
  if (!token) throw new Error("GITHUB_TOKEN is not configured");
  return {
    token,
    repo,
    contentBranch: env("GITHUB_CONTENT_BRANCH", "content"),
    mainBranch: env("GITHUB_BRANCH", "main"),
  };
}

export interface FileResult {
  sha: string;
  path: string;
}

export interface ListEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

class GithubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function ghFetch(
  cfg: GithubConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `https://api.github.com/repos/${cfg.repo}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
}

/** Read a file's base64 content + sha. Returns null if it doesn't exist (404). */
export async function getFile(
  cfg: GithubConfig,
  path: string,
  branch = cfg.contentBranch,
): Promise<{ content: string; sha: string } | null> {
  const res = await ghFetch(cfg, `/contents/${encodeURI(path)}?ref=${branch}`);
  if (res.status === 404) return null;
  if (!res.ok)
    throw new GithubError(res.status, `getFile failed: ${res.status}`);
  const data = (await res.json()) as {
    content: string;
    sha: string;
    encoding: string;
  };
  const content = Buffer.from(
    data.content,
    data.encoding === "base64" ? "base64" : "utf8",
  ).toString("utf8");
  return { content, sha: data.sha };
}

/** List files in a directory. */
export async function listDir(
  cfg: GithubConfig,
  dir: string,
  branch = cfg.contentBranch,
): Promise<ListEntry[]> {
  const res = await ghFetch(cfg, `/contents/${encodeURI(dir)}?ref=${branch}`);
  if (res.status === 404) return [];
  if (!res.ok)
    throw new GithubError(res.status, `listDir failed: ${res.status}`);
  const data = (await res.json()) as Array<{
    name: string;
    path: string;
    type: string;
  }>;
  return data.map((e) => ({
    name: e.name,
    path: e.path,
    type: e.type === "dir" ? "dir" : "file",
  }));
}

/** Create or update a file. Pass `sha` to update an existing file. */
export async function putFile(
  cfg: GithubConfig,
  path: string,
  content: string,
  message: string,
  sha?: string,
  branch = cfg.contentBranch,
  committer?: { name: string; email: string },
): Promise<FileResult> {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  if (committer) body.committer = committer;
  const res = await ghFetch(cfg, `/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new GithubError(res.status, `putFile failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { content: { sha: string } };
  return { sha: data.content.sha, path };
}

/** Delete a file (requires its current sha). */
export async function deleteFile(
  cfg: GithubConfig,
  path: string,
  message: string,
  sha: string,
  branch = cfg.contentBranch,
  committer?: { name: string; email: string },
): Promise<void> {
  const body: Record<string, unknown> = { message, sha, branch };
  if (committer) body.committer = committer;
  const res = await ghFetch(cfg, `/contents/${encodeURI(path)}`, {
    method: "DELETE",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new GithubError(
      res.status,
      `deleteFile failed: ${res.status} ${err}`,
    );
  }
}

/** Ensure the content branch exists, branching from main if missing. */
export async function ensureContentBranch(cfg: GithubConfig): Promise<void> {
  // branch already exists?
  const existing = await ghFetch(cfg, `/branches/${cfg.contentBranch}`);
  if (existing.ok) return;
  if (existing.status !== 404)
    throw new GithubError(existing.status, "branch check failed");
  // create from main sha
  const main = await ghFetch(cfg, `/branches/${cfg.mainBranch}`);
  if (!main.ok)
    throw new GithubError(main.status, "cannot resolve main branch");
  const mainSha = ((await main.json()) as { commit: { sha: string } }).commit
    .sha;
  const res = await ghFetch(cfg, `/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${cfg.contentBranch}`,
      sha: mainSha,
    }),
  });
  if (!res.ok)
    throw new GithubError(res.status, "failed to create content branch");
}

/** Merge the content branch into main (the "Publish" action). */
export async function mergeToMain(
  cfg: GithubConfig,
  committer?: { name: string; email: string },
): Promise<{ merged: boolean; sha?: string }> {
  const body: Record<string, unknown> = {
    base: cfg.mainBranch,
    head: cfg.contentBranch,
  };
  if (committer)
    body.commit_message = `Publish content\n\nMerged ${cfg.contentBranch} → ${cfg.mainBranch}`;
  const res = await ghFetch(cfg, `/merges`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (res.status === 204) return { merged: false }; // no merge needed
  if (!res.ok) {
    const err = await res.text();
    throw new GithubError(res.status, `merge failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { sha?: string };
  return { merged: true, sha: data.sha };
}

/** Resolve a session's committer identity, falling back to a sane default. */
export function committerFromSession(ctx: APIContext): {
  name: string;
  email: string;
} {
  const cookie = ctx.request.headers.get("cookie") ?? undefined;
  // session cookie is set by our auth; we decode minimally for identity.
  // Simpler: rely on email from the OIDC user captured at login is not stored in
  // cookie payload here, so default to the repo owner identity.
  return {
    name: process.env.GITHUB_COMMIT_NAME || "dimasbaguspm",
    email:
      process.env.GITHUB_COMMIT_EMAIL ||
      "dimasbaguspm@users.noreply.github.com",
  };
}

export { GithubError };
