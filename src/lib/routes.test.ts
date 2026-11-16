import { describe, expect, it } from "vitest";

import {
  HOME_PATH,
  isAppPath,
  isAuthPath,
  isNeutralPath,
  safeNextPath,
} from "./routes";

describe("safeNextPath", () => {
  it("keeps a path on this site", () => {
    expect(safeNextPath("/budgets")).toBe("/budgets");
    expect(safeNextPath("/records?m=2026-11")).toBe("/records?m=2026-11");
  });

  it("falls back home when there is nothing to resume", () => {
    expect(safeNextPath(null)).toBe(HOME_PATH);
    expect(safeNextPath(undefined)).toBe(HOME_PATH);
    expect(safeNextPath("")).toBe(HOME_PATH);
  });

  it("refuses to bounce the user off-site", () => {
    // `?next=` arrives from the URL bar, so every one of these is reachable
    // by sending someone a crafted login link.
    for (const hostile of [
      "//evil.example.com",
      "https://evil.example.com",
      "http://evil.example.com/records",
      "javascript:alert(1)",
      "evil.example.com",
      // Browsers rewrite a backslash to a slash for http(s), so each of these
      // resolves to //evil.example.com.
      "/\\evil.example.com",
      "/\\/evil.example.com",
      "\\/evil.example.com",
      // Control characters get stripped before the URL is parsed.
      "/\tevil.example.com",
      "/\nevil.example.com",
    ]) {
      expect(safeNextPath(hostile), hostile).toBe(HOME_PATH);
    }
  });
});

describe("route groups", () => {
  it("knows the signed-in area", () => {
    expect(isAppPath("/records")).toBe(true);
    expect(isAppPath("/categories/123")).toBe(true);
    expect(isAppPath("/onboarding")).toBe(true);
    expect(isAppPath("/login")).toBe(false);
  });

  it("knows the signed-out area", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/signup")).toBe(true);
    expect(isAuthPath("/forgot-password")).toBe(true);
    expect(isAuthPath("/records")).toBe(false);
  });

  it("leaves password reset and the callback alone", () => {
    // Both are reached with a session, the recovery link signs the user in
    // first, so neither may be treated as an auth page to bounce away from.
    expect(isNeutralPath("/reset-password")).toBe(true);
    expect(isNeutralPath("/auth/callback")).toBe(true);
    expect(isAuthPath("/reset-password")).toBe(false);
    expect(isAppPath("/reset-password")).toBe(false);
  });

  it("does not match a path that merely starts with the same letters", () => {
    expect(isAppPath("/recordsomething")).toBe(false);
    expect(isAuthPath("/loginsomething")).toBe(false);
  });
});
