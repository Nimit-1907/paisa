import { expect, test, type Page } from "@playwright/test";

import { confirmationLink, uniqueEmail } from "./mailpit";

/**
 * One account's first half-hour with Paisa.
 *
 * Signup through to an export, in order, because that is how the app is
 * actually met: nothing here is set up behind the scenes, so a break anywhere
 * in the chain — a trigger that stops seeding categories, a sheet that will
 * not open on a touchscreen — fails the test rather than hiding behind a
 * fixture.
 */

const EMAIL = uniqueEmail();
// Obviously a fixture, and overridable so nothing has to be hard-coded in a
// CI that would rather supply its own.
const PASSWORD = process.env.E2E_PASSWORD ?? "test-password-e2e";
const EXPENSE_NOTE = "Chai and samosa";
const TRANSFER_NOTE = "Top up the wallet";
const RENT_NOTE = "Rent — e2e";

test.describe.configure({ mode: "serial" });

/**
 * Waits for React to take over the page.
 *
 * React attaches a `__reactFiber$…` key to every DOM node it owns, so finding
 * one is the signal that hydration has happened. Without this a click can
 * land on server-rendered HTML and be handled by the browser instead of by
 * React — which on a dev server that is still compiling is easy to hit, and
 * which silently turns a form submit into a plain GET.
 */
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const candidates = document.querySelectorAll("form, main, button, input");
    for (const node of candidates) {
      if (Object.keys(node).some((key) => key.startsWith("__reactFiber$"))) {
        return true;
      }
    }
    return false;
  });
}

/** Taps a keypad digit by digit, the way a thumb would. */
async function typeAmount(page: Page, amount: string) {
  for (const key of amount.split("")) {
    await page.getByRole("button", { name: key, exact: true }).click();
  }
}

/** The sheet that is open, whichever shape it took. */
function sheet(page: Page) {
  return page.locator(
    '[data-slot="drawer-content"], [data-slot="dialog-content"]',
  );
}

/**
 * The sheet's primary button, whatever it currently says.
 *
 * It names the result — "Save expense · ₹250", "Move ₹500 to Paytm Wallet" —
 * so matching on the exact word "Save" stopped working the moment that
 * became true, and matching the whole string would make this test assert the
 * copy rather than the flow. The kind of record is in the pattern because
 * "Save and add another" sits beside it and would otherwise match too.
 */
async function saveRecord(page: Page) {
  await sheet(page)
    .getByRole("button", { name: /^(Save (expense|income|changes)|Move) / })
    .click();
}

