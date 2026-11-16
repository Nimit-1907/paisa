import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Who is signed in, checked without asking the Auth server.
 *
 * `getUser()` is a round trip to Auth on every call, and the local Auth
 * server answers them one at a time: a page load is the document plus the
 * dock's five prefetches, each with a middleware check and a layout check,
 * and twelve of those queued for 260ms in front of an empty Records screen.
 *
 * The access token is a signed JWT, so the signature can be checked here
 * instead:
 *
 * - HS256 (the local stack, and projects on the legacy secret): verified
 *   with SUPABASE_JWT_SECRET through Web Crypto, which runs in middleware
 *   too.
 * - Asymmetric keys (new hosted projects): `getClaims()`, which verifies
 *   against the project's published JWKS and caches it.
 * - HS256 without the secret configured: `getClaims()` again, which falls
 *   back to `getUser()`. Slower, never wrong.
 *
 * A signature alone cannot know that the session was signed out on another
 * device, or that its user was deleted, so one more question goes to the
 * database: `session_is_active()`, an indexed lookup in auth.sessions.
 * PostgREST answers those in parallel, which is the whole difference from
 * Auth's /user. Revocation is immediate, as it was with getUser().
 *
 * Writes go further still: server actions call `requireUser()`, which asks
 * Auth, and every query is checked against the same token by RLS.
 */
export type VerifiedUser = { id: string; email: string | null };

type Claims = {
  sub?: unknown;
  aud?: unknown;
  iss?: unknown;
  email?: unknown;
  exp?: unknown;
  role?: unknown;
};

const encoder = new TextEncoder();
// Cached against the secret it was imported from, so a changed secret
// (rotation, a test) imports a new key rather than verifying with the old.
let hmacKey: { secret: string; key: Promise<CryptoKey> } | null = null;

function keyFor(secret: string): Promise<CryptoKey> {
  if (hmacKey?.secret !== secret) {
    hmacKey = {
      secret,
      key: crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    };
  }
  return hmacKey.key;
}

function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
  } catch {
    return null;
  }
}

/** The claims of an HS256 token signed with `secret`, or null. */
export async function verifyHs256(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<Claims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  if (decodeJson(header)?.alg !== "HS256") return null;

  // atob throws on a malformed segment; a cookie is not trusted input, and
  // a broken one means signed out, not a 500.
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = base64UrlToBytes(signature);
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await keyFor(secret),
    signatureBytes,
    encoder.encode(`${header}.${payload}`),
  );
  if (!valid) return null;

  const claims = decodeJson(payload) as Claims | null;
  if (!claims || typeof claims.exp !== "number") return null;
  if (claims.exp * 1000 <= now) return null;

  return claims;
}

/** Who issues this project's tokens: `<project url>/auth/v1`. */
function expectedIssuer(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url.replace(/\/+$/, "")}/auth/v1` : null;
}

function toUser(claims: Claims | null | undefined): VerifiedUser | null {
  if (!claims || typeof claims.sub !== "string" || claims.sub === "") {
    return null;
  }
  // Another Auth server that happened to share the secret is not this one.
  const issuer = expectedIssuer();
  if (issuer && claims.iss !== issuer) return null;
  // An anon-key token is signed too, and carries no user. Auth issues a
  // signed-in user's token for the "authenticated" audience; anything else
  // signed with the same secret is not a session.
  if (claims.role !== "authenticated") return null;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes("authenticated")) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}

/**
 * The signed-in user from the session cookie, verified, or null.
 *
 * `getSession()` reads the cookie and refreshes an expired token (which is
 * why middleware must call this through a client that can write cookies);
 * it is never trusted on its own, the token it returns is verified below,
 * and then its session is looked up.
 */
export async function getVerifiedUser(supabase: {
  auth: Pick<SupabaseClient["auth"], "getSession" | "getClaims">;
  rpc: SupabaseClient<Database>["rpc"];
}): Promise<VerifiedUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  const user = await verifiedClaims(supabase, token);
  if (!user) return null;

  // Fails closed: a database that cannot answer is not a yes.
  const { data: active, error } = await supabase.rpc("session_is_active");
  if (error) console.error("[auth]", error.message);
  return active === true ? user : null;
}

async function verifiedClaims(
  supabase: { auth: Pick<SupabaseClient["auth"], "getClaims"> },
  token: string,
): Promise<VerifiedUser | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (secret && decodeJson(token.split(".")[0] ?? "")?.alg === "HS256") {
    return toUser(await verifyHs256(token, secret));
  }

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data) return null;
  return toUser(data.claims as Claims);
}
