// Server-side runtime config. Reads from process.env (so secrets are NOT
// inlined at build time like import.meta.env is). import.meta.env values are
// statically replaced during `astro build`, which makes them useless for
// runtime secrets on the standalone Node server — always use process.env here.

function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedSubs: string[];
  siteUrl: string;
}

export function getOidcConfig(): OidcConfig {
  const issuer = env("OIDC_ISSUER").replace(/\/$/, "");
  const allowed = env("OIDC_ALLOWED_SUBS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    !issuer ||
    !env("OIDC_CLIENT_ID") ||
    !env("OIDC_CLIENT_SECRET") ||
    !allowed.length
  ) {
    throw new Error("OIDC environment is not fully configured");
  }
  return {
    issuer,
    clientId: env("OIDC_CLIENT_ID"),
    clientSecret: env("OIDC_CLIENT_SECRET"),
    redirectUri: `${env("SITE_URL").replace(/\/$/, "")}/admin/callback`,
    allowedSubs: allowed,
    siteUrl: env("SITE_URL", "https://dimasbaguspm.dev"),
  };
}

/** Shared HMAC secret for session cookies — must be the same at sign + verify. */
export function sessionSecret(): string {
  return env("OIDC_CLIENT_SECRET");
}
