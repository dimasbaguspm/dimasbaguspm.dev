import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
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
    writeArticle(slug, input);
    return Response.json({ slug });
  } catch (err) {
    return new Response(`Write failed: ${(err as Error).message}`, {
      status: 500,
    });
  }
};

export const DELETE: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
  } catch (r) {
    return r as Response;
  }
  const slug = ctx.params.slug!;
  const ok = deleteArticle(slug);
  return Response.json({ deleted: ok, slug });
};
