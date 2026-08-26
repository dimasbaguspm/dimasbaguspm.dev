// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// Static-first, SEO-friendly personal site. Posts are Markdown in src/pages/posts,
// edited via git. No SSR, no admin, no auth.
export default defineConfig({
  site: "https://dimasbaguspm.dev",
  integrations: [mdx(), sitemap()],
});
