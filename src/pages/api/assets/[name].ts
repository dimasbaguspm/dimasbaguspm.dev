import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
import {
  getGithubConfig,
  committerFromSession,
  GithubError,
} from "../../../lib/github";
import { deleteAsset } from "../../../lib/assets";

export const prerender = false;
export const csrfProtection = false;

export const DELETE: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
  } catch (e) {
    return e as Response;
  }
  const cfg = getGithubConfig();
  try {
    const name = ctx.params.name!;
    const ok = await deleteAsset(name, committerFromSession(ctx));
    if (!ok) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify({ deleted: true, name }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const status = e instanceof GithubError ? e.status : 500;
    return new Response("error", { status });
  }
};
