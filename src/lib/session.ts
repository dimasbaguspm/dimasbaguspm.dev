// Signed session cookie for the /admin area. HMAC-SHA256 over the payload,
// base64url encoded. Verified on each request; tampered cookies are rejected.

const enc = new TextEncoder();

function b64url(input: string | ArrayBuffer): string {
  const str =
    typeof input === "string"
      ? input
      : String.fromCharCode(...new Uint8Array(input));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(input: string): string {
  const pad = input.length % 4 ? "=".repeat(4 - (input.length % 4)) : "";
  return atob(input.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(sig);
}

export interface SessionData {
  sub: string;
  email?: string;
  name?: string;
}

const COOKIE = "dbpm_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function createSession(
  secret: string,
  data: SessionData,
): Promise<string> {
  const payload = b64url(
    JSON.stringify({ ...data, exp: Date.now() + MAX_AGE * 1000 }),
  );
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function readSession(
  secret: string,
  cookie?: string,
): Promise<SessionData | null> {
  if (!cookie) return null;
  const [payload, sig] = cookie.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(secret, payload);
  if (sig !== expected) return null;
  try {
    const json = JSON.parse(b64urlDecode(payload)) as SessionData & {
      exp: number;
    };
    if (json.exp < Date.now()) return null;
    return { sub: json.sub, email: json.email, name: json.name };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE;
