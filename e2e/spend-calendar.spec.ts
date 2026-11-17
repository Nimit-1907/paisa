import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("the month card's calendar filters the list to a day, and back", async ({
  page,
}) => {
  await signIn(page);

  const calendar = page.getByRole("grid", { name: /spending by day/i });
  await expect(calendar).toBeVisible();

  // The 1st always has the seeded salary, so it is never a quiet day.
  const first = calendar.getByRole("button", { name: /^\w+day, 1 / });
  await expect(first).toHaveAccessibleName(/(spent|nothing spent)/);
  await first.click();

  const chip = page.getByRole("button", { name: /^Remove filter: on 1 / });
  await expect(chip).toBeVisible();
  await expect(
    calendar.locator('td[aria-selected="true"] button'),
  ).toHaveAttribute("data-day", /-01$/);

  // The same day again takes the filter off.
  await first.click();
  await expect(chip).toHaveCount(0);
});

test("a day after today cannot be chosen", async ({ page }) => {
  await signIn(page);
  const calendar = page.getByRole("grid", { name: /spending by day/i });
  await expect(calendar).toBeVisible();
  const disabled = calendar.locator("button:disabled");
  // Unless today is the month's last day, some days are still to come.
  const today = await calendar
    .locator('[aria-current="date"]')
    .getAttribute("data-day");
  const last = await calendar
    .locator("button[data-day]")
    .last()
    .getAttribute("data-day");
  if (today !== last) await expect(disabled.first()).toBeVisible();
});
