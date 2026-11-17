import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

/*
 * On the demo user's weekly "Metro card top-up", due in the next week. The
 * test pays it and undoes it, so the schedule ends where it began.
 */
test("Recurring's due-soon rule can be paid now, and Undo puts it back", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/recurring");

  const dueSoon = page.getByRole("region", { name: /Due soon/ });
  const row = dueSoon
    .getByRole("listitem")
    .filter({ hasText: "Metro card top-up" });
  await expect(row).toContainText("19");

  await row.getByRole("button", { name: /Pay now/ }).click();
  await expect(page.getByText("Paid early")).toBeVisible();

  // Paid: the rule has moved on a week, out of the next seven days.
  await expect(row).toHaveCount(0);

  // Undo deletes the record and the schedule comes back to the same day.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(row).toContainText("19");
  await expect(row.getByRole("button", { name: /Pay now/ })).toBeVisible();
});

test("Records no longer carries an Upcoming card", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("region", { name: "Upcoming" })).toHaveCount(0);
});
