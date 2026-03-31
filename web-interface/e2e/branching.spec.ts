import { test, expect, type Page } from "@playwright/test";

// Helper: wait for the chat input to appear and send a message
async function sendMessage(page: Page, text: string) {
  const textarea = page.locator(
    ".chat-view__textarea, .chat-view-thread__input",
  );
  await textarea.first().waitFor({ state: "visible", timeout: 5000 });
  await textarea.first().fill(text);
  await page.keyboard.press("Enter");
}

// Helper: wait for AI response to finish streaming
async function waitForResponse(page: Page) {
  // Wait for status to return to ready — typing indicator gone
  // and at least one AI bubble visible
  await expect(
    page.locator(".chat-view-thread__bubble--ai").first(),
  ).toBeVisible({
    timeout: 60000,
  });
  // Wait for streaming to finish — no more typing indicator
  await expect(page.locator(".chat-view-thread__typing")).not.toBeVisible({
    timeout: 60000,
  });
}

// Helper: send a message and wait for the AI to respond
async function chat(page: Page, text: string) {
  await sendMessage(page, text);
  await waitForResponse(page);
}

test.describe("Chat and Branching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("initial page shows Start a conversation", async ({ page }) => {
    await expect(page.locator(".chat-view__title")).toHaveText(
      "Start a conversation",
    );
  });

  test("user can send a message and receive a response", async ({ page }) => {
    await chat(page, "say hello in one word");

    // User message should be visible
    await expect(
      page.locator(".chat-view-thread__bubble--user").first(),
    ).toBeVisible();

    // AI response should be visible
    await expect(
      page.locator(".chat-view-thread__bubble--ai").first(),
    ).toBeVisible();
  });

  test("top nav shows Main Thread after sending a message", async ({
    page,
  }) => {
    await chat(page, "say hi in one word");

    await expect(page.locator(".topnav__breadcrumb--primary")).toContainText(
      "Main Thread",
    );
  });

  test("node view icon appears after conversation starts", async ({ page }) => {
    // Should not be visible initially
    await expect(page.locator(".topnav__node-link").first()).not.toBeVisible();

    await chat(page, "say hi in one word");

    // Should now be visible
    await expect(page.locator(".topnav__node-link").first()).toBeVisible();
  });

  test("can navigate to node view and see nodes", async ({ page }) => {
    await chat(page, "say hi in one word");

    await page.locator(".topnav__node-link").first().click();
    await expect(page).toHaveURL("/nodes");

    await expect(page.locator(".msg-node").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("branch button is hidden until hover on AI messages", async ({
    page,
  }) => {
    await chat(page, "say hi in one word");

    // Branch action has opacity: 0 initially (CSS hover reveal)
    const branchBtn = page.locator(".chat-view-thread__branch-action").first();
    await expect(branchBtn).toHaveCSS("opacity", "0");

    // Hover over the AI message
    const aiMessage = page.locator(".chat-view-thread__message--ai").first();
    await aiMessage.hover();

    // Branch action should now have opacity: 1
    await expect(branchBtn).toHaveCSS("opacity", "1");
  });

  test("clicking branch button creates a branch and shows breadcrumbs", async ({
    page,
  }) => {
    await chat(page, "say hi in one word");

    // Hover over AI message and click branch
    const aiMessage = page.locator(".chat-view-thread__message--ai").first();
    await aiMessage.hover();
    await page.locator(".chat-view-thread__branch-action").first().click();

    // Should see breadcrumbs with branch name
    await expect(page.locator(".topnav__breadcrumbs")).toBeVisible();
    await expect(page.locator(".topnav__breadcrumb--active")).toContainText(
      "Branch",
    );

    // "Main Thread" breadcrumb should be clickable
    const mainCrumb = page.locator(
      ".topnav__breadcrumb:not(.topnav__breadcrumb--active)",
    );
    await expect(mainCrumb.first()).toHaveText("Main Thread");
  });

  test("branch chat only has context up to the fork point", async ({
    page,
  }) => {
    // Send first exchange
    await chat(page, "say hello in one word");

    // Send second exchange
    await chat(page, "say goodbye in one word");

    // Branch from the first AI response
    const firstAiMessage = page
      .locator(".chat-view-thread__message--ai")
      .first();
    await firstAiMessage.hover();
    await page.locator(".chat-view-thread__branch-action").first().click();

    // Branch should only show messages up to the fork point (2: user + AI)
    const branchMessages = await page
      .locator(".chat-view-thread__message")
      .count();
    expect(branchMessages).toBe(2);
  });

  test("node view shows continue nodes", async ({ page }) => {
    await chat(page, "say hi in one word");

    await page.locator(".topnav__node-link").first().click();
    await expect(page).toHaveURL("/nodes");

    await expect(page.locator(".continue-node").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("New Chat resets everything", async ({ page }) => {
    await chat(page, "say hi in one word");

    // Click New Chat
    await page.locator(".sidebar__new-chat").click();

    // Should be back to initial state
    await expect(page.locator(".chat-view__title")).toHaveText(
      "Start a conversation",
    );

    // Node view link should be hidden
    await expect(page.locator(".topnav__node-link")).not.toBeVisible();
  });
});
