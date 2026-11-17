import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("the filter only offers what the month and the type can have", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: /^Filter/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filter" });

  // All: two labelled grids, so the two "Gifts" can be told apart.
  await expect(sheet.getByText("Spending categories")).toBeVisible();
  await expect(sheet.getByText("Income categories")).toBeVisible();

  // Expense: no income categories on offer.
  await sheet.getByRole("radio", { name: "Expense" }).click();
  await expect(sheet.getByRole("checkbox", { name: "Food" })).toBeVisible();
  await expect(sheet.getByRole("checkbox", { name: "Salary" })).toHaveCount(0);

  // Dates stay inside the month on screen.
  await expect(sheet.getByRole("button", { name: "Last month" })).toHaveCount(
    0,
  );
  await sheet.getByRole("button", { name: "Last 7 days" }).click();
  await sheet.getByRole("button", { name: "Show results" }).click();

  await expect(page.getByText(/^\d+\+? records?$/)).not.toHaveText(
    /^0 records$/,
  );
});

test("search is search only; filtering is the Filter button's", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Search" }).first().click();
  await expect(page.getByText("Or narrow it down")).toHaveCount(0);
});
