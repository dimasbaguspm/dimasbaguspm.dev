---
title: "Hello, world — bootstrapping dimasbaguspm.dev"
description: "Why this site is built with Astro — minimalist, SEO-first, posts and profile fetched from GitHub at request time via octokit."
pubDate: 2026-08-24
tags: ["meta", "astro", "seo"]
---

This is the first post on the site. It's built with **Astro** in SSR mode:
public pages are plain HTML for SEO, posts are Markdown in `content/posts/`
fetched from the GitHub repo **at request time**, and editing happens through
git — no admin dashboard, no database.

```ts
// a post is just Markdown + frontmatter — versionable, portable
export const prerender = false;
```

Personal info (name, avatar, bio) and posts both come from the GitHub API via
`@octokit/rest` — one source of truth, nothing hardcoded. Styling is Tailwind
v4, no CSS framework config to maintain.

Keep it simple, keep it stupid.