import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("records read as a ledger: dates in a rail, records beside them, no day totals", async ({
  page,
}) => {
  await signIn(page);

  // Today's rail shows its weekday like every other day, and opens that
  // day alone.
  const today = page
    .locator('main section[aria-label="Today"]')
    .getByRole("link", { name: /show this day only/ });
  await expect(today).toBeVisible();
  await expect(today).not.toContainText("Today");

  // The rows only: no day total, no running balance under them.
  const list = page.locator("main section[aria-label]");
  await expect(list.getByText("Day total")).toHaveCount(0);
  await expect(list.getByText(/ left$/)).toHaveCount(0);

  await today.click();
  await expect(
    page.getByRole("button", { name: /^Remove filter: on / }),
  ).toBeVisible();
});
