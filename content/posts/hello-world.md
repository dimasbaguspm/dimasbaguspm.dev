---
title: "Hello, world — bootstrapping dimasbaguspm.dev"
description: "Why this site is built with Astro — minimalist, SEO-first, posts fetched from GitHub at request time and edited via git."
pubDate: 2026-08-24
tags: ["meta", "astro", "seo"]
author: "Dimas Bagus Prayogo Mukti"
---

This is the first post on the new site. It's built with **Astro** in SSR mode:
public pages are plain HTML for SEO, posts are Markdown in `content/posts/`
fetched from the GitHub repo **at request time**, and editing happens through
git — no admin dashboard, no database.

```ts
// a post is just Markdown + frontmatter — versionable, portable
export const prerender = false;
```

Assets live in my own S3 (MinIO); I upload manually and paste the URL here.
Keep it simple, keep it stupid.
