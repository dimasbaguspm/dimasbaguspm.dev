import type { APIRoute } from "astro";
import { SESSION_COOKIE } from "../../lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return redirect("/admin", 302);
};
