import type { APIRoute } from "astro";
import { estimateReadingTime, formatDate, getPostHistory, getProfile, readPost } from "../../lib/posts";
import { getProject } from "../../lib/projects";
import { cachedBuffer } from "../../lib/cache";
import { renderOg } from "../../lib/og";

export const prerender = false;

// One endpoint for every OG image: /og/home.png, /og/posts.png, /og/projects.png
// (listings), /og/<post-slug>.png and /og/<repo-name>.png (detail pages).
export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug ?? "";

  let title: string | null = null;
  let subtitle: string | null = null;
  let meta: { type?: string | null; author?: string | null; date?: string | null; readingTime?: string | null } = {};

  if (slug === "home" || slug === "posts" || slug === "projects") {
    const profile = await getProfile();
    const labels: Record<string, string> = {
      home: profile.name,
      posts: "Articles",
      projects: "Projects",
    };
    title = labels[slug];
    if (slug === "home") subtitle = profile.bio;
    meta = { type: slug === "home" ? null : slug === "posts" ? "Posts" : "Projects", author: profile.name };
  } else {
    const [post, repo, profile] = await Promise.all([readPost(slug), getProject(slug), getProfile()]);
    if (post) {
      const history = await getPostHistory(slug);
      const last = history[0]?.date ?? post.pubDate ?? null;
      title = post.title;
      subtitle = post.description ?? null;
      meta = {
        type: "Post",
        author: profile.name,
        date: last ? formatDate(last) : null,
        readingTime: estimateReadingTime(post.body),
      };
    } else if (repo) {
      title = repo.name;
      subtitle = repo.description;
      meta = { type: "Project", author: profile.name };
    }
  }

  if (!title) return new Response(null, { status: 404 });

  const png = await cachedBuffer(`og:${slug}`, () => renderOg(title!, subtitle, meta));
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
