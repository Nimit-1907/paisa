import { expect, test, type Page } from "@playwright/test";

import { confirmationLink, uniqueEmail } from "./mailpit";

/**
 * One account's first half-hour with Paisa.
 *
 * Signup through to an export, in order, because that is how the app is
 * actually met: nothing here is set up behind the scenes, so a break anywhere
 * in the chain, a trigger that stops seeding categories, a sheet that will
 * not open on a touchscreen, fails the test rather than hiding behind a
 * fixture.
 */

const EMAIL = uniqueEmail();
// Obviously a fixture, and overridable so nothing has to be hard-coded in a
// CI that would rather supply its own.
const PASSWORD = process.env.E2E_PASSWORD ?? "test-password-e2e";
const EXPENSE_NOTE = "Chai and samosa";
const TRANSFER_NOTE = "Top up the wallet";
const RENT_NOTE = "Rent, e2e";

test.describe.configure({ mode: "serial" });

/**
 * Waits for React to take over the page.
 *
 * React attaches a `__reactFiber$…` key to every DOM node it owns, so finding
 * one is the signal that hydration has happened. Without this a click can
 * land on server-rendered HTML and be handled by the browser instead of by
 * React, which on a dev server that is still compiling is easy to hit, and
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

/**
 * Types the amount into the field, as a physical keyboard does. The in-app
 * keypad is driven on its own in a11y.spec.ts.
 */
async function typeAmount(page: Page, amount: string) {
  const field = page.getByLabel("Amount");
  await field.focus();
  await field.fill(amount);
  await closeDockedKeypad(page);
}

/**
 * On a phone, a form's amount field docks the keypad over the bottom of
 * the screen, its Save included; Done puts it away, as a thumb would. Add
 * Record's keypad is part of the screen and has no Done, so this is a
 * no-op there.
 */
async function closeDockedKeypad(page: Page) {
  const done = page
    .locator("[data-docked-keypad]")
    .getByRole("button", { name: "Done", exact: true });
  if (await done.isVisible()) {
    await done.click();
    await expect(done).toBeHidden();
  }
}

/** The sheet that is open, whichever shape it took. */
/**
 * The month card on Records.
 *
 * A named region since Phase 13, labelled by the line above its figure,
 * "Left this month", or "Overspent this month" when the month has gone the
 * other way. Matching on "this month" covers both.
 *
 * Scoped rather than asserted against `main`: the row for a record that was
 * just added shows the same amount, so a page-wide check would pass whatever
 * the month total did.
 */
/**
 * Chooses on the Add Record screen: taps the labelled button (Account,
 * Category, From, To), then the tile in the sheet it opens.
 */
async function pick(page: Page, label: string, name: string) {
  await page.getByRole("button", { name: new RegExp(`^${label}\\b`) }).click();
  await page.getByRole("radio", { name, exact: true }).click();
}

function monthCard(page: Page) {
  return page.getByRole("region", { name: /this month/i });
}

function sheet(page: Page) {
  return page.locator(
    '[data-slot="drawer-content"], [data-slot="dialog-content"]',
  );
}

