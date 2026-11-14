import type { Page } from "@playwright/test";

/**
 * The demo user, signed in.
 *
 * Shared by the suites that need screens with records already on them: an
 * empty screen passes every check and proves nothing.
 *
 * The wait is for hydration rather than for the network — the form renders
 * on the server, so it is visible and fillable a moment before React has
 * attached anything that would submit it.
 */
export const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? "demo@example.com";
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "password123";

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.waitForFunction(() => {
    const node = document.querySelector("button");
    return node
      ? Object.keys(node).some((key) => key.startsWith("__reactFiber$"))
      : false;
  });

  await page.getByLabel("Email").fill(DEMO_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/records/, { timeout: 60_000 });
}
