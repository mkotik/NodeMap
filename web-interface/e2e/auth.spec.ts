import { test, expect } from "@playwright/test";

// Run tests serially — later tests depend on the user created by registration
test.describe.configure({ mode: "serial" });

const DEMO_USER = {
  firstName: "Demo",
  lastName: "User",
  email: `demo+${Date.now()}@nodemap.test`,
  password: "TestPass123!",
};

test.describe("Authentication", () => {
  test("should show sign in link in sidebar when not logged in", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".sidebar__sign-in")).toBeVisible();
    await expect(page.locator(".sidebar__sign-in")).toContainText("Sign In");
  });

  test("should navigate to login page from sidebar", async ({ page }) => {
    await page.goto("/");
    await page.click(".sidebar__sign-in");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator(".auth-login__logo")).toContainText(
      "NodeMap.io",
    );
  });

  test("should show login form by default", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator(".auth-login__title")).toContainText(
      "Sign in to NodeMap.io",
    );
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#firstName")).not.toBeVisible();
    await expect(page.locator("#lastName")).not.toBeVisible();
  });

  test("should toggle to register form", async ({ page }) => {
    await page.goto("/auth/login");
    await page.click(".auth-login__toggle-btn");
    await expect(page.locator(".auth-login__title")).toContainText(
      "Create your account",
    );
    await expect(page.locator("#firstName")).toBeVisible();
    await expect(page.locator("#lastName")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("should show validation error for short password", async ({ page }) => {
    await page.goto("/auth/login");
    await page.click(".auth-login__toggle-btn");

    await page.fill("#firstName", "Test");
    await page.fill("#lastName", "User");
    await page.fill("#email", "short@test.com");
    await page.fill("#password", "short");
    await page.click(".auth-login__submit");

    const input = page.locator("#password");
    const validity = await input.evaluate(
      (el: HTMLInputElement) => el.validity.valid,
    );
    expect(validity).toBe(false);
  });

  test("should register a new user and redirect to home", async ({ page }) => {
    await page.goto("/auth/login");
    await page.click(".auth-login__toggle-btn");

    await page.fill("#firstName", DEMO_USER.firstName);
    await page.fill("#lastName", DEMO_USER.lastName);
    await page.fill("#email", DEMO_USER.email);
    await page.fill("#password", DEMO_USER.password);
    await page.click(".auth-login__submit");

    await expect(page).toHaveURL("/", { timeout: 15000 });
    await expect(page.locator(".sidebar__user-name")).toContainText(
      `${DEMO_USER.firstName} ${DEMO_USER.lastName}`,
    );
    await expect(page.locator(".sidebar__sign-in")).not.toBeVisible();
  });

  test("should show error for duplicate email registration", async ({
    page,
  }) => {
    // Clear cookies so we're logged out
    await page.context().clearCookies();
    await page.goto("/auth/login");
    await page.click(".auth-login__toggle-btn");

    await page.fill("#firstName", "Another");
    await page.fill("#lastName", "Person");
    await page.fill("#email", DEMO_USER.email);
    await page.fill("#password", DEMO_USER.password);
    await page.click(".auth-login__submit");

    await expect(page.locator(".auth-login__error")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show error for wrong password", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/auth/login");

    await page.fill("#email", DEMO_USER.email);
    await page.fill("#password", "WrongPassword123!");
    await page.click(".auth-login__submit");

    await expect(page.locator(".auth-login__error")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".auth-login__error")).toContainText(
      "Invalid email or password",
    );
  });

  test("should show error for non-existent email", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/auth/login");

    await page.fill("#email", "nobody@nodemap.test");
    await page.fill("#password", "SomePassword123!");
    await page.click(".auth-login__submit");

    await expect(page.locator(".auth-login__error")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should login with existing user and redirect to home", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/auth/login");

    await page.fill("#email", DEMO_USER.email);
    await page.fill("#password", DEMO_USER.password);
    await page.click(".auth-login__submit");

    await expect(page).toHaveURL("/", { timeout: 15000 });
    await expect(page.locator(".sidebar__user-name")).toContainText(
      DEMO_USER.firstName,
    );
  });

  test("should persist session across page reload", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/auth/login");
    await page.fill("#email", DEMO_USER.email);
    await page.fill("#password", DEMO_USER.password);
    await page.click(".auth-login__submit");
    await expect(page).toHaveURL("/", { timeout: 15000 });

    await page.reload();
    await expect(page.locator(".sidebar__user-name")).toContainText(
      DEMO_USER.firstName,
      { timeout: 10000 },
    );
  });

  test("should logout and show sign in link again", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/auth/login");
    await page.fill("#email", DEMO_USER.email);
    await page.fill("#password", DEMO_USER.password);
    await page.click(".auth-login__submit");
    await expect(page).toHaveURL("/", { timeout: 15000 });

    await page.click(".sidebar__logout");
    await expect(page.locator(".sidebar__sign-in")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".sidebar__user-name")).not.toBeVisible();
  });

  test("should show Google sign-in button on login page", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator(".auth-login__google-btn")).toBeVisible();
  });
});
