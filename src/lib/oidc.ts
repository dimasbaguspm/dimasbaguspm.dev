// Minimal OIDC Authorization Code + PKCE client for Authentik.
// No external OIDC dep — just fetch + Web Crypto for the PKCE challenge.

const enc = new TextEncoder();

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return base64url(digest);
}

export function randomString(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64url(bytes.buffer);
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
  const env = import.meta.env;
  const issuer = env.OIDC_ISSUER?.replace(/\/$/, "");
  const allowed = (env.OIDC_ALLOWED_SUBS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    !issuer ||
    !env.OIDC_CLIENT_ID ||
    !env.OIDC_CLIENT_SECRET ||
    !allowed.length
  ) {
    throw new Error("OIDC environment is not fully configured");
  }
  return {
    issuer,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
    redirectUri: `${env.SITE_URL?.replace(/\/$/, "")}/admin/callback`,
    allowedSubs: allowed,
    siteUrl: env.SITE_URL ?? "https://dimasbaguspm.dev",
  };
}

export interface DiscoveredMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint?: string;
}

export async function discover(cfg: OidcConfig): Promise<DiscoveredMetadata> {
  const res = await fetch(`${cfg.issuer}/.well-known/openid-configuration`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  return (await res.json()) as DiscoveredMetadata;
}

export interface AuthRequest {
  url: string;
  state: string;
  verifier: string;
}

/** Build the Authentik authorize URL with PKCE + state. */
export async function buildAuthorizeUrl(
  cfg: OidcConfig,
  meta: DiscoveredMetadata,
): Promise<AuthRequest> {
  const state = randomString(24);
  const verifier = randomString(48);
  const challenge = await sha256Hex(verifier);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return {
    url: `${meta.authorization_endpoint}?${params.toString()}`,
    state,
    verifier,
  };
}

export interface Tokens {
  access_token: string;
  id_token?: string;
  token_type: string;
}

export async function exchangeCode(
  cfg: OidcConfig,
  meta: DiscoveredMetadata,
  code: string,
  verifier: string,
): Promise<Tokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: verifier,
  });
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return (await res.json()) as Tokens;
}

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

export async function getUserInfo(
  meta: DiscoveredMetadata,
  tokens: Tokens,
): Promise<UserInfo> {
  const res = await fetch(meta.userinfo_endpoint, {
    headers: { Authorization: `${tokens.token_type} ${tokens.access_token}` },
  });
  if (!res.ok) throw new Error(`Userinfo failed: ${res.status}`);
  return (await res.json()) as UserInfo;
}

export function isAllowedUser(cfg: OidcConfig, info: UserInfo): boolean {
  return cfg.allowedSubs.includes(info.sub);
}
