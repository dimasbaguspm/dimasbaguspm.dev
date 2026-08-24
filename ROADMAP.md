# dimasbaguspm.dev — Build Roadmap (stacked PRs)

Repo: `dimasbaguspm/dimasbaguspm.dev` (Astro 5, static-first + Node adapter).
Policy: feature branches off `main`, stacked, **squash-merge only** when
Verify CI is green; commits authored as `dimasbaguspm`; branch protection
enforces squash-only + Verify-green.

## Phases (each = one PR, stacked on the previous)
- **Phase 0** (PR #1, `feat/scaffold-phase0`): Repo + Astro scaffold + content
  schema + SEO layout + public pages + Verify CI + branch protection. ✅ done.
- **Phase 1** (`feat/phase1-public-polish`): Public-site polish — typography,
  tags/archive pages, RSS feed, image optimization, 404, pagination.
- **Phase 2** (`feat/phase2-oidc-auth`): Authentik OIDC login (Authorization
  Code + PKCE) + session cookie + `/admin` route guard + logout. ✅ done.
- **Phase 3** (`feat/phase3-admin-articles`): Admin article editor (list/create/
  edit/delete MDX), draft toggle, publish (writes Markdown to content dir). ✅ done.
- **Phase 4** (`feat/phase4-admin-assets`): Asset upload (images/files) to
  mounted volume, list/delete, manager UI. ✅ done (PR #4).
- **Phase 5** (`feat/phase5-admin-projects`): Highlighted projects CRUD (JSON). ✅ done (PR #5).
- **Phase 6** (`feat/phase6-deploy`): Docker + Caddy deploy — **DROPPED** per user.

## Stacking rule
Each phase branch is cut from `main` AFTER the previous phase is squash-merged.
Working branch name pattern: `feat/phase{n}-{slug}`.

## Key config
- Auth env (see `.env.example`): OIDC_ISSUER, OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET, OIDC_ALLOWED_SUBS, SITE_URL, SESSION_SECRET.
- Public content: `src/content/articles/*.mdx`, `src/content/projects/*.json`.
- Uploaded assets: `public/assets/uploads/` (gitignored, mounted volume in prod).
