import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("a full line saves at once, and Undo takes it back", async ({ page }) => {
  await signIn(page);

  const line = page.getByLabel("Quick add");
  await line.fill("157 E2E quick chai food cash");

  // It says what Enter will do before it is pressed.
  await expect(page.getByText(/Enter saves/)).toBeVisible();
  await expect(page.getByText("₹157 · E2E quick chai · Food · Cash")).toBeVisible();

  await line.press("Enter");
  await expect(line).toHaveValue("");
  await expect(page.getByText("E2E quick chai").first()).toBeVisible();

  // Undo deletes it again, so the demo data is as it was.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("E2E quick chai")).toHaveCount(0);
});

test("a line with no amount opens Add Record with what it read", async ({
  page,
}) => {
  await signIn(page);

  await page.getByLabel("Quick add").fill("E2E quick no amount");
  await expect(page.getByText(/Enter opens Add record/)).toBeVisible();
  await page.getByLabel("Quick add").press("Enter");

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue(
    "E2E quick no amount",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  // Changed from blank, so the sheet asks before dropping it.
  const discard = page.getByRole("button", { name: /discard/i });
  if (await discard.isVisible()) await discard.click();
  await expect(page.getByText("E2E quick no amount")).toHaveCount(0);
});
