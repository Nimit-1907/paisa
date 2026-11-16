import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./sign-in";

/**
 * Import, end to end: a file whose header maps itself, a preview with the
 * right counts, one import, and the same file again finding nothing new.
 *
 * The fixture is dated January 2020, well before anything the demo account
 * or the visual baselines look at, and every note carries a tag, so the
 * clean-up at the end can find exactly what this test made and delete it
 * through the Records screen, as a person would.
 */

const FIXTURE = path.join(__dirname, "fixtures", "import.csv");
const TAG = "E2E-IMPORT";
const NOTES = [`${TAG} tea`, `${TAG} books`, `${TAG} refund`, `${TAG} coffee`];

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function upload(page: Page) {
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
}

/** Deletes every record this test could have made, from its row menu. */
async function cleanUp(page: Page) {
  await page.goto(`/records?m=2020-01&q=${TAG}`);
  await expect(page.getByRole("heading", { name: "Records", exact: true })).toBeVisible();

  for (const note of NOTES) {
    const rows = page.getByText(note, { exact: true });
    while ((await rows.count()) > 0) {
      const before = await rows.count();
      await rows.first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await expect(page.getByText("Record deleted")).toBeVisible();
      // From the server, not the optimistic list: two identical rows are
      // otherwise easy to delete one of twice while the list refreshes.
      await page.reload();
      await expect(rows).toHaveCount(before - 1);
    }
  }
}

test("a CSV imports once, and a second upload finds only duplicates", async ({
  page,
}) => {
  await signIn(page);
  // Whatever an interrupted earlier run left, so the counts below hold.
  await cleanUp(page);

  try {
    await page.goto("/import");
    await expect(page.getByRole("heading", { name: "Import", exact: true })).toBeVisible();

    await upload(page);

    // Auto-mapped from "Date,Description,Amount".
    await expect(page.getByLabel("Date", { exact: true })).toHaveText(/Date/);
    await expect(page.getByLabel("Amount", { exact: true })).toHaveText(/Amount/);
    await expect(page.getByLabel("Description", { exact: true })).toHaveText(
      /Description/,
    );

    await choose(page, "Account", "Paytm Wallet");

    const hero = page.getByRole("region", { name: "To import" });
    // Two identical coffees on one day are two records, not one.
    await expect(hero).toContainText("5 records");
    await expect(hero).toContainText("0 duplicates, 1 unreadable");
    await expect(page.getByText('Line 7: the date "31/02/2020"')).toBeVisible();

    // polish.spec sees this screen before a file is chosen; the preview is
    // most of it, so it is checked here.
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations.map((violation) => violation.id)).toEqual([]);

    // Nothing in the history says what "import" is, so the fallbacks fill in.
    const importButton = page.getByRole("button", { name: "Import 5 records" });
    await expect(importButton).toBeDisabled();
    await choose(page, "Fallback for spending", "Food");
    await choose(page, "Fallback for income", "Salary");
    await expect(importButton).toBeEnabled();

    await importButton.click();
    await expect(page.getByText("Imported 5 records, 1 skipped")).toBeVisible();

    // The same file again: every row is already there.
    await upload(page);
    await expect(hero).toContainText("0 records");
    // Both coffees included: each existing record cancels one row.
    await expect(hero).toContainText("5 duplicates, 1 unreadable");
    await expect(page.getByRole("button", { name: "Nothing to import" })).toBeDisabled();
  } finally {
    await cleanUp(page);
  }

  // Left as found: a fresh load of the month has none of them.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Nothing matches those filters" }),
  ).toBeVisible();
});
