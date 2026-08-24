import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
import {
  listProjects,
  writeProject,
  type ProjectInput,
} from "../../../lib/projects";

export const prerender = false;
export const csrfProtection = false;

export const GET: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
    return new Response(JSON.stringify(listProjects()), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("error", { status: 500 });
  }
};

export const POST: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
    const body = (await ctx.request.json()) as ProjectInput;
    if (!body.name || !body.url)
      return new Response("name and url required", { status: 400 });
    const res = writeProject(body);
    return new Response(JSON.stringify(res), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("invalid body", { status: 400 });
  }
};
