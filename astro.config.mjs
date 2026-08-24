// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";

// Astro 5: default output is "static" and every page is prerendered unless it
// opts out with `export const prerender = false`. The Node adapter serves the
// on-demand (SSR) routes (admin, article mutations) while public pages stay
// static/server-rendered HTML for SEO with no client JS.
export default defineConfig({
  site: "https://dimasbaguspm.dev",
  adapter: node({ mode: "standalone" }),
  integrations: [mdx(), sitemap()],
  server: { host: "0.0.0.0", port: 4321 },
  prefetch: false,
  // The admin API (create/edit/delete articles) is an authenticated JSON API
  // behind the OIDC session; writes use fetch with same-origin cookies. Disable
  // Astro's built-in cross-origin check so DELETE/PUT work from the admin UI.
  security: { checkOrigin: false },
});
