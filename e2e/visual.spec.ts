import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * Visual snapshots of the five main screens, in both themes, at 360px.
 *
 * This is the guard the other suites cannot be: axe checks semantics, the
 * polish suite checks sizes and overflow, and neither would notice a card
 * losing its border or a number changing weight. A pixel diff would.
 *
 * The baselines are generated on the first run and are deliberately not in
 * git — a PNG keeps every revision of itself in history for ever, and these
 * are regenerated whenever the design moves anyway. Run the suite once to
 * create them, then again to compare:
 *
 *   npm run test:e2e -- e2e/visual.spec.ts
 *
 * Motion is switched off and the data is the seeded demo account, so two runs
 * of the same build produce the same pixels.
 */

const SCREENS = [
  { path: "/records", heading: "Records" },
  { path: "/analysis", heading: "Analysis" },
  { path: "/budgets", heading: "Budgets" },
  { path: "/accounts", heading: "Accounts" },
  { path: "/settings", heading: "Settings" },
];

test.describe("the main screens look the way they looked", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const theme of ["light", "dark"] as const) {
    test(`in ${theme} mode`, async ({ page }) => {
      // Charts and count-ups settle instantly, so the frame being captured
      // is the finished one rather than one in the middle of a transition.
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await signIn(page);

      for (const screen of SCREENS) {
        await page.goto(screen.path);
        await expect(
          page.getByRole("heading", { name: screen.heading, exact: true }),
        ).toBeVisible();

        // The recurring catch-up toast can land mid-capture on the first
        // page of a new day; it is not part of the screen.
        await page.waitForTimeout(1200);

        await expect(page).toHaveScreenshot(
          `${screen.path.slice(1)}-${theme}.png`,
          {
            fullPage: true,
            // A pixel or two of antialiasing on a chart edge is not a
            // regression; a card losing its border is.
            maxDiffPixelRatio: 0.01,
            animations: "disabled",
          },
        );
      }
    });
  }
});
