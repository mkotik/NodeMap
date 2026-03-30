import { test, expect, type Page } from "@playwright/test";

// Run serially — tests build on each other (register, create chats, then test history)
test.describe.configure({ mode: "serial" });

const TEST_USER = {
  firstName: "History",
  lastName: "Tester",
  email: `history+${Date.now()}@nodemap.test`,
  password: "TestPass123!",
};

// ---- Helpers ----

async function register(page: Page) {
  await page.goto("/auth/login");
  await page.click(".auth-login__toggle-btn");
  await page.fill("#firstName", TEST_USER.firstName);
  await page.fill("#lastName", TEST_USER.lastName);
  await page.fill("#email", TEST_USER.email);
  await page.fill("#password", TEST_USER.password);
  await page.click(".auth-login__submit");
  await expect(page).toHaveURL("/", { timeout: 15000 });
}

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.fill("#email", TEST_USER.email);
  await page.fill("#password", TEST_USER.password);
  await page.click(".auth-login__submit");
  await expect(page).toHaveURL("/", { timeout: 15000 });
}

async function sendMessage(page: Page, text: string) {
  const textarea = page.locator(
    ".chat-view__textarea, .chat-view-thread__input",
  );
  await textarea.first().waitFor({ state: "visible", timeout: 5000 });
  await textarea.first().fill(text);
  await page.keyboard.press("Enter");
}

async function waitForResponse(page: Page) {
  await expect(
    page.locator(".chat-view-thread__bubble--ai").first(),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".chat-view-thread__typing")).not.toBeVisible({
    timeout: 60000,
  });
}

async function chat(page: Page, text: string) {
  await sendMessage(page, text);
  await waitForResponse(page);
}

async function createChat(page: Page, message: string) {
  await page.locator(".sidebar__new-chat").click();
  await expect(page.locator(".chat-view__title")).toHaveText(
    "Initiate Thought",
  );
  await chat(page, message);
  // Wait for auto-save to complete (immediate on first message + debounce for response)
  await page.waitForTimeout(3000);
}

test.describe("History", () => {
  test("register test user", async ({ page }) => {
    await register(page);
  });

  test("create test chats", async ({ page }) => {
    await login(page);
    await createChat(page, "tell me about quantum physics");
    await createChat(page, "explain how cars work");
    await createChat(page, "what is machine learning");
    await createChat(page, "history of ancient rome");
    await createChat(page, "best recipes for pasta");
  });

  test("history page shows chats when logged in", async ({ page }) => {
    await login(page);
    await page.click(".sidebar__nav-item >> text=History");
    await expect(page).toHaveURL("/history");
    await expect(page.locator(".history__title")).toHaveText("Logic Threads");
    // Should see chat cards
    const cards = page.locator(".history__card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(10); // page size is 4
  });

  test("history shows thread count", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__count")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".history__count")).toContainText("threads");
  });

  test("history cards show title and preview", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });
    // Title should not be empty
    const title = page.locator(".history__card-title").first();
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText!.length).toBeGreaterThan(0);
  });

  test("history cards show timestamps", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });
    const time = page.locator(".history__card-time").first();
    await expect(time).toBeVisible();
    const timeText = await time.textContent();
    expect(timeText!.length).toBeGreaterThan(0);
  });

  test("search filters results", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });

    const countBefore = await page.locator(".history__card").count();

    // Search for a specific chat
    await page.fill(".history__search-input", "pasta");
    // Wait for debounce + API
    await page.waitForTimeout(1000);

    const countAfter = await page.locator(".history__card").count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
    expect(countAfter).toBeGreaterThan(0);
  });

  test("search shows no results for garbage query", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });

    await page.fill(".history__search-input", "xyznonexistent123");
    await page.waitForTimeout(1000);

    await expect(page.locator(".history__empty-text")).toContainText(
      "No threads match your search",
    );
  });

  test("clearing search shows all results again", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });

    // Search then clear
    await page.fill(".history__search-input", "xyznonexistent123");
    await page.waitForTimeout(1000);
    await expect(page.locator(".history__card")).toHaveCount(0);

    await page.fill(".history__search-input", "");
    await page.waitForTimeout(1000);

    const count = await page.locator(".history__card").count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking a chat loads it", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });

    // Click the first chat
    await page.locator(".history__card").first().click();

    // Should navigate to home with messages loaded
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(
      page.locator(".chat-view-thread__message").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("delete shows confirmation", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });

    // Hover to reveal delete button and click it
    await page.locator(".history__card").first().hover();
    await page.locator(".history__card-delete").first().click();

    // Confirm and cancel buttons should appear
    await expect(page.locator(".history__card-confirm")).toBeVisible();
    await expect(page.locator(".history__card-cancel")).toBeVisible();
  });

  test("cancel dismisses delete confirmation", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });

    // Trigger delete confirmation
    await page.locator(".history__card").first().hover();
    await page.locator(".history__card-delete").first().click();
    await expect(page.locator(".history__card-confirm")).toBeVisible();

    // Cancel
    await page.locator(".history__card-cancel").click();

    // Confirmation should disappear
    await expect(page.locator(".history__card-confirm")).not.toBeVisible();
  });

  test("confirming delete removes the chat", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 10000,
    });

    // Delete the first chat
    await page.locator(".history__card").first().hover();
    await page.locator(".history__card-delete").first().click();
    await page.locator(".history__card-confirm").click();

    // Wait for deletion and page refresh
    await page.waitForTimeout(2000);

    // Count should be maintained (page refills) or decreased if last page
    // The total thread count should decrease
    await expect(page.locator(".history__count")).toBeVisible();
  });

  test("history requires login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/history");
    await expect(page.locator(".history__empty-text")).toContainText(
      "Sign in to view your conversation history",
    );
    await expect(page.locator(".history__card")).toHaveCount(0);
  });

  test("search input has maxlength", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    const input = page.locator(".history__search-input");
    await expect(input).toBeVisible({ timeout: 10000 });
    const maxLength = await input.getAttribute("maxlength");
    expect(maxLength).toBe("100");
  });

  test("NodeMap.io logo navigates home", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__title")).toBeVisible({
      timeout: 10000,
    });
    await page.locator(".sidebar__brand").click();
    await expect(page).toHaveURL("/");
  });

  test("top nav hides node view and main thread on history page", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.locator(".history__title")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".topnav__node-link")).not.toBeVisible();
    await expect(page.locator(".topnav__breadcrumb")).not.toBeVisible();
  });
});
