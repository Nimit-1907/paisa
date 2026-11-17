import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

/*
 * On the demo user, so it puts back what it changes: the record ends the
 * test untagged, as the seed left it.
 */
test("a spend marked as a regret is badged, totalled and filterable", async ({
  page,
}) => {
  await signIn(page);

  const row = page.getByText("Dinner at Barbeque Nation").first();
  await row.click();

  const sheet = page.getByRole("dialog");
  const regret = sheet.getByRole("button", { name: "Regret" });
  await expect(regret).toHaveAttribute("aria-pressed", "false");
  await regret.click();
  await expect(regret).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  // The row says so, and the month card adds it up and links to the list.
  await expect(page.getByRole("img", { name: "Regretted" }).first()).toBeVisible();
  const line = page.getByRole("link", { name: /regretted/ });
  await expect(line).toBeVisible();
  await line.click();
  await expect(
    page.getByRole("button", { name: "Remove filter: Regretted" }),
  ).toBeVisible();
  await expect(page.getByText("Dinner at Barbeque Nation")).toBeVisible();

  // The same button again takes it off, and the line goes with it.
  await page.getByText("Dinner at Barbeque Nation").first().click();
  await sheet.getByRole("button", { name: "Regret" }).click();
  await expect(sheet.getByRole("button", { name: "Regret" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Remove filter: Regretted" }).click();
  await expect(page.getByRole("link", { name: /regretted/ })).toHaveCount(0);
});

test("only a spend asks whether it was worth it", async ({ page }) => {
  await signIn(page);
  await page.getByText("Salary credited").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("group", { name: "Worth it?" }),
  ).toHaveCount(0);
});
