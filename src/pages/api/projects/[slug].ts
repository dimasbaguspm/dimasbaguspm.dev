import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
import {
  getGithubConfig,
  committerFromSession,
  GithubError,
} from "../../../lib/github";
import {
  writeProject,
  deleteProject,
  getProject,
  type ProjectInput,
} from "../../../lib/projects";

export const prerender = false;
export const csrfProtection = false;

export const PUT: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
  } catch (e) {
    return e as Response;
  }
  const cfg = getGithubConfig();
  try {
    const slug = ctx.params.slug!;
    const existing = await getProject(slug);
    if (!existing) return new Response("not found", { status: 404 });
    const body = (await ctx.request.json()) as ProjectInput;
    if (!body.name || !body.url)
      return new Response("name and url required", { status: 400 });
    const res = await writeProject(body, committerFromSession(ctx));
    return new Response(JSON.stringify(res), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const status = e instanceof GithubError ? e.status : 400;
    return new Response("invalid body", { status });
  }
};

export const DELETE: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
  } catch (e) {
    return e as Response;
  }
  const cfg = getGithubConfig();
  try {
    const ok = await deleteProject(ctx.params.slug!, committerFromSession(ctx));
    if (!ok) return new Response("not found", { status: 404 });
    return new Response(
      JSON.stringify({ deleted: true, slug: ctx.params.slug }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    const status = e instanceof GithubError ? e.status : 500;
    return new Response("error", { status });
  }
};
