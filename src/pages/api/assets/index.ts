import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
import { listAssets, saveAsset } from "../../../lib/assets";

export const prerender = false;
export const csrfProtection = false;

export const GET: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
    return new Response(JSON.stringify(listAssets()), {
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
    const form = await ctx.request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response("missing file", { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const saved = saveAsset(file.name, buf);
    return new Response(JSON.stringify(saved), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "upload failed";
    return new Response(msg, { status: 400 });
  }
};
