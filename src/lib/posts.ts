import { Octokit } from "@octokit/rest";
import { marked } from "marked";

const TOKEN = process.env.GITHUB_TOKEN ?? "";
const [OWNER, REPO] = (
  process.env.GITHUB_REPO ?? "dimasbaguspm/dimasbaguspm.dev"
).split("/");
const POSTS_PATH = process.env.POSTS_PATH ?? "content/posts";

const octokit = new Octokit({ auth: TOKEN || undefined });

export interface Post {
  slug: string;
  title: string;
  description?: string;
  pubDate?: string;
  author?: string;
  tags: string[];
  body: string;
}

// ponytail: in-memory TTL cache, avoids hammering GitHub API per request
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 60_000;

async function listFiles(path: string) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function readFile(path: string): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });
    if (Array.isArray(data) || data.type !== "file") return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null; // 404 or rate-limited → treat as missing, site degrades to empty
  }
}

function parseFrontmatter(raw: string): {
  fm: Record<string, any>;
  body: string;
} {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  const fm: Record<string, any> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v: string | string[] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (v.startsWith("[") && v.endsWith("]")) {
      v = v
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    fm[k] = v;
  }
  return { fm, body: m[2].trim() };
}

export async function listPosts(): Promise<Post[]> {
  const key = "list";
  const c = cache.get(key);
  if (c && Date.now() - c.at < TTL) return c.data as Post[];
  const mds = (await listFiles(POSTS_PATH)).filter(
    (f) => f.type === "file" && f.name.endsWith(".md"),
  );
  const posts = (
    await Promise.all(mds.map((f) => readPost(f.name.replace(/\.md$/, ""))))
  ).filter((p): p is Post => p !== null);
  posts.sort((a, b) => (b.pubDate ?? "").localeCompare(a.pubDate ?? ""));
  cache.set(key, { at: Date.now(), data: posts });
  return posts;
}

export async function readPost(slug: string): Promise<Post | null> {
  const raw = await readFile(`${POSTS_PATH}/${slug}.md`);
  if (!raw) return null;
  const { fm, body } = parseFrontmatter(raw);
  const tags = Array.isArray(fm.tags)
    ? fm.tags
    : ((fm.tags as string) || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  return {
    slug,
    title: (fm.title as string) ?? slug,
    description: fm.description as string | undefined,
    pubDate: fm.pubDate as string | undefined,
    tags,
    body,
  };
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}
