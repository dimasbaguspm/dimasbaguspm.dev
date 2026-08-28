import { marked } from "marked";
import { createHighlighter } from "shiki";
import dayjs from "dayjs";
import { OWNER, gh, listFiles, octokit, readFile } from "./github";
import { cached } from "./cache";

const POSTS_PATH = "content/posts";

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
