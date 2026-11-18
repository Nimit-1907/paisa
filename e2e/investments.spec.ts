import { expect, type Locator, type Page, test } from "@playwright/test";

import { deleteDemoRowsNamed } from "./cleanup";
import { signIn } from "./sign-in";

/**
 * The investments ledger, end to end, at a phone's width.
 *
 * A goal with a target, a SIP back-dated two months that posts its own
 * instalments, a lump sum with a partial redemption, an FD that matures
 * today and is paid out, and deletes that leave nothing behind. Records
 * are checked untouched at the end: the ledger is separate by design.
 */

const RUN = Date.now().toString(36).slice(-5);
const GOAL = `E2E Goal ${RUN}`;
const SIP = `E2E SIP ${RUN}`;
const STOCKS = `E2E Stocks ${RUN}`;
const FD = `E2E FD ${RUN}`;

// Whatever a failed run left behind, so the demo account never collects
// "E2E SIP" rows. The test's own deletes still run, and are still checked.
test.afterAll(async () => {
  await deleteDemoRowsNamed("E2E ", ["investments", "investment_goals"]);
});

function sheet(page: Page): Locator {
  return page.getByRole("dialog");
}

async function closeDockedKeypad(page: Page) {
  const done = page
    .locator("[data-docked-keypad]")
    .getByRole("button", { name: "Done", exact: true });
  if (await done.isVisible()) {
    await done.click();
    await expect(done).toBeHidden();
  }
}

async function typeAmount(page: Page, label: string | RegExp, amount: string) {
  const field = sheet(page).getByLabel(label, { exact: true });
  await field.focus();
  await field.fill(amount);
  await closeDockedKeypad(page);
}

/** Opens a date field and types the day, `ddmmyyyy`, as the panel takes it. */
async function pickDate(page: Page, id: string, label: string, digits: string) {
  await page.locator(`#${id}`).click();
  const panel = page.getByRole("dialog", { name: label, exact: true });
  await panel.getByRole("button", { name: "Type the date" }).click();
  await panel.getByLabel(`${label}, as day, month and year`).fill(digits);
  await panel.getByRole("button", { name: "Done", exact: true }).click();
  await expect(panel).toBeHidden();
}

