import type { APIRoute } from "astro";
import { getProfile, getProject, readPost } from "../../lib/posts";
import { cachedBuffer } from "../../lib/cache";
import { renderOg } from "../../lib/og";

export const prerender = false;

// One endpoint for every OG image: /og/home.png, /og/posts.png, /og/projects.png
// (listings), /og/<post-slug>.png and /og/<repo-name>.png (detail pages).
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug ?? "";

  let title: string | null = null;
  let subtitle: string | null = null;

  if (slug === "home" || slug === "posts" || slug === "projects") {
    const profile = await getProfile();
    const labels: Record<string, string> = {
      home: profile.name,
      posts: "Articles",
      projects: "Projects",
    };
    title = labels[slug];
    if (slug === "home") subtitle = profile.bio;
  } else {
    const [post, repo] = await Promise.all([readPost(slug), getProject(slug)]);
    if (post) {
      title = post.title;
    } else if (repo) {
      title = repo.name;
      subtitle = repo.description;
    }
  }

  if (!title) return new Response(null, { status: 404 });

  const png = await cachedBuffer(`og:${slug}`, () => renderOg(title, subtitle));
  const body = png.buffer.slice(
    png.byteOffset,
    png.byteOffset + png.byteLength,
  );
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
