---
title: "Hello, world — bootstrapping dimasbaguspm.dev"
description: "Why this site is built with Astro — minimalist, SEO-first, Markdown posts in the pages dir, edited via git."
pubDate: 2026-08-24
tags: ["meta", "astro", "seo"]
author: "Dimas Bagus Putra Mahottama"
layout: ../../layouts/Post.astro
---

This is the first post on the new site. It's built with **Astro** in static
mode: public pages are plain HTML for SEO, posts are Markdown files in
`src/pages/posts/`, and editing happens through git — no admin dashboard, no
database.

```ts
// a post is just Markdown + frontmatter — versionable, portable
export const prerender = true;
```

Assets live in my own S3 (MinIO); I upload manually and paste the URL here.
Keep it simple, keep it stupid.
