// Read/write Markdown (MDX) article files under src/content/articles.
// Frontmatter is serialized as YAML by hand (no heavy dep) and the body is
// preserved verbatim. Used by the admin API routes (server-side only).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Articles are read/written from CONTENT_DIR (absolute, set in prod to the
// mounted content volume, e.g. /data/content/articles). Falls back to the
// repo's src/content/articles so dev and tests work without config.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ARTICLES = path.resolve(__dirname, "../../content/articles");
const ARTICLES_DIR = process.env.CONTENT_DIR
  ? path.join(process.env.CONTENT_DIR, "articles")
  : DEFAULT_ARTICLES;

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
  // quote if it contains characters that would break YAML
  if (/[:#\-?[\]{}",\n]/.test(v) || v.trim() !== v) return JSON.stringify(v);
  return v;
}

function serializeFrontmatter(a: ArticleInput): string {
  const lines: string[] = ["---"];
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

export function articlePath(slug: string): string {
  const safe = slug.replace(/[^a-z0-9._-]/gi, "");
  return path.join(ARTICLES_DIR, `${safe}.mdx`);
}

export function writeArticle(slug: string, a: ArticleInput): string {
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  const file = articlePath(slug);
  fs.writeFileSync(
    file,
    `${serializeFrontmatter(a)}\n\n${a.body.trim()}\n`,
    "utf8",
  );
  return file;
}

export function deleteArticle(slug: string): boolean {
  const file = articlePath(slug);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    return true;
  }
  return false;
}

export interface ParsedArticle extends ArticleInput {
  slug: string;
}

export function readArticle(slug: string): ParsedArticle | null {
  const file = articlePath(slug);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
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
    tags: Array.isArray(tagsRaw)
      ? tagsRaw
      : typeof tagsRaw === "string"
        ? [tagsRaw]
        : [],
    draft: get("draft") === "true",
    cover: get("cover"),
    canonical: get("canonical"),
    author: get("author"),
    body: body.trim(),
  };
}

export function listArticleSlugs(): string[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}
