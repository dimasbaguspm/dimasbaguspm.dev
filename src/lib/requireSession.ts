// Guard for admin API routes: returns the session or throws a 401 Response.
import type { APIContext } from "astro";
import { readSession } from "./session";

export async function requireSession(ctx: APIContext) {
  const cookie = ctx.request.headers.get("cookie") ?? undefined;
  const session = await readSession(cookie);
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return session;
}
