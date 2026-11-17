import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";

test("search shows matches as you type, without pressing Enter", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Search" }).first().click();
  const search = page.getByRole("dialog", { name: "Search records" });
  await search.getByLabel("Search notes").pressSequentially("swiggy");

  // The demo data has "Swiggy, biryani" every month. Inside the search
  // screen: the list behind it has the same row.
  await expect(search.getByText("Swiggy, biryani").first()).toBeVisible();
});

test("the share target names its encoding, so Chrome stops warning", async ({
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.share_target.enctype).toBe(
    "application/x-www-form-urlencoded",
  );
});
