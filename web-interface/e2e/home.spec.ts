import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("should load and display the heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("should have correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Create Next App/);
  });

  test("should display Deploy Now and Documentation links", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Deploy Now/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Documentation/i }),
    ).toBeVisible();
  });

  test("should have no accessibility violations in heading hierarchy", async ({
    page,
  }) => {
    await page.goto("/");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });
});
