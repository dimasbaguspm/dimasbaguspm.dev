import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
import {
  getGithubConfig,
  committerFromSession,
  GithubError,
} from "../../../lib/github";
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
    const items = await listProjects();
    return new Response(JSON.stringify(items), {
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
  } catch (e) {
    return e as Response;
  }
  const cfg = getGithubConfig();
  try {
    const body = (await ctx.request.json()) as ProjectInput;
    if (!body.name || !body.url)
      return new Response("name and url required", { status: 400 });
    const res = await writeProject(body, committerFromSession(ctx));
    return new Response(JSON.stringify(res), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const status = e instanceof GithubError ? e.status : 400;
    return new Response("invalid body", { status });
  }
};
