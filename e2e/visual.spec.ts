import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * Visual snapshots: every screen, and the states a screen can be in.
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
 * the other suites write to, and which the recurring catch-up adds to on the
 * first page load of a new day. Regenerate from a known state:
 *
 *   npm run db:reset && npm run test:e2e -- e2e/visual.spec.ts
 *
 * A diff of a few hundred pixels of height usually means the demo data has
 * moved rather than the design.
 */

/** Every signed-in screen, by the heading that proves it has arrived. */
const SCREENS = [
  { path: "/records", heading: "Records" },
  { path: "/analysis", heading: "Analysis" },
  { path: "/budgets", heading: "Budgets" },
  { path: "/accounts", heading: "Accounts" },
  { path: "/categories", heading: "Categories" },
  { path: "/recurring", heading: "Recurring" },
  { path: "/more", heading: "More" },
  { path: "/settings", heading: "Settings" },
  { path: "/export", heading: "Export" },
];

/** The signed-out screens, which need no account. */
const PUBLIC_SCREENS = [
  { path: "/", name: "landing" },
  { path: "/login", name: "login" },
  { path: "/signup", name: "signup" },
  { path: "/forgot-password", name: "forgot" },
];

/** A phone, and the width the layout becomes a sidebar at. */
const WIDTHS = [
  { label: "360", width: 360, height: 780 },
  { label: "1280", width: 1280, height: 900 },
];

/** Long enough for a chart to finish and the catch-up toast to clear. */
const SETTLE = 1200;

/**
 * Put the demo account into the state these baselines were taken in.
 *
 * Two things on Records vary with what has already happened today rather
 * than with the design, and both change the page's height by hundreds of
 * pixels:
 *
 *  - the **month recap** card, which shows until it is dismissed and whose
 *    dismissal is remembered on the server;
 *  - the **recurring catch-up**, which creates any due records on the first
 *    page load of a new day.
 *
 * Whichever suite loads a page first absorbs both. That made these snapshots
 * depend on the order the suites ran in: generated on their own straight
 * after a reset they are one height, and run after the a11y and journey
 * suites they are another. Doing it here, every time, makes the capture
 * independent of what came before it.
 */
async function settleDemoAccount(page: Page) {
  await page.goto("/records");

  // Wait for the page to be there before asking what is on it. `isVisible`
  // answers immediately, and immediately after a navigation the answer is
  // "no" for everything — which silently skipped the dismissal and left the
  // recap card in whichever run happened to be slower. That is a 263px
  // difference in the height of every Records baseline.
  await expect(
    page.getByRole("heading", { name: "Records", exact: true }),
  ).toBeVisible();

  const dismiss = page.getByRole("button", { name: /dismiss the .* summary/i });
  await dismiss
    .waitFor({ state: "visible", timeout: 3_000 })
    .catch(() => undefined);

  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await expect(dismiss).toBeHidden();
  }

  // The catch-up runs server-side during that first render; this is the
  // round trip that shows its result.
  await page.reload();
  await page.waitForTimeout(SETTLE);
}

/** The same capture settings everywhere, so one screen cannot be laxer. */
const SHOT = {
  fullPage: true,
  // A pixel or two of antialiasing on a chart edge is not a regression;
  // a card losing its border is.
  maxDiffPixelRatio: 0.01,
  animations: "disabled",
} as const;

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
        await settleDemoAccount(page);

        for (const screen of SCREENS) {
          await page.goto(screen.path);
          await expect(
            page.getByRole("heading", { name: screen.heading, exact: true }),
          ).toBeVisible();
          await page.waitForTimeout(SETTLE);

          await expect(page).toHaveScreenshot(
            `${screen.path.slice(1)}-${theme}-${size.label}.png`,
            SHOT,
          );
        }
      });

      test(`the signed-out screens in ${theme} mode`, async ({ page }) => {
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });

        for (const screen of PUBLIC_SCREENS) {
          await page.goto(screen.path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await page.waitForTimeout(600);

          await expect(page).toHaveScreenshot(
            `${screen.name}-${theme}-${size.label}.png`,
            SHOT,
          );
        }
      });

      /**
       * The states a screen goes into that a plain visit never shows.
       *
       * Empty and error are reached honestly — a filter that matches nothing
       * really is the empty state, and a URL with no page behind it really
       * is the 404 — rather than by rendering the component with made-up
       * props, which would snapshot a thing the app cannot actually produce.
       */
      test(`the states in ${theme} mode`, async ({ page }) => {
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await signIn(page);
        await settleDemoAccount(page);

        // Empty: a search that matches nothing.
        await page.goto("/records?q=zzzznothingmatchesthis");
        await expect(
          page.getByRole("heading", { name: /nothing matches/i }),
        ).toBeVisible();
        await page.waitForTimeout(400);
        await expect(page).toHaveScreenshot(
          `state-records-empty-${theme}-${size.label}.png`,
          SHOT,
        );

        // Not found: a record id that is not one.
        await page.goto("/recurring/00000000-0000-4000-8000-000000000000");
        await page.waitForTimeout(600);
        await expect(page).toHaveScreenshot(
          `state-not-found-${theme}-${size.label}.png`,
          SHOT,
        );

        // The add sheet, open, which is where most of the app's chrome lives.
        await page.goto("/records");
        await page
          .getByRole("button", { name: /add record/i })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.waitForTimeout(600);
        await expect(page).toHaveScreenshot(
          `state-add-sheet-${theme}-${size.label}.png`,
          SHOT,
        );
      });
    }
  });
}
