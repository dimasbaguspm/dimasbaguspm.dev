import type { APIRoute } from "astro";
import { readPost } from "../../lib/posts";
import { cachedBuffer } from "../../lib/cache";
import { renderOg } from "../../lib/og";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug ?? "";
  const post = await readPost(slug);
  if (!post) return new Response(null, { status: 404 });
  const png = await cachedBuffer(`og:${slug}`, () => renderOg(post.title));
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