test("signup, onboarding, records, budget, recurring, analysis, export", async ({
  page,
}) => {
  await test.step("sign up and confirm the email", async () => {
    await page.goto("/signup");
    await hydrated(page);

    await page.getByLabel("Email").fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: /create account|sign up/i }).click();

    // The app says to go and check the inbox; the test goes and checks it.
    await expect(page.getByText(/check your (email|inbox)/i)).toBeVisible();

    await page.goto(await confirmationLink(EMAIL));
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  });

  await test.step("finish onboarding", async () => {
    await hydrated(page);
    await page.getByLabel("Your name").fill("E2E Tester");
    await page.getByRole("button", { name: "Continue" }).click();

    // Step two is the currency; the default is the rupee, which is what the
    // amounts below are written in.
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Account name").fill("Cash");
    await page.getByLabel("Opening balance").fill("5000");
    await page.getByRole("button", { name: "Start tracking" }).click();

    // Setup ends on a welcome screen rather than a redirect, so the last
    // thing it says is what was set up and what to do next.
    await expect(
      page.getByRole("heading", { name: /You are set up/ }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Add your first expense" })
      .click();

    await page.waitForURL(/\/records/, { timeout: 60_000 });

    // That button lands on Records with the sheet already open, which is the
    // point of it. Close it: a dialog hides the page behind it from a screen
    // reader, and from a role query.
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(
      page.getByRole("heading", { name: "Records", exact: true }),
    ).toBeVisible();
  });

  await test.step("add a second account, so a transfer has somewhere to go", async () => {
    await page.goto("/accounts");
    await page.getByRole("button", { name: "Add account" }).first().click();

    await sheet(page).getByLabel("Name", { exact: true }).fill("Paytm Wallet");
    await sheet(page).getByRole("button", { name: "Add account" }).click();

    await expect(page.getByText("Paytm Wallet").first()).toBeVisible();
  });

  await test.step("add an expense", async () => {
    await page.goto("/records");
    await page.getByRole("button", { name: "Add record" }).first().click();

    await expect(sheet(page)).toBeVisible();
    await typeAmount(page, "250");
    await sheet(page).getByRole("button", { name: "Food", exact: true }).click();

    // The note, the date and the repeat are folded away: most records need
    // none of them, and a shorter sheet is why a record takes four taps.
    await sheet(page).getByRole("button", { name: "More options" }).click();
    await sheet(page).getByLabel("Note", { exact: true }).fill(EXPENSE_NOTE);
    await saveRecord(page);
    await expect(sheet(page)).toBeHidden();

    await expect(page.getByText(EXPENSE_NOTE).first()).toBeVisible();
    await expect(page.getByLabel("This month")).toContainText("₹250.00");
  });

  await test.step("add a transfer", async () => {
    await page.getByRole("button", { name: "Add record" }).first().click();
    await expect(sheet(page)).toBeVisible();

    await sheet(page).getByRole("radio", { name: "Transfer" }).click();
    await typeAmount(page, "500");

    // "From" defaults to the first account; "To" has to be chosen. Both
    // groups list the same accounts, so the group's own name is what tells
    // them apart.
    await sheet(page)
      .getByRole("group", { name: "To", exact: true })
      .getByRole("button", { name: "Paytm Wallet" })
      .click();

    await sheet(page).getByRole("button", { name: "More options" }).click();
    await sheet(page).getByLabel("Note", { exact: true }).fill(TRANSFER_NOTE);
    await saveRecord(page);
    await expect(sheet(page)).toBeHidden();

    await expect(page.getByText(TRANSFER_NOTE).first()).toBeVisible();
    // A transfer moves money between the user's own accounts, so the month's
    // expense total must not have moved.
    await expect(page.getByLabel("This month")).toContainText("₹250.00");
  });

  await test.step("create a monthly recurring rule", async () => {
    await page.getByRole("button", { name: "Add record" }).first().click();
    await expect(sheet(page)).toBeVisible();

    await typeAmount(page, "12000");
    await sheet(page).getByRole("button", { name: "Rent", exact: true }).click();

    await sheet(page).getByRole("button", { name: "More options" }).click();
    await sheet(page).getByLabel("Note", { exact: true }).fill(RENT_NOTE);
    await sheet(page).getByRole("radio", { name: "Monthly" }).click();
    await saveRecord(page);
    await expect(sheet(page)).toBeHidden();

    await expect(page.getByText(RENT_NOTE).first()).toBeVisible();

    await page.goto("/recurring");
    await expect(page.getByText(RENT_NOTE).first()).toBeVisible();
    await expect(page.getByText(/Monthly on day \d+/)).toBeVisible();
  });

  await test.step("set a budget", async () => {
    await page.goto("/budgets");

    // Food has spending and no limit, so it is in "Not budgeted" — named
    // explicitly because that list is ordered by how much was spent, and Rent
    // is the bigger number.
    await page
      .getByRole("listitem")
      .filter({ hasText: "Food" })
      .getByRole("button", { name: "Set budget" })
      .click();
    await expect(sheet(page)).toBeVisible();

    await sheet(page).getByLabel(/Monthly limit/).fill("4000");
    await sheet(page).getByRole("button", { name: "Save budget" }).click();

    // The headings are upper-cased in CSS, so the match has to ignore case:
    // innerText reports what is painted, not what is in the DOM.
    await expect(
      page.getByRole("heading", { name: /budgeted · 1/i }).first(),
    ).toBeVisible();
    // ₹4,000 budget against the ₹250 expense.
    await expect(page.getByText("₹3,750.00 left")).toBeVisible();
  });

  await test.step("analysis shows the same numbers", async () => {
    await page.goto("/analysis");

    // The donut's legend is the per-category breakdown.
    await expect(page.getByRole("link", { name: /Rent/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Food/ }).first()).toBeVisible();

    // ₹250 food + ₹12,000 rent, and not the ₹500 transfer.
    await expect(page.locator("main")).toContainText("₹12,250.00");
    await expect(page.locator("main")).toContainText("₹250.00");
  });

  await test.step("export the records as CSV", async () => {
    const today = new Date();
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    const to = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);

    // page.request shares the browser context's cookies, so this is the same
    // signed-in session the UI is using.
    const response = await page.request.get(
      `/api/export/csv?from=${from}&to=${to}`,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toContain("attachment");

    const csv = await response.text();
    expect(csv).toContain("Date,Time,Type,Category,Account");
    expect(csv).toContain(EXPENSE_NOTE);
    expect(csv).toContain(TRANSFER_NOTE);
    expect(csv).toContain(RENT_NOTE);
  });

  await test.step("the export page offers both files", async () => {
    await page.goto("/export");
    await expect(
      page.getByRole("button", { name: "Download CSV" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Download PDF" }),
    ).toBeEnabled();
  });
});
