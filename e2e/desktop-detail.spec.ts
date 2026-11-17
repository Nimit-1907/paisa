import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

test("on a wide screen a record opens in a panel beside the list, not a dialog", async ({
  page,
}) => {
  await signIn(page);

  const panel = page.getByRole("complementary", { name: "Record" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Pick a record")).toBeVisible();

  await page.getByText("Amazon, household").first().click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(panel.getByText("Amazon, household")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Edit" })).toBeVisible();

  // The row says it is the one on show.
  await expect(
    page.locator('[aria-current="true"]').getByText("Amazon, household"),
  ).toBeVisible();

  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel.getByText("Pick a record")).toBeVisible();
});

test("a phone still opens the record as a sheet", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await signIn(page);
  await page.getByText("Amazon, household").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await context.close();
});
