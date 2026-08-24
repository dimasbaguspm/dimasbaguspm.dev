import type { APIRoute } from "astro";
import { requireSession } from "../../../lib/requireSession";
import { deleteAsset } from "../../../lib/assets";

export const prerender = false;
export const csrfProtection = false;

export const DELETE: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
    const name = ctx.params.name!;
    const ok = deleteAsset(name);
    if (!ok) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify({ deleted: true, name }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response("error", { status: 500 });
  }
};
