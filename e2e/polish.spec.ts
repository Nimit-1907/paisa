import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * The polish pass, as a test rather than a checklist.
 *
 * Three things get checked on every screen, in both themes: that axe finds no
 * WCAG A/AA violation, that nothing scrolls sideways at any of the widths this
 * app claims to support, and that what a thumb is meant to hit is big enough
 * to hit (CLAUDE.md: 44px).
 *
 * It runs against the demo user, so the screens have real records on them,
 * an empty screen passes everything and proves nothing.
 */

/** The widths CLAUDE.md names, plus the two the layout changes at. */
/*
 * Every width Phase 13 names, plus 320, the reflow floor WCAG 1.4.10 asks
 * for, which is narrower than any phone this app targets and is exactly why
 * it is the one worth testing.
 *
 * 768 is tablet portrait, where the bottom tab bar is still correct; 1024 is
 * where the sidebar takes over, so both sides of that line are covered.
 */
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1280, 1536];

const SCREENS = [
  { path: "/records", ready: "Records" },
  { path: "/analysis", ready: "Analysis" },
  { path: "/budgets", ready: "Budgets" },
  { path: "/accounts", ready: "Accounts" },
  { path: "/recurring", ready: "Recurring" },
  { path: "/categories", ready: "Categories" },
  { path: "/more", ready: "More" },
  { path: "/settings", ready: "Settings" },
  { path: "/import", ready: "Import" },
  { path: "/export", ready: "Export" },
  { path: "/about", ready: "About" },
];

/** Everything a thumb is meant to hit, and how big it actually is. */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const tooSmall: { label: string; width: number; height: number }[] = [];

    for (const node of document.querySelectorAll<HTMLElement>(
      "main button, main a, nav button, nav a",
    )) {
      const box = node.getBoundingClientRect();
      // Skip what is not on screen: a collapsed sheet's buttons are still in
      // the DOM and measure zero.
      if (box.width === 0 || box.height === 0) continue;

      // Inline links inside a paragraph are text, not tap targets, and the
      // rule would make a sentence unreadable.
      if (node.closest("p")) continue;

      if (box.height < 44 - 0.5 || box.width < 44 - 0.5) {
        tooSmall.push({
          label:
            node.getAttribute("aria-label") ??
            node.textContent?.trim().slice(0, 40) ??
            node.tagName,
          width: Math.round(box.width),
          height: Math.round(box.height),
        });
      }
    }

    return tooSmall;
  });
}

test.describe("polish", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`every screen is accessible in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });

      for (const screen of SCREENS) {
        await page.goto(screen.path);
        await expect(
          page.getByRole("heading", { name: screen.ready, exact: true }),
        ).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();

        const violations = results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => node.target.join(" ")),
        }));

        expect(violations, `${screen.path} in ${theme} mode`).toEqual([]);
      }
    });
  }

  test("no screen scrolls sideways at any supported width", async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });

      for (const screen of SCREENS) {
        await page.goto(screen.path);
        await expect(
          page.getByRole("heading", { name: screen.ready, exact: true }),
        ).toBeVisible();

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );

        expect(overflow, `${screen.path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("tap targets are thumb-sized on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });

    for (const screen of SCREENS) {
      await page.goto(screen.path);
      await expect(
        page.getByRole("heading", { name: screen.ready, exact: true }),
      ).toBeVisible();

      expect(await smallTargets(page), `${screen.path}`).toEqual([]);
    }
  });

  test("keyboard focus is always visible", async ({ page }) => {
    await page.goto("/records");
    await expect(
      page.getByRole("heading", { name: "Records", exact: true }),
    ).toBeVisible();

    // Walk the first stretch of the tab order and make sure every stop paints
    // something: a focus ring that is only in the stylesheet is no use.
    const invisible: string[] = [];

    for (let step = 0; step < 15; step += 1) {
      await page.keyboard.press("Tab");

      const outcome = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body) return null;

        const style = getComputedStyle(active);
        const ring =
          style.outlineStyle !== "none" ||
          style.boxShadow !== "none" ||
          // Tailwind's ring utilities land on a pseudo-element in some
          // components, so that counts too.
          getComputedStyle(active, "::after").boxShadow !== "none";

        return {
          ring,
          label:
            active.getAttribute("aria-label") ??
            active.textContent?.trim().slice(0, 30) ??
            active.tagName,
        };
      });

      if (outcome && !outcome.ring) invisible.push(outcome.label);
    }

    expect(invisible).toEqual([]);
  });
});
