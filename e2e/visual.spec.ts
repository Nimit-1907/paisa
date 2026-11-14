import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * Visual snapshots: five screens and the landing page, both themes, two
 * widths.
 *
 * This is the guard the other suites cannot be. axe checks semantics, the
 * polish suite checks sizes and overflow, and neither would notice a card
 * losing its border, a number changing weight, or the serif on the month
 * card quietly falling back to Inter. A pixel diff would.
 *
 * The baselines are generated on the first run and are deliberately not in
 * git — a PNG keeps every revision of itself in history for ever, and these
 * are regenerated whenever the design moves anyway. Run the suite once to
 * create them, then again to compare:
 *
 *   npm run test:e2e -- e2e/visual.spec.ts
 *
 * Motion is switched off, so two runs of the same build produce the same
 * pixels — *given the same data*. These read the shared demo account, which
 * the other suites write to, so regenerate the baselines from a known state:
 *
 *   npm run db:reset && npm run test:e2e -- e2e/visual.spec.ts
 *
 * A diff of a few hundred pixels of height usually means the demo data has
 * moved rather than the design.
 */

const SCREENS = [
  { path: "/records", heading: "Records" },
  { path: "/analysis", heading: "Analysis" },
  { path: "/budgets", heading: "Budgets" },
  { path: "/accounts", heading: "Accounts" },
  { path: "/settings", heading: "Settings" },
];

/** A phone, and the width the layout becomes a sidebar at. */
const WIDTHS = [
  { label: "360", width: 360, height: 780 },
  { label: "1280", width: 1280, height: 900 },
];

for (const size of WIDTHS) {
  test.describe(`at ${size.label}px`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const theme of ["light", "dark"] as const) {
      test(`the signed-in screens in ${theme} mode`, async ({ page }) => {
        // Charts and count-ups settle instantly, so the frame being captured
        // is the finished one rather than one mid-transition.
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
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
            `${screen.path.slice(1)}-${theme}-${size.label}.png`,
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

      test(`the landing page in ${theme} mode`, async ({ page }) => {
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });

        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForTimeout(600);

        await expect(page).toHaveScreenshot(
          `landing-${theme}-${size.label}.png`,
          { fullPage: true, maxDiffPixelRatio: 0.01, animations: "disabled" },
        );
      });
    }
  });
}
