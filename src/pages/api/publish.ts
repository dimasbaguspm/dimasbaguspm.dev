import type { APIRoute } from "astro";
import { requireSession } from "../../lib/requireSession";
import { getGithubConfig, mergeToMain, GithubError } from "../../lib/github";

export const prerender = false;
export const csrfProtection = false;

// Merge the GITHUB_CONTENT_BRANCH into GITHUB_BRANCH (main) → triggers the deploy
// CI. This is the "Publish" action the admin presses after editing content.
export const POST: APIRoute = async (ctx) => {
  try {
    await requireSession(ctx);
  } catch (e) {
    return e as Response;
  }
  const cfg = getGithubConfig();
  try {
    const res = await mergeToMain(cfg);
    if (!res.merged) {
      return Response.json({
        published: false,
        message: "Nothing to publish (content branch is up to date).",
      });
    }
    return Response.json({ published: true, sha: res.sha });
  } catch (e) {
    const status = e instanceof GithubError ? e.status : 500;
    const msg = e instanceof Error ? e.message : "publish failed";
    return new Response(`Publish failed: ${msg}`, { status });
  }
};
