import { beforeEach, describe, expect, it } from "vitest";

import { getVerifiedUser, verifyHs256 } from "./verify";

const TEST_KEY = "fake-test-signing-key-not-a-real-one-000000";
const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);

function b64url(input: string | Uint8Array): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(
  payload: Record<string, unknown>,
  { secret = TEST_KEY, alg = "HS256" } = {},
): Promise<string> {
  const head = b64url(JSON.stringify({ alg, typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`;
}

const valid = {
  sub: "6f1c2b9e-0000-4000-8000-000000000001",
  email: "someone@example.com",
  role: "authenticated",
  aud: "authenticated",
  iss: "https://project.example.test/auth/v1",
  exp: NOW / 1000 + 600,
};

describe("verifyHs256", () => {
  it("accepts a token signed with the secret", async () => {
    const claims = await verifyHs256(await sign(valid), TEST_KEY, NOW);
    expect(claims?.sub).toBe(valid.sub);
  });

  it("refuses another secret's signature", async () => {
    const token = await sign(valid, {
      secret: "fake-other-test-signing-key-not-real-111111",
    });
    expect(await verifyHs256(token, TEST_KEY, NOW)).toBeNull();
  });

  it("refuses a payload changed after signing", async () => {
    const [head, , signature] = (await sign(valid)).split(".");
    const forged = b64url(JSON.stringify({ ...valid, sub: "someone-else" }));
    expect(
      await verifyHs256(`${head}.${forged}.${signature}`, TEST_KEY, NOW),
    ).toBeNull();
  });

  it("refuses an expired token", async () => {
    const token = await sign({ ...valid, exp: NOW / 1000 - 1 });
    expect(await verifyHs256(token, TEST_KEY, NOW)).toBeNull();
  });

  it("refuses alg none and garbage", async () => {
    const head = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
    const body = b64url(JSON.stringify(valid));
    expect(await verifyHs256(`${head}.${body}.`, TEST_KEY, NOW)).toBeNull();
    expect(await verifyHs256("not-a-token", TEST_KEY, NOW)).toBeNull();
    const good = await sign(valid);
    const [h, p] = good.split(".");
    expect(await verifyHs256(`${h}.${p}.!!!`, TEST_KEY, NOW)).toBeNull();
    expect(await verifyHs256(`${h}.${p}.x`, TEST_KEY, NOW)).toBeNull();
  });
});

describe("getVerifiedUser", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.example.test/";
  });

  function client(token: string | null, { active = true } = {}) {
    return {
      rpc: async () => ({ data: active, error: null }),
      auth: {
        getSession: async () => ({
          data: { session: token ? { access_token: token } : null },
          error: null,
        }),
        getClaims: async () => {
          throw new Error("must not be reached with the secret set");
        },
      },
    } as unknown as Parameters<typeof getVerifiedUser>[0];
  }

  it("returns the user from a valid token, without asking Auth", async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_KEY;
    const token = await sign({ ...valid, exp: Date.now() / 1000 + 600 });
    expect(await getVerifiedUser(client(token))).toEqual({
      id: valid.sub,
      email: valid.email,
    });
  });

  it("refuses a session signed out elsewhere", async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_KEY;
    const token = await sign({ ...valid, exp: Date.now() / 1000 + 600 });
    expect(await getVerifiedUser(client(token, { active: false }))).toBeNull();
  });

  it("refuses another issuer's token", async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_KEY;
    const token = await sign({
      ...valid,
      iss: "https://elsewhere.example.test/auth/v1",
      exp: Date.now() / 1000 + 600,
    });
    expect(await getVerifiedUser(client(token))).toBeNull();
  });

  it("refuses a token for another audience", async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_KEY;
    const token = await sign({
      ...valid,
      aud: "something-else",
      exp: Date.now() / 1000 + 600,
    });
    expect(await getVerifiedUser(client(token))).toBeNull();
  });

  it("returns null with no session, and for an anon token", async () => {
    process.env.SUPABASE_JWT_SECRET = TEST_KEY;
    expect(await getVerifiedUser(client(null))).toBeNull();
    const anon = await sign({
      role: "anon",
      exp: Date.now() / 1000 + 600,
    });
    expect(await getVerifiedUser(client(anon))).toBeNull();
  });
});
