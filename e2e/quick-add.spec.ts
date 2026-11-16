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

test("holding a chip over a half-typed record fills it instead", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/records");
  await page.getByRole("button", { name: "Add record" }).first().click();

  // Something typed first: the hold must not throw it away unasked.
  const keypad = page.getByRole("group", { name: "Keypad" });
  await keypad.getByRole("button", { name: "4", exact: true }).click();
  await keypad.getByRole("button", { name: "8", exact: true }).click();

  const chip = page
    .getByRole("group", { name: "Quick add" })
    .getByRole("button")
    .first();
  const box = await chip.boundingBox();
  if (!box) throw new Error("chip has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Expense saved")).toHaveCount(0);
  await expect(page.getByLabel("Amount")).not.toHaveValue("48");
});
