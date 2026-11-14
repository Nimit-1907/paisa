import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests, on a phone.
 *
 * 390×844 is an iPhone 14/15 viewport and the size most of this app was
 * designed against — CLAUDE.md starts at 360px, and anything that works there
 * works here. Running the suite anywhere else would miss the bottom nav, the
 * FAB and the sheets, which is most of the UI.
 *
 * The tests need the local Supabase stack (`npm run db:start`) and a seeded
 * database; they sign up a fresh user each run rather than leaning on the
 * demo one, so they can be run repeatedly without resetting anything.
 */
export default defineConfig({
  testDir: "./e2e",
  // One journey, in order: each step depends on the records the one before
  // it created, and running them in parallel would mean six signups.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // One long journey rather than ten short ones, so this budget covers the
  // whole thing — including the dev server compiling each route the first
  // time it is asked for, which is most of the first minute.
  timeout: 300_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["iPhone 14"],
    // Chromium rather than WebKit: it is the engine already installed for
    // this project, and the app has no WebKit-specific code paths.
    browserName: "chromium",
    isMobile: true,
    hasTouch: true,
  },

  /**
   * A production build, not `next dev`.
   *
   * The dev server compiles each route the first time it is asked for, which
   * turns the first visit to every screen into a several-second wait and the
   * suite into a test of the compiler. A built server also measures what a
   * user would actually get.
   *
   * reuseExistingServer is on even in CI: two Next processes sharing one
   * .next directory overwrite each other's chunks, which shows up as a page
   * that renders but never hydrates — a failure that looks like a bug in the
   * app and is not one.
   */
  webServer: {
    command: "npm run build && npm start",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
