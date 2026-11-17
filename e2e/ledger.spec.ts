import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("records read as a ledger: a date rail, and each day's total and balance", async ({
  page,
}) => {
  await signIn(page);

  // Today's day is labelled in the rail and opens that day alone.
  const today = page.getByRole("link", { name: /Today.*show this day only/ });
  await expect(today).toBeVisible();
  await expect(today).toContainText("Today");

  // Each day ends on its total and what was left after it.
  const firstDay = page.locator('main section[aria-label="Today"]');
  await expect(firstDay.getByText(/ left$/)).toBeVisible();

  // Narrowed to one day, there is no running balance to speak of.
  await today.click();
  await expect(
    page.getByRole("button", { name: /^Remove filter: on / }),
  ).toBeVisible();
  await expect(
    page.locator("main section[aria-label]").getByText(/ left$/),
  ).toHaveCount(0);
});
