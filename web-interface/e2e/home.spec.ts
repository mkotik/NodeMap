import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("should load successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/NodeMap/);
  });

  test("should have dark background (Deep Space foundation)", async ({
    page,
  }) => {
    await page.goto("/");
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    // #060e20 = rgb(6, 14, 32)
    expect(bg).toBe("rgb(6, 14, 32)");
  });
});
