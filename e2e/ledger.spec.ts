import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("records read as a ledger: dates in a rail, records beside them, no day totals", async ({
  page,
}) => {
  await signIn(page);

  // The newest day: its rail shows the date and the weekday, never "Today",
  // and opens that day alone. Not tied to today's date, so the test holds
  // on a day with nothing recorded yet.
  const firstDay = page
    .locator("main section[aria-label]")
    .filter({
      has: page.getByRole("link", { name: /show this day only/ }),
    })
    .first();
  const rail = firstDay.getByRole("link", { name: /show this day only/ });
  await expect(rail).toBeVisible();
  await expect(rail).toHaveText(/^\d{1,2}\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/);

  // The rows only: no day total, no running balance under them.
  const list = page.locator("main section[aria-label]");
  await expect(list.getByText("Day total")).toHaveCount(0);
  await expect(list.getByText(/ left$/)).toHaveCount(0);

  await rail.click();
  await expect(
    page.getByRole("button", { name: /^Remove filter: on / }),
  ).toBeVisible();
});
