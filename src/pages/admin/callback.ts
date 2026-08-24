import type { APIRoute } from "astro";
import {
  getOidcConfig,
  discover,
  exchangeCode,
  getUserInfo,
  isAllowedUser,
} from "../../lib/oidc";
import {
  createSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "../../lib/session";

export const prerender = false;

const STATE_COOKIE = "dbpm_oauth_state";
const VERIFIER_COOKIE = "dbpm_oauth_verifier";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies.get(STATE_COOKIE)?.value;
  const verifier = cookies.get(VERIFIER_COOKIE)?.value;

  if (!code || !state || !storedState || !verifier) {
    return new Response("Missing OAuth parameters", { status: 400 });
  }
  if (state !== storedState) {
    return new Response("State mismatch (possible CSRF)", { status: 400 });
  }

  try {
    const cfg = getOidcConfig();
    const meta = await discover(cfg);
    const tokens = await exchangeCode(cfg, meta, code, verifier);
    const info = await getUserInfo(meta, tokens);

    if (!isAllowedUser(cfg, info)) {
      return new Response("Not an authorized user", { status: 403 });
    }

    const session = await createSession(cfg.clientSecret, {
      sub: info.sub,
      email: info.email,
      name: info.name ?? info.preferred_username,
    });
    cookies.delete(STATE_COOKIE, { path: "/" });
    cookies.delete(VERIFIER_COOKIE, { path: "/" });
    cookies.set(SESSION_COOKIE, session, {
      path: "/",
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
    return redirect("/admin", 302);
  } catch (err) {
    return new Response(`Auth failed: ${(err as Error).message}`, {
      status: 500,
    });
  }
};
