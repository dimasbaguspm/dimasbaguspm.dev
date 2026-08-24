import type { APIRoute } from "astro";
import { getOidcConfig, discover, buildAuthorizeUrl } from "../../lib/oidc";

// Start the OIDC Authorization Code + PKCE flow. Stores state + verifier in
// short-lived cookies so the callback can verify them.
export const prerender = false;

const STATE_COOKIE = "dbpm_oauth_state";
const VERIFIER_COOKIE = "dbpm_oauth_verifier";

export const GET: APIRoute = async ({ redirect, cookies }) => {
  try {
    const cfg = getOidcConfig();
    const meta = await discover(cfg);
    const { url, state, verifier } = await buildAuthorizeUrl(cfg, meta);
    cookies.set(STATE_COOKIE, state, {
      path: "/",
      maxAge: 600,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
    cookies.set(VERIFIER_COOKIE, verifier, {
      path: "/",
      maxAge: 600,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
    return redirect(url, 302);
  } catch (err) {
    return new Response(`Login failed: ${(err as Error).message}`, {
      status: 500,
    });
  }
};
