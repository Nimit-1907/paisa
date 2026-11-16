import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("holding a quick-add chip saves it at once", async ({ page }) => {
  await signIn(page);
  await page.goto("/records");
  await page.getByRole("button", { name: "Add record" }).first().click();

  const chip = page
    .getByRole("group", { name: "Quick add" })
    .getByRole("button")
    .first();
  await expect(chip).toBeVisible();

  // Held, not tapped: down, wait past the hold, up.
  const box = await chip.boundingBox();
  if (!box) throw new Error("chip has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Expense saved")).toBeVisible();

  // Undo, so the shared demo account is left as it was found.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeHidden();
});
