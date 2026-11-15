/**
 * Screenshots for docs/screens.md.
 *
 * Every screen, both themes, 360 and 1280 — the four pictures Phase 13 asks
 * for per screen. Written as a script rather than done by hand because
 * "take the same four shots of nineteen screens" is seventy-six chances to
 * take one at the wrong width and not notice.
 *
 *   node scripts/shots.mjs                 # every screen
 *   node scripts/shots.mjs records budgets # just these
 *
 * Needs the dev server (or a built one) on E2E_BASE_URL, and the seeded demo
 * account. Output lands in docs/screenshots/, which is gitignored: the repo
 * does not carry binaries, and these are a working reference rather than a
 * baseline. The baselines that gate the build live in e2e/visual.spec.ts.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_DEMO_EMAIL ?? "demo@example.com";
const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "password123";
const OUT = "docs/screenshots";

/** The widths Phase 13 names: a small phone and a laptop. */
const WIDTHS = [
  { name: "360", width: 360, height: 820 },
  { name: "1280", width: 1280, height: 900 },
];

/**
 * Each screen, and what has to be true before it is worth photographing.
 *
 * `ready` is a selector that only exists once the screen has its data, so a
 * shot is never of a skeleton that happened to still be on screen.
 */
const SCREENS = [
  { id: "landing", path: "/", auth: false, ready: "h1" },
  { id: "login", path: "/login", auth: false, ready: "form" },
  { id: "signup", path: "/signup", auth: false, ready: "form" },
  { id: "forgot", path: "/forgot-password", auth: false, ready: "form" },
  { id: "records", path: "/records", ready: "main" },
  { id: "analysis", path: "/analysis", ready: "main" },
  { id: "budgets", path: "/budgets", ready: "main" },
  { id: "accounts", path: "/accounts", ready: "main" },
  { id: "categories", path: "/categories", ready: "main" },
  { id: "recurring", path: "/recurring", ready: "main" },
  { id: "more", path: "/more", ready: "main" },
  { id: "settings", path: "/settings", ready: "main" },
  { id: "export", path: "/export", ready: "main" },
];

async function signIn(page) {
  await page.goto(`${BASE}/login`);
  await page.waitForFunction(() => {
    const node = document.querySelector("button");
    return node
      ? Object.keys(node).some((key) => key.startsWith("__reactFiber$"))
      : false;
  });
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/records/, { timeout: 120_000 });
}

const wanted = process.argv.slice(2);
const screens = wanted.length
  ? SCREENS.filter((screen) => wanted.includes(screen.id))
  : SCREENS;

if (!screens.length) {
  console.error(`No screen matched. Known: ${SCREENS.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
let taken = 0;

for (const theme of ["light", "dark"]) {
  for (const size of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      colorScheme: theme,
      deviceScaleFactor: 2,
      isMobile: size.width < 768,
      hasTouch: size.width < 768,
      // Motion off, so two runs of the same build produce the same pixels.
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    // The dev server floats its own badge over the bottom-left corner. It is
    // not part of the app, and it would otherwise be in every shot taken
    // against `next dev`. An init script runs on each navigation, which is
    // what a one-off addStyleTag would not survive.
    await page.addInitScript(() => {
      const hide = () => {
        const style = document.createElement("style");
        style.textContent =
          "nextjs-portal, #next-logo, [data-nextjs-toast] { display: none !important }";
        document.head?.append(style);
      };
      if (document.head) hide();
      else document.addEventListener("DOMContentLoaded", hide);
    });

    let signedIn = false;
    for (const screen of screens) {
      if (screen.auth !== false && !signedIn) {
        await signIn(page);
        signedIn = true;
      }

      await page.goto(`${BASE}${screen.path}`, { waitUntil: "networkidle" });
      await page.waitForSelector(screen.ready, { timeout: 60_000 });
      // Fonts settled: a shot taken mid-swap shows the fallback serif.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);

      const file = `${OUT}/${screen.id}-${size.name}-${theme}.png`;
      await page.screenshot({ path: file, fullPage: true });
      taken += 1;
      console.log(file);
    }

    await context.close();
  }
}

await browser.close();
console.log(`\n${taken} screenshots in ${OUT}/`);
