import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * Accessibility, where the polish suite does not reach.
 *
 * `polish.spec.ts` runs axe over the signed-in screens. This one covers what
 * a screen scan cannot see: the pages a visitor meets before signing in, a
 * sheet while it is open, and the keyboard behaviour that only exists if
 * somebody drives it, the skip link, focus coming back, Enter in the keypad.
 */

/** WCAG 2.2 AA, which is what this phase commits to. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Everything reachable without an account. */
const PUBLIC_PAGES = [
  { path: "/", heading: "Know where the month went." },
  { path: "/features", heading: "Features" },
  { path: "/faq", heading: "Questions" },
  { path: "/privacy", heading: "Privacy" },
  { path: "/login", heading: "Welcome back" },
  { path: "/signup", heading: /./ },
  { path: "/forgot-password", heading: /./ },
];

async function violationsOn(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

test.describe("the public pages", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`are accessible in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });

      for (const target of PUBLIC_PAGES) {
        await page.goto(target.path);
        await expect(
          page.getByRole("heading", { level: 1 }).first(),
        ).toBeVisible();

        expect(
          await violationsOn(page),
          `${target.path} in ${theme} mode`,
        ).toEqual([]);
      }
    });
  }

  /**
   * WCAG 1.4.10 asks for 320 CSS pixels, which is a 360px phone at 200% zoom
   * and the narrowest anyone will see this.
   */
  test("reflow at 320px without a sideways scrollbar", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });

    for (const target of PUBLIC_PAGES) {
      await page.goto(target.path);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );

      expect(overflow, `${target.path} at 320px`).toBeLessThanOrEqual(0);
    }
  });

  test("tell a crawler what they are", async ({ page }) => {
    await page.goto("/");

    const landing = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(JSON.parse(landing ?? "{}")["@type"]).toBe("SoftwareApplication");

    await page.goto("/faq");
    const faq = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    const parsed = JSON.parse(faq ?? "{}");
    expect(parsed["@type"]).toBe("FAQPage");
    expect(parsed.mainEntity.length).toBeGreaterThan(3);

    // Every answer the markup claims is also on the page, which is what the
    // rich result requires and what an honest one means.
    for (const entry of parsed.mainEntity) {
      await expect(page.getByText(entry.name, { exact: true })).toBeVisible();
    }
  });

  test("point a crawler at the public pages and away from the rest", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /records");
    expect(robots).toContain("Sitemap:");

    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const path of ["/features", "/faq", "/privacy"]) {
      expect(sitemap).toContain(path);
    }
    expect(sitemap).not.toContain("/records");
  });
});

test.describe("the keyboard", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("gets past the navigation in one tab", async ({ page }) => {
    await page.goto("/records");
    // `level: 1` because the record count below it is an h2 reading
    // "20 records", which a substring match on "Records" also finds.
    await expect(
      page.getByRole("heading", { level: 1, name: "Records" }),
    ).toBeVisible();

    await page.keyboard.press("Tab");
    const first = page.getByRole("link", { name: "Skip to content" });
    await expect(first).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeVisible();
  });

  test("stays inside an open sheet, and comes back out to where it was", async ({
    page,
  }) => {
    await page.goto("/records");
    const fab = page.getByRole("button", { name: /add record/i }).first();

    await fab.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();

    // The amount is what the sheet was opened to take, so that is where
    // focus should land.
    await expect(page.getByLabel("Amount")).toBeFocused();

    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      );
      expect(inside, `tab stop ${step + 1} left the sheet`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(fab).toBeFocused();
  });

  test("drives the amount field without touching it", async ({ page }) => {
    await page.goto("/records");
    await page
      .getByRole("button", { name: /add record/i })
      .first()
      .click();
    await expect(page.getByLabel("Amount")).toBeFocused();

    // An amount and nothing else: the operator and the letter never land.
    await page.keyboard.type("4a00/.505");
    await expect(page.getByLabel("Amount")).toHaveValue("400.50");

    // The keypad, too: ⌫ then the digit back, without moving focus.
    const keypad = page.getByRole("group", { name: "Keypad" });
    await keypad.getByRole("button", { name: "Delete last digit" }).click();
    await keypad.getByRole("button", { name: "0", exact: true }).click();
    await expect(page.getByLabel("Amount")).toHaveValue("400.50");
    await expect(page.getByLabel("Amount")).toBeFocused();

    await page.getByRole("button", { name: /^Category\b/ }).click();
    await page.getByRole("radio", { name: "Groceries" }).first().click();
    // The account is already chosen: the one expenses last used.
    await expect(
      page.getByRole("button", { name: /^Account, required: (?!Choose)/ }),
    ).toBeVisible();

    // Back in the amount, Enter saves. The sheet is not a form, so without
    // this the one key everybody presses would do nothing.
    await page.getByLabel("Amount").focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("dialog")).toBeHidden();

    // Undo, straight away. This runs against the shared demo account, and a
    // test that leaves a record behind quietly rewrites the data every other
    // test reads, the visual baselines noticed before anybody else did.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeHidden();
  });

  test("finds no violation inside an open sheet", async ({ page }) => {
    await page.goto("/records");
    await page
      .getByRole("button", { name: /add record/i })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();

    expect(await violationsOn(page), "the add record sheet").toEqual([]);
  });
});

test.describe("motion", () => {
  test("is gone when the system asks for it to be", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/budgets");
    await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible();

    // Nothing left that takes a perceptible amount of time to move.
    const slow = await page.evaluate(() => {
      const offenders: string[] = [];

      for (const node of document.querySelectorAll<HTMLElement>("*")) {
        const style = getComputedStyle(node);
        const durations = [
          ...style.transitionDuration.split(","),
          ...style.animationDuration.split(","),
        ];

        for (const duration of durations) {
          const value = duration.trim();
          const ms = value.endsWith("ms")
            ? Number.parseFloat(value)
            : Number.parseFloat(value) * 1000;

          // The spinner keeps turning: it is a status, not decoration.
          if (ms > 1 && !node.className.toString().includes("animate-spin")) {
            offenders.push(`${node.tagName}.${node.className} ${value}`);
          }
        }
      }

      return offenders.slice(0, 5);
    });

    expect(slow).toEqual([]);
  });
});

test("offers Continue with Google only when it is switched on", async ({
  page,
}) => {
  // Off by default: a button that ends on a provider error is worse than
  // none. The build under test decides which state is right.
  const on = process.env.AUTH_GOOGLE === "true";
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toHaveCount(on ? 1 : 0);
  }
});
