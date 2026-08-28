---
title: "Writing on dimasbaguspm.dev — how posts go live"
description: "A short tour of how this site serves Markdown from GitHub at request time, and how to write a post that looks right the first time."
pubDate: 2026-08-29
tags: ["meta", "writing", "astro"]
---

This site is built with **Astro** in SSR mode. Posts live as Markdown in
`content/posts/`, fetched from the GitHub repo at request time via Octokit. That
means writing a post is just a commit: no build step, no admin panel, no database.

```ts
// a post is Markdown + frontmatter, versionable and portable
export const prerender = false;
```

## The shape of a post

Every file starts with frontmatter. Three fields matter most:

- `title` becomes the H1
- `description` becomes the SEO and share-preview text
- `pubDate` sets the sort order (newest first)

Tags render as small `#pills` under the title. Keep them short and lowercase.

## What renders well

Inline `code` gets a grey pill. Fenced blocks get a dark GitHub theme:

```bash
pnpm build   # only if you want to verify locally
```

Links are underlined green. Quotes get a green left border. Tables scroll on
mobile. The accent is a calm green (`#2f6f4f`) pulled from the site theme.

## The rule that saves you

SEO tags are generated for you from the frontmatter. Write a real `description`
and you never touch a meta tag by hand.

Keep it simple, keep it stupid.