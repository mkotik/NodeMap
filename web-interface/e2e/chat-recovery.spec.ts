import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const TEST_USER = {
  firstName: "Recovery",
  lastName: "Tester",
  email: `recovery+${Date.now()}@nodemap.test`,
  password: "TestPass123!",
};

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

test.describe("Chat recovery on navigate-away", () => {
  test("register test user", async ({ page }) => {
    await register(page);
  });

  test("navigating away mid-stream produces one chat with a name and full response", async ({
    page,
  }) => {
    await login(page);

    // Send a message and immediately navigate away before the LLM responds
    await sendMessage(page, "say hello in one word");

    // Wait just long enough for the user message to land in the tree / auto-save
    // to fire, then click New Chat before the LLM finishes.
    await page.waitForTimeout(1500);
    await page.locator(".sidebar__new-chat").click();

    // We should be back on a fresh chat view
    await expect(page.locator(".chat-view__title")).toHaveText(
      "Initiate Thought",
    );

    // The sidebar recents should show the abandoned chat.
    // It may initially show a loader (BeatLoader) while background-completing,
    // but eventually a real title (not "Untitled") should appear.
    const recentTitle = page
      .locator(".sidebar__recents-list .sidebar__recent-title")
      .first();

    await expect(async () => {
      const text = await recentTitle.textContent();
      expect(text).toBeTruthy();
      expect(text).not.toBe("Untitled");
    }).toPass({ timeout: 60000 });

    // Open the recovered chat and verify it has both user message and AI response
    await page
      .locator(".sidebar__recents-list .sidebar__recent")
      .first()
      .click();
    await expect(page).toHaveURL("/", { timeout: 15000 });

    // Should have at least one user bubble and one AI bubble
    await expect(
      page.locator(".chat-view-thread__bubble--user").first(),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(".chat-view-thread__bubble--ai").first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test("untitled chat without a response is auto-recovered on next visit", async ({
    page,
  }) => {
    await login(page);

    // Navigate to history — the chat from the previous test should be there
    // and should NOT be "Untitled" (it was already recovered).
    await page.goto("/history");
    await expect(page.locator(".history__card").first()).toBeVisible({
      timeout: 15000,
    });

    // Every visible card title should have a real name, not "Untitled"
    const titles = page.locator(".history__card-title");
    const count = await titles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      // Wait for any active recovery loaders to resolve into text
      await expect(async () => {
        const text = await titles.nth(i).textContent();
        expect(text).toBeTruthy();
        expect(text).not.toBe("Untitled");
      }).toPass({ timeout: 60000 });
    }
  });
});
