// Article content store backed by GitHub (Phase 7). Markdown/MDX files live in
// src/content/articles on the GITHUB_CONTENT_BRANCH; saving commits to the repo
// and a "Publish" merges into main → rebuild. The static build still reads local
// files via Astro's content collections; this module is for the admin API.

import {
  getGithubConfig,
  getFile,
  putFile,
  deleteFile,
  listDir,
} from "./github";
import type { GithubConfig } from "./github";

export interface ArticleInput {
  title: string;
  description: string;
  pubDate: string; // ISO date
  updatedDate?: string;
  tags: string[];
  draft: boolean;
  cover?: string;
  canonical?: string;
  author?: string;
  body: string;
}

function yamlString(v: string): string {
  if (/[:#\-?[\]{}",\n]/.test(v) || v.trim() !== v) return JSON.stringify(v);
  return v;
}

function serializeFrontmatter(a: ArticleInput): string {
  const lines = ["---"];
  lines.push(`title: ${yamlString(a.title)}`);
  lines.push(`description: ${yamlString(a.description)}`);
  lines.push(`pubDate: ${a.pubDate}`);
  if (a.updatedDate) lines.push(`updatedDate: ${a.updatedDate}`);
  lines.push(`tags: [${a.tags.map((t) => yamlString(t)).join(", ")}]`);
  lines.push(`draft: ${a.draft ? "true" : "false"}`);
  if (a.cover) lines.push(`cover: ${yamlString(a.cover)}`);
  if (a.canonical) lines.push(`canonical: ${yamlString(a.canonical)}`);
  if (a.author) lines.push(`author: ${yamlString(a.author)}`);
  lines.push("---");
  return lines.join("\n");
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const DIR = "src/content/articles";

export async function listArticleSlugs(
  cfg: GithubConfig = getGithubConfig(),
): Promise<string[]> {
  const entries = await listDir(cfg, DIR);
  return entries
    .filter((e) => e.name.endsWith(".mdx"))
    .map((e) => e.name.replace(/\.mdx$/, ""))
    .sort();
}

export async function readArticle(
  slug: string,
  cfg: GithubConfig = getGithubConfig(),
): Promise<(ArticleInput & { slug: string }) | null> {
  const file = await getFile(cfg, `${DIR}/${slug}.mdx`);
  if (!file) return null;
  const raw = file.content;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m)
    return {
      slug,
      title: slug,
      description: "",
      pubDate: "",
      tags: [],
      draft: false,
      body: raw,
    };
  const fm = m[1];
  const body = m[2];
  const get = (k: string): string | undefined => {
    const line = fm.split("\n").find((l) => l.startsWith(`${k}:`));
    if (!line) return undefined;
    let v = line.slice(k.length + 1).trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      return v
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
        .join(", ");
    }
    return v.replace(/^["']|["']$/g, "");
  };
  const tagsRaw = get("tags");
  return {
    slug,
    title: get("title") ?? slug,
    description: get("description") ?? "",
    pubDate: get("pubDate") ?? "",
    updatedDate: get("updatedDate"),
    tags: typeof tagsRaw === "string" ? [tagsRaw] : [],
    draft: get("draft") === "true",
    cover: get("cover"),
    canonical: get("canonical"),
    author: get("author"),
    body: body.trim(),
  };
}

export async function writeArticle(
  slug: string,
  a: ArticleInput,
  committer: { name: string; email: string },
  cfg: GithubConfig = getGithubConfig(),
): Promise<{ slug: string }> {
  const path = `${DIR}/${slug}.mdx`;
  const content = `${serializeFrontmatter(a)}\n\n${a.body.trim()}\n`;
  const existing = await getFile(cfg, path);
  await putFile(
    cfg,
    path,
    content,
    `${existing ? "Update" : "Add"} article: ${a.title}`,
    existing?.sha,
    cfg.contentBranch,
    committer,
  );
  return { slug };
}

export async function deleteArticle(
  slug: string,
  committer: { name: string; email: string },
  cfg: GithubConfig = getGithubConfig(),
): Promise<boolean> {
  const path = `${DIR}/${slug}.mdx`;
  const existing = await getFile(cfg, path);
  if (!existing) return false;
  await deleteFile(
    cfg,
    path,
    `Delete article: ${slug}`,
    existing.sha,
    cfg.contentBranch,
    committer,
  );
  return true;
}
