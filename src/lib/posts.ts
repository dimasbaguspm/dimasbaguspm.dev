import { Octokit } from "@octokit/rest";
import { marked } from "marked";
import { createHighlighter } from "shiki";
import dayjs from "dayjs";
import { SpanStatusCode } from "@opentelemetry/api";
import { log, tracer } from "./otel"; // starts the SDK when OTEL_HOST is set
import { cached } from "./cache";

const TOKEN = process.env.GITHUB_TOKEN ?? "";
const [OWNER, REPO] = (
  process.env.GITHUB_REPOSITORY ?? "dimasbaguspm/dimasbaguspm.dev"
).split("/");
const POSTS_PATH = "content/posts";

const octokit = new Octokit({ auth: TOKEN || undefined });

// Runs a GitHub API call inside an OTEL span + error log.
async function gh<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn();
    } catch (e) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (e as Error).message,
      });
      log.error("github request failed", {
        operation: name,
        error: (e as Error).message,
      });
      throw e;
    } finally {
      span.end();
    }
  });
}

const highlighter = await createHighlighter({
  themes: ["github-dark"],
  langs: ["ts", "js", "bash", "json", "markdown", "css", "html"],
});

marked.use({
  renderer: {
    code({ text, lang }) {
      return highlighter.codeToHtml(text, {
        lang: lang || "text",
        theme: "github-dark",
      });
    },
  },
});

export const formatDate = (d?: string) =>
  d ? dayjs(d).format("MMM D, YYYY") : "";

export interface Post {
  slug: string;
  title: string;
  description?: string;
  pubDate?: string;
  tags: string[];
  body: string;
}

export interface Profile {
  name: string;
  avatar: string;
  bio: string | null;
  blog: string | null;
  login: string;
}

/** GitHub profile — the single source of truth for all personal info. */
export async function getProfile(): Promise<Profile> {
  return cached("profile", async () => {
    try {
      const { data } = await gh("github.getUser", () =>
        octokit.rest.users.getByUsername({ username: OWNER }),
      );
      return {
        name: data.name ?? OWNER,
        avatar: data.avatar_url,
        bio: data.bio,
        blog: data.blog,
        login: data.login,
      };
    } catch {
      // GitHub unreachable → degrade instead of 500ing the whole site
      return {
        name: OWNER,
        avatar: `https://github.com/${OWNER}.png`,
        bio: null,
        blog: null,
        login: OWNER,
      };
    }
  });
}

export interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  homepage: string | null;
  topics: string[];
  url: string;
}

async function listRepos(): Promise<Repo[]> {
  return cached("repos", async () => {
    const { data } = await gh("github.listRepos", () =>
      octokit.rest.repos.listForUser({
        username: OWNER,
        per_page: 100,
      }),
    );
    return data
      .filter((r) => !r.fork)
      .map((r) => ({
        name: r.name,
        description: r.description,
        language: r.language ?? null,
        stars: r.stargazers_count ?? 0,
        forks: r.forks_count ?? 0,
        homepage: r.homepage ?? null,
        topics: r.topics ?? [],
        url: r.html_url,
      }))
      .sort((a, b) => b.stars - a.stars);
  });
}

/** Top public repos by stars — the landing projects section. */
export async function listProjects(limit = 6): Promise<Repo[]> {
  return (await listRepos()).slice(0, limit);
}

/** All repos tagged with a topic, e.g. "personal-project". */
export async function listProjectsByTag(
  tag = "personal-project",
): Promise<Repo[]> {
  return (await listRepos()).filter((r) => r.topics.includes(tag));
}

export async function getProject(slug: string): Promise<Repo | null> {
  const repos = await listRepos();
  return repos.find((r) => r.name.toLowerCase() === slug.toLowerCase()) ?? null;
}

/** Raw README markdown for a repo (cached). */
export async function getReadme(repoName: string): Promise<string | null> {
  return cached(`readme:${repoName}`, () =>
    gh("github.getReadme", async () => {
      try {
        const { data } = await octokit.rest.repos.getReadme({
          owner: OWNER,
          repo: repoName,
          mediaType: { format: "raw" },
        });
        return typeof data === "string" ? data : null;
      } catch {
        return null; // no README → render description only
      }
    }),
  );
}

async function listFiles(path: string) {
  return cached(`files:${path}`, () =>
    gh("github.listFiles", async () => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: REPO,
          path,
        });
        return Array.isArray(data) ? data : [];
      } catch {
        return []; // 404 or rate-limited → degrade to no posts
      }
    }),
  );
}

async function readFile(path: string): Promise<string | null> {
  return cached(`file:${path}`, () =>
    gh("github.readFile", async () => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: REPO,
          path,
        });
        if (Array.isArray(data) || data.type !== "file") return null;
        return Buffer.from(data.content, "base64").toString("utf8");
      } catch {
        return null; // 404 or rate-limited → treat as missing
      }
    }),
  );
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
  return cached("posts", async () => {
    const mds = (await listFiles(POSTS_PATH)).filter(
      (f) => f.type === "file" && f.name.endsWith(".md"),
    );
    const posts = (
      await Promise.all(mds.map((f) => readPost(f.name.replace(/\.md$/, ""))))
    ).filter((p): p is Post => p !== null);
    posts.sort((a, b) => (b.pubDate ?? "").localeCompare(a.pubDate ?? ""));
    return posts;
  });
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