/** The Add Record screen's Save, in its header. */
async function saveRecord(page: Page) {
  await sheet(page).getByRole("button", { name: "Save", exact: true }).click();
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
    await closeDockedKeypad(page);
    await page.getByRole("button", { name: "Start tracking" }).click();

    // Setup ends on a welcome screen rather than a redirect, so the last
    // thing it says is what was set up and what to do next.
    await expect(
      page.getByRole("heading", { name: /You are set up/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Add your first expense" }).click();

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
    await pick(page, "Category", "Food");
    // The account is chosen for you: with no expense yet, the first open
    // account, which is the one onboarding made.
    await expect(
      sheet(page).getByRole("button", { name: "Account, required: Cash" }),
    ).toBeVisible();
    await sheet(page).getByLabel("Note", { exact: true }).fill(EXPENSE_NOTE);
    await saveRecord(page);
    await expect(sheet(page)).toBeHidden();

    await expect(page.getByText(EXPENSE_NOTE).first()).toBeVisible();
    /*
     * The month card, not the page.
     *
     * This is proving the month's expense total, and the row for the record
     * that was just added also says ₹250.00 - against `main` the assertion
     * would pass whatever the total did. Since Phase 13 the card is a named
     * region, labelled by the figure above it: "Left this month" when there
     * is something left and "Overspent this month" when there is not, so
     * the pattern matches either.
     */
    await expect(monthCard(page)).toContainText("₹250.00");
  });

  await test.step("log the expense again", async () => {
    // From the row's menu (right-click here; long-press on a phone). The
    // sheet opens prefilled and saves a second record, not over the first.
    await page.getByText(EXPENSE_NOTE).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Log again" }).click();
    await expect(sheet(page)).toBeVisible();
    await expect(page.getByLabel("Amount")).toHaveValue("250");
    await expect(sheet(page).getByLabel("Note", { exact: true })).toHaveValue(
      EXPENSE_NOTE,
    );
    await saveRecord(page);
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByText(EXPENSE_NOTE)).toHaveCount(2);

    // Delete the copy, so the month's figures below are the journey's own.
    await page.getByText(EXPENSE_NOTE).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText(EXPENSE_NOTE)).toHaveCount(1);
  });

  await test.step("an untouched sheet closes without asking", async () => {
    // The account is pre-selected now; opening and cancelling must still
    // count as no change, or every look at the sheet asks to discard.
    await page.getByRole("button", { name: "Add record" }).first().click();
    await expect(sheet(page)).toBeVisible();
    await sheet(page).getByRole("button", { name: "Cancel" }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(page.getByText("Discard changes?")).toHaveCount(0);
  });

  await test.step("add a transfer", async () => {
    await page.getByRole("button", { name: "Add record" }).first().click();
    await expect(sheet(page)).toBeVisible();

    await sheet(page).getByRole("radio", { name: "Transfer" }).click();
    await typeAmount(page, "500");

    // Both ends are chosen for you: with no transfer yet, From is the first
    // open account and To the next one, never the same as From.
    await expect(
      sheet(page).getByRole("button", { name: "From, required: Cash" }),
    ).toBeVisible();
    await expect(
      sheet(page).getByRole("button", { name: "To, required: Paytm Wallet" }),
    ).toBeVisible();

    await sheet(page).getByLabel("Note", { exact: true }).fill(TRANSFER_NOTE);
    await saveRecord(page);
    await expect(sheet(page)).toBeHidden();

    await expect(page.getByText(TRANSFER_NOTE).first()).toBeVisible();
    // A transfer moves money between the user's own accounts, so the month's
    // expense total must not have moved.
    /*
     * The month card, not the page.
     *
     * This is proving the month's expense total, and the row for the record
     * that was just added also says ₹250.00 - against `main` the assertion
     * would pass whatever the total did. Since Phase 13 the card is a named
     * region, labelled by the figure above it: "Left this month" when there
     * is something left and "Overspent this month" when there is not, so
     * the pattern matches either.
     */
    await expect(monthCard(page)).toContainText("₹250.00");
  });

  await test.step("create a monthly recurring rule", async () => {
    // Rules are made on the Recurring screen and nowhere else: Add Record
    // takes one record and has no Repeat option.
    await page.goto("/recurring");
    await page.getByRole("button", { name: "New recurring" }).click();
    await expect(sheet(page)).toBeVisible();

    await typeAmount(page, "12000");
    await sheet(page).getByRole("radio", { name: "Rent", exact: true }).click();
    await sheet(page).getByLabel("Note", { exact: true }).fill(RENT_NOTE);

    // Monthly, starting today, are the defaults.
    await sheet(page).getByRole("button", { name: "Create rule" }).click();
    await expect(sheet(page)).toBeHidden();

    await expect(page.getByText(RENT_NOTE).first()).toBeVisible();
    await expect(page.getByText(/Monthly on day \d+/)).toBeVisible();

    // It starts today, so today's occurrence is taken from the account as
    // the rule is saved rather than at tomorrow's catch-up.
    await page.goto("/records");
    await expect(page.getByText(RENT_NOTE).first()).toBeVisible();
  });

  await test.step("set a budget", async () => {
    await page.goto("/budgets");

    // A new account has no budgets, so the empty state's action is the way
    // in, and the category is chosen in the sheet. (The "Not budgeted" list
    // that used to offer Food directly is gone.)
    await page.getByRole("button", { name: "Set a budget" }).click();
    await expect(sheet(page)).toBeVisible();
    await sheet(page).getByRole("radio", { name: "Food" }).click();

    await typeAmount(page, "4000");
    await sheet(page).getByRole("button", { name: "Save budget" }).click();

    await expect(
      page.getByRole("heading", { name: /^by category/i }).first(),
    ).toBeVisible();
    /*
     * ₹4,000 budget against the ₹250 expense.
     *
     * Scoped to Food's own row. The figure and the word are separate nodes
     * since Phase 13, each amount carries its exact value as text beside
     * the trimmed one it paints, so this cannot match a single contiguous
     * string any more. Asserting them loose would be worse than useless:
     * "Left this month" is on Records, so a bare search for "left" passes
     * whatever this row says.
     */
    const foodBudget = page
      .getByRole("listitem")
      .filter({ hasText: "Food" })
      .first();

    await expect(foodBudget).toContainText("₹3,750.00");
    await expect(foodBudget).toContainText("left");
  });

  await test.step("analysis shows the same numbers", async () => {
    await page.goto("/analysis");

    // The donut's legend is the per-category breakdown.
    await expect(
      page.getByRole("link", { name: /Rent/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Food/ }).first(),
    ).toBeVisible();

    /*
     * ₹250 food + ₹12,000 rent, and not the ₹500 transfer.
     *
     * The total against `main` because it appears once; Food's own figure
     * against Food's own legend row, since ₹250.00 shows up in several
     * places on this screen.
     */
    await expect(page.locator("main")).toContainText("₹12,250.00");
    await expect(
      page.getByRole("link", { name: /Food/ }).first(),
    ).toContainText("₹250.00");
  });

  await test.step("export the records as CSV", async () => {
    const today = new Date();
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    const to = new Date(today.getTime() + 86_400_000)
      .toISOString()
      .slice(0, 10);

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

    // Since Phase 14 the format is chosen first and there is one download
    // button, which names the file it will produce.
    await expect(
      page.getByRole("button", { name: "Download CSV" }),
    ).toBeEnabled();

    await page.getByRole("radio", { name: /Monthly report/ }).click();
    await expect(
      page.getByRole("button", { name: "Download PDF" }),
    ).toBeEnabled();
  });
});
