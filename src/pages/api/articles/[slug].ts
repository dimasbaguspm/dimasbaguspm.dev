import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
import {
  getGithubConfig,
  committerFromSession,
  GithubError,
} from "../../../lib/github";
import {
  writeArticle,
  deleteArticle,
  type ArticleInput,
} from "../../../lib/articles";

export const prerender = false;
export const csrfProtection = false;

export const PUT: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
  } catch (r) {
    return r as Response;
  }
  const cfg = getGithubConfig();
  const slug = ctx.params.slug!;
  let data: Record<string, unknown>;
  try {
    data = await ctx.request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const title = String(data.title ?? "");
  if (!title) return new Response("title is required", { status: 400 });
  const input: ArticleInput = {
    title,
    description: String(data.description ?? ""),
    pubDate:
      typeof data.pubDate === "string" && data.pubDate
        ? data.pubDate
        : new Date().toISOString().slice(0, 10),
    updatedDate: new Date().toISOString().slice(0, 10),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    draft: Boolean(data.draft),
    cover: data.cover ? String(data.cover) : undefined,
    canonical: data.canonical ? String(data.canonical) : undefined,
    author: data.author ? String(data.author) : undefined,
    body: typeof data.body === "string" ? data.body : "",
  };
  try {
    const res = await writeArticle(slug, input, committerFromSession(ctx));
    return Response.json(res);
  } catch (err) {
    const status = err instanceof GithubError ? err.status : 500;
    return new Response(`Write failed: ${(err as Error).message}`, { status });
  }
};

export const DELETE: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
  } catch (r) {
    return r as Response;
  }
  const cfg = getGithubConfig();
  const slug = ctx.params.slug!;
  try {
    const ok = await deleteArticle(slug, committerFromSession(ctx));
    return Response.json({ deleted: ok, slug });
  } catch (err) {
    const status = err instanceof GithubError ? err.status : 500;
    return new Response(`Delete failed: ${(err as Error).message}`, { status });
  }
};
