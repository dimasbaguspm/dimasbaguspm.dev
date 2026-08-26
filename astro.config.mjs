// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";

// SSR: posts are fetched from the GitHub repo at request time (GitHub Contents
// API), so a git commit is live without a rebuild. No admin, no auth.
export default defineConfig({
  site: "https://dimasbaguspm.dev",
  adapter: node({ mode: "standalone" }),
  integrations: [mdx(), sitemap()],
  server: { host: "0.0.0.0", port: 4321 },
});