function ddmmyyyy(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}${date.getFullYear()}`;
}

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const node = document.querySelector("main button");
    return node
      ? Object.keys(node).some((key) => key.startsWith("__reactFiber$"))
      : false;
  });
}

/** The confirm dialog on top, over whatever sheet opened it. */
function confirmDialog(page: Page): Locator {
  return page.getByRole("dialog").last();
}

async function deleteInvestment(page: Page, name: string, closed = false) {
  await page.goto("/investments/holdings");
  await hydrated(page);
  if (closed) await page.getByRole("radio", { name: /Closed/ }).click();
  await page
    .getByRole("link", { name: new RegExp(name) })
    .first()
    .click();
  await page.waitForURL(/\/investments\/[0-9a-f-]+/);
  await hydrated(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmDialog(page)
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.waitForURL(/\/investments$/);
}

test("an investment ledger: goals, a SIP that posts itself, a redemption and a payout", async ({
  page,
}) => {
  await signIn(page);

  // It lives under More.
  await page.goto("/more");
  await page.getByRole("link", { name: /Investments/ }).click();
  await page.waitForURL(/\/investments$/);
  await hydrated(page);

  // --------------------------------------------- a SIP, two months back ---
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  await page.getByRole("button", { name: "New investment" }).first().click();
  await sheet(page).getByRole("radio", { name: "SIP" }).click();
  await sheet(page).getByLabel("Name").fill(SIP);
  await typeAmount(page, "Amount", "5000");
  await pickDate(
    page,
    "investment-first-date",
    "First instalment",
    ddmmyyyy(first),
  );
  await sheet(page).getByRole("button", { name: "Add investment" }).click();

  // Three instalments up to today: the 1st of each of the last three months.
  await page.waitForURL(/\/investments\/[0-9a-f-]+/);
  await hydrated(page);
  await expect(page.getByText("with 3 instalments up to today")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Net invested" }),
  ).toContainText("15,000");
  await expect(page.getByText("Auto", { exact: true })).toHaveCount(3);
  const sipUrl = page.url();

  // Pause, then resume.
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

  // ------------------------------------------------------------- a goal ---
  await page.goto("/investments");
  await hydrated(page);
  await page
    .getByRole("navigation", { name: "Investments" })
    .getByRole("link", { name: "Goals" })
    .click();
  await page.waitForURL(/\/investments\/goals$/);
  await hydrated(page);
  await page.getByRole("button", { name: "New goal" }).click();
  await sheet(page).getByLabel("Name").fill(GOAL);
  await typeAmount(page, "Target", "100000");
  await sheet(page).getByRole("button", { name: "Add goal" }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(GOAL) }),
  ).toBeVisible();

  // Into the goal, with a new amount from the next instalment; the past stays.
  await page.goto(sipUrl);
  await hydrated(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await sheet(page).getByRole("radio", { name: GOAL }).click();
  await typeAmount(page, "Amount", "7500");
  await sheet(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Schedule" })).toContainText(
    "7,500",
  );
  await expect(page.getByRole("region", { name: "Details" })).toContainText(
    GOAL,
  );
  await expect(
    page.getByRole("region", { name: "Net invested" }),
  ).toContainText("15,000");

  // ------------------------------------ a lump sum, partly redeemed ---
  await page.goto("/investments");
  await hydrated(page);
  await page.getByRole("button", { name: "New investment" }).click();
  await sheet(page).getByRole("radio", { name: "Stocks" }).click();
  await sheet(page).getByLabel("Name").fill(STOCKS);
  await typeAmount(page, "Amount", "50000");
  await sheet(page).getByRole("button", { name: "Add investment" }).click();
  await page.waitForURL(/\/investments\/[0-9a-f-]+/);
  await hydrated(page);

  await page.getByRole("button", { name: "Redeem" }).click();
  // More than is in: allowed, but said.
  await typeAmount(page, "Amount", "60000");
  await expect(sheet(page).getByText(/takes out more than/)).toBeVisible();
  await typeAmount(page, "Amount", "20000");
  await expect(sheet(page).getByText(/takes out more than/)).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "Save" }).click();

  const hero = page.getByRole("region", { name: "Net invested" });
  await expect(hero).toContainText("30,000");
  await expect(hero).toContainText("50,000");
  await expect(hero).toContainText("20,000");

  // ------------------------------------------- an FD that matures today ---
  await page.goto("/investments");
  await hydrated(page);
  await page.getByRole("button", { name: "New investment" }).click();
  await sheet(page).getByRole("radio", { name: "FD" }).click();
  await sheet(page).getByLabel("Name").fill(FD);
  await typeAmount(page, "Amount", "100000");
  const deposited = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  );
  await pickDate(
    page,
    "investment-first-entry-date",
    "On",
    ddmmyyyy(deposited),
  );
  await pickDate(page, "investment-maturity-date", "Matures on", ddmmyyyy(now));
  await typeAmount(page, "Maturity amount", "107100");
  await sheet(page).getByRole("button", { name: "Add investment" }).click();
  await page.waitForURL(/\/investments\/[0-9a-f-]+/);

  // Coming up says so, with a way to pay it out.
  await page.goto("/investments");
  await hydrated(page);
  const comingUp = page.getByRole("region", { name: "Coming up" });
  await expect(comingUp).toContainText(FD);
  await expect(comingUp).toContainText("Matures today");
  await comingUp.getByRole("link", { name: "Payout" }).click();

  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByLabel("Amount received")).toHaveValue(/107/);
  await sheet(page).getByRole("button", { name: "Save payout" }).click();
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reopen investment" }),
  ).toBeVisible();

  // ------------------------------------------------------- the goal ---
  await page.goto("/investments/goals");
  await hydrated(page);
  const goalCard = page.getByRole("link", { name: new RegExp(GOAL) });
  await expect(goalCard).toContainText("15,000");
  await expect(goalCard).toContainText("15% of");
  await goalCard.click();
  await page.waitForURL(/\/investments\/goals\/[0-9a-f-]+/);
  await expect(page.getByRole("link", { name: new RegExp(SIP) })).toBeVisible();

  // ------------------------------------------------------------ growth ---
  // The SIP adds ₹7,500 a month from here on; in a year that is 12 more.
  await page.goto("/investments/growth");
  await hydrated(page);
  await page.getByRole("radio", { name: "1y" }).click();
  const adding = page.getByRole("region", { name: "What keeps adding" });
  await expect(adding).toContainText(SIP);
  await expect(adding).toContainText("7,500 × 12");
  await expect(adding).toContainText("90,000");

  // --------------------------------------------------------- clean up ---
  await deleteInvestment(page, SIP);
  await deleteInvestment(page, STOCKS);
  await deleteInvestment(page, FD, true);

  await page.goto("/investments/goals");
  await hydrated(page);
  await page.getByRole("link", { name: new RegExp(GOAL) }).click();
  await page.waitForURL(/\/investments\/goals\/[0-9a-f-]+/);
  await hydrated(page);
  await page.getByRole("button", { name: "Edit goal" }).click();
  await sheet(page)
    .first()
    .getByRole("button", { name: "Delete goal" })
    .click();
  await confirmDialog(page)
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.waitForURL(/\/investments\/goals$/);
  await expect(page.getByRole("link", { name: new RegExp(GOAL) })).toHaveCount(
    0,
  );

  // The ledger is separate: nothing of it reached Records.
  await page.goto("/records");
  await hydrated(page);
  await expect(
    page.getByText(new RegExp(`E2E (SIP|Stocks|FD) ${RUN}`)),
  ).toHaveCount(0);
});
