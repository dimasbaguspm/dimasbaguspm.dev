import type { APIRoute } from "astro";
import { listPosts } from "../lib/posts";

export const prerender = false;

export const GET: APIRoute = async () => {
  const posts = await listPosts();
  const site = "https://dimasbaguspm.dev";
  const urls = [
    `  <url><loc>${site}/</loc><changefreq>daily</changefreq></url>`,
    `  <url><loc>${site}/cv</loc><changefreq>weekly</changefreq></url>`,
    `  <url><loc>${site}/posts</loc><changefreq>daily</changefreq></url>`,
    ...posts.map(
      (p) =>
        `  <url><loc>${site}/posts/${p.slug}</loc>${
          p.pubDate ? `<lastmod>${p.pubDate}</lastmod>` : ""
        }<changefreq>weekly</changefreq></url>`,
    ),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
};
