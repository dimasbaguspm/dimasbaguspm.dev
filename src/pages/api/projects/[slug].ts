import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
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
    const slug = ctx.params.slug!;
    const existing = getProject(slug);
    if (!existing) return new Response("not found", { status: 404 });
    const body = (await ctx.request.json()) as ProjectInput;
    if (!body.name || !body.url)
      return new Response("name and url required", { status: 400 });
    const res = writeProject(body);
    return new Response(JSON.stringify(res), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("invalid body", { status: 400 });
  }
};

export const DELETE: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
    const ok = deleteProject(ctx.params.slug!);
    if (!ok) return new Response("not found", { status: 404 });
    return new Response(
      JSON.stringify({ deleted: true, slug: ctx.params.slug }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("error", { status: 500 });
  }
};
