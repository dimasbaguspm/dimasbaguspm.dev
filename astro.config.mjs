// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// SSR: posts and the GitHub profile are fetched at request time via octokit
// (GitHub REST) — a git commit goes live without a rebuild. No admin, no auth.
export default defineConfig({
  site: "https://dimasbaguspm.dev",
  adapter: node({ mode: "standalone" }),
  vite: { plugins: [tailwindcss()] },
  server: { host: "0.0.0.0", port: 4321 },
});