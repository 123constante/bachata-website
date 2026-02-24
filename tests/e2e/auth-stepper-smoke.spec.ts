import { expect, test } from "@playwright/test";

test("auth signup wizard renders and advances", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.context().clearCookies();
  await page.goto("/auth?mode=signup");

  await expect(page.getByRole("heading", { name: "What brings you here?" })).toBeVisible();
  await page.getByRole("button", { name: "Teacher" }).click();

  await expect(page.getByRole("heading", { name: "A little about you" })).toBeVisible();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
});
