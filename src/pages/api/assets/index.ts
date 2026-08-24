import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
import {
  getGithubConfig,
  committerFromSession,
  GithubError,
} from "../../../lib/github";
import { listAssets, saveAsset } from "../../../lib/assets";

export const prerender = false;
export const csrfProtection = false;

export const GET: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
    const items = await listAssets();
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
    const form = await ctx.request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response("missing file", { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const saved = await saveAsset(file.name, buf, committerFromSession(ctx));
    return new Response(JSON.stringify(saved), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const status = e instanceof GithubError ? e.status : 400;
    const msg = e instanceof Error ? e.message : "upload failed";
    return new Response(msg, { status });
  }
};
