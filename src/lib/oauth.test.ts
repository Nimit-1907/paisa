import { describe, expect, it } from "vitest";

import { googleSignInEnabled, oauthCallbackUrl } from "./oauth";

describe("oauthCallbackUrl", () => {
  it("comes back to the callback with where to go next", () => {
    expect(oauthCallbackUrl("https://paisa.app", "/budgets")).toBe(
      "https://paisa.app/auth/callback?next=%2Fbudgets",
    );
  });

  it("never sends someone off-site afterwards", () => {
    expect(oauthCallbackUrl("https://paisa.app", "//evil.example")).toBe(
      "https://paisa.app/auth/callback?next=%2Frecords",
    );
  });

  it("defaults to the home screen", () => {
    expect(oauthCallbackUrl("https://paisa.app", undefined)).toBe(
      "https://paisa.app/auth/callback?next=%2Frecords",
    );
  });
});

describe("googleSignInEnabled", () => {
  it("is off unless switched on", () => {
    expect(googleSignInEnabled(undefined)).toBe(false);
    expect(googleSignInEnabled("")).toBe(false);
    expect(googleSignInEnabled("false")).toBe(false);
  });

  it("is on when the flag says so", () => {
    expect(googleSignInEnabled("true")).toBe(true);
    expect(googleSignInEnabled(" TRUE ")).toBe(true);
  });
});
