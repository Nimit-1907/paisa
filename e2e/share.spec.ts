import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("the install manifest offers Paisa as a share target", async ({
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.share_target).toMatchObject({
    action: "/share",
    method: "GET",
  });
});

test("a shared payment opens Add Record filled in, and saves nothing by itself", async ({
  page,
}) => {
  await signIn(page);
  await page.goto(
    `/share?text=${encodeURIComponent("You paid ₹450 to E2E Share Payee")}`,
  );

  // Over Records, with the share's own URL gone.
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("450");
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue(
    "E2E Share Payee",
  );

  // Untouched, it closes without asking, and nothing was saved.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Discard changes?")).toHaveCount(0);
  await expect(page.getByText("E2E Share Payee")).toHaveCount(0);
});

test("a repeated field in the share is read, not an error", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/share?text=Paid&text=%E2%82%B9120%20to%20E2E%20Repeat");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Amount")).toHaveValue("120");
  await page.getByRole("button", { name: "Cancel" }).click();
});
