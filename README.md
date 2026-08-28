# dimasbaguspm.dev
Personal site — [dimasbaguspm.dev](https://dimasbaguspm.dev).

- **Astro 5** SSR (Node standalone)
- Posts are Markdown in [`content/posts/`](content/posts/), fetched **at request
  time** from this GitHub repo via `@octokit/rest` — a git commit goes live
  without a rebuild.
- Personal info (name, avatar, bio) comes from the GitHub profile, same API.
- **Tailwind v4** for styling.

## Run locally

```sh
pnpm install
pnpm dev
```

Read-only GitHub access works rate-unlimited-ish without a token for a public
repo. Set `GITHUB_TOKEN` if you need headroom:

```sh
cp .env.example .env  # optional
```

Optional envs (see `.env.example`): `REDIS_HOST` (Redis/Valkey response cache,
direct octokit hits when unset), `OTEL_HOST` (traces + logs to a collector),
`UMAMI_SRC`/`UMAMI_ID` (analytics script).

## Deploy

Build a Docker image and run it — `pnpm build` then `node ./dist/server/entry.mjs`.