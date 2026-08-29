import { marked } from "marked";
import { createHighlighter } from "shiki";
import dayjs from "dayjs";
import { OWNER, REPO, gh, listFiles, octokit, readFile } from "./github";
import { cached } from "./cache";

const POSTS_PATH = "content/posts";

const highlighter = await createHighlighter({
  themes: ["github-dark"],
  langs: ["ts", "js", "bash", "json", "markdown", "css", "html"],
});

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") {
        return `<pre class="mermaid">${escHtml(text)}</pre>`;
      }
      try {
        return highlighter.codeToHtml(text, {
          lang: lang || "text",
          theme: "github-dark",
        });
      } catch {
        return highlighter.codeToHtml(text, {
          lang: "text",
          theme: "github-dark",
        });
      }
    },
    image({ href, title, text }) {
      const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(href || "");
      const safeHref = (href || "").replace(/"/g, "&quot;");
      const safeText = (text || "").replace(/"/g, "&quot;");
      const safeTitle = (title || "").replace(/"/g, "&quot;");
      if (isVideo) {
        return `<video src="${safeHref}" alt="${safeText}" title="${safeTitle}" controls preload="metadata" class="max-h-[480px] w-auto max-w-full rounded-lg border border-neutral-200 object-contain" data-md-media data-video></video>`;
      }
      return `<img src="${safeHref}" alt="${safeText}" title="${safeTitle}" loading="lazy" class="mx-auto max-h-[480px] w-auto max-w-full rounded-lg border border-neutral-200 object-contain" data-md-media />`;
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

export interface PostVersion {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
  url: string;
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

/** Commit history for a post — versioning via `git log` through GitHub API. */
export async function getPostHistory(slug: string): Promise<PostVersion[]> {
  const path = `${POSTS_PATH}/${slug}.md`;
  return cached(`history:${slug}`, () =>
    gh("github.getPostHistory", async () => {
      try {
        const { data } = await octokit.rest.repos.listCommits({
          owner: OWNER,
          repo: REPO,
          path,
          per_page: 20,
        });
        return data.map((c) => ({
          sha: c.sha,
          shortSha: c.sha.slice(0, 7),
          message: c.commit.message.split("\n")[0],
          date: c.commit.committer?.date ?? c.commit.author?.date ?? "",
          url: c.html_url,
        }));
      } catch {
        return [];
      }
    }),
  );
}

export function estimateReadingTime(md: string): string {
  const words = md.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins} min read`;
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}
