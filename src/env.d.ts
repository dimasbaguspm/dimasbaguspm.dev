/// <reference path="../.astro/types.d.ts" />
interface ImportMetaEnv {
  /** Authentik issuer base, e.g. https://sso.example.com (no trailing slash). */
  OIDC_ISSUER: string;
  /** Authentik application client id. */
  OIDC_CLIENT_ID: string;
  /** Authentik application client secret. */
  OIDC_CLIENT_SECRET: string;
  /** Comma-separated list of allowed subject ids (your Authentik `sub`). */
  OIDC_ALLOWED_SUBS: string;
  /** Public base URL, e.g. https://dimasbaguspm.dev. */
  SITE_URL: string;
  /** Session secret (>=32 random chars). */
  SESSION_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
