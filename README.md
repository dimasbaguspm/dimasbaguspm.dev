# dimasbaguspm.dev
Personal site — [dimasbaguspm.dev](https://dimasbaguspm.dev).

- **Astro 5** SSR (Node standalone)
- Posts are Markdown in [`content/posts/`](content/posts/), fetched **at request
  time** from this GitHub repo via `@octokit/rest` — a git commit goes live
  without a rebuild.
- Personal info (name, avatar, bio) comes from the GitHub profile, same API.
- **Tailwind v4** for styling.

## Development (devenv)

The dev environment is defined by [`devenv.nix`](devenv.nix) — it pins
Node 22 + pnpm and starts a local Redis for the response cache.

```sh
cp .env.example .env   # reference — secrets like GITHUB_TOKEN get exported in your shell
devenv shell           # enters the environment (generates devenv.lock on first run)
pnpm dev
```

No devenv? Fall back to manual: `node@22` + `pnpm` + your own Redis at
`localhost:6379` (or leave `REDIS_HOST` empty for uncached direct hits).

Optional envs (see `.env.example`): `REDIS_HOST` (Redis/Valkey cache, direct
octokit hits when unset), `OTEL_HOST` (traces + logs to a collector),
`UMAMI_SRC`/`UMAMI_ID` (analytics script). `GITHUB_TOKEN` only adds rate-limit
headroom — public access works without it.

## Deploy

`pnpm build` then `node ./dist/server/entry.mjs`, or build the Docker image
(`Dockerfile`, prod-only deps — see docker-compose.yml). Pushing to `main`
builds + publishes `:latest` and auto-redeploys via Dokploy.
