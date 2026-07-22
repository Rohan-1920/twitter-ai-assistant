const {
  launchBrowser,
  closeBrowser,
  hasStorageState,
  DEFAULT_TIMEOUT,
} = require("../utils/browser");

const TWITTER_HOME = "https://x.com/home";

/**
 * Wait for an element using multiple fallback selectors.
 */
async function waitForSelector(page, selectors, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: timeout / selectors.length });
      return locator;
    } catch {
      // Try next selector
    }
  }

  throw new Error(`Element not found. Tried selectors: ${selectors.join(", ")}`);
}

/**
 * Navigate to a URL and verify Twitter is reachable.
 */
async function navigateTo(page, url) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT,
  });

  if (!response) {
    throw new Error("Network timeout: no response from Twitter");
  }

  if (response.status() >= 500) {
    throw new Error(`Twitter unavailable (HTTP ${response.status()})`);
  }

  // Detect login redirect — session expired
  const currentUrl = page.url();
  if (currentUrl.includes("/login") || currentUrl.includes("/i/flow/login")) {
    throw new Error(
      "Twitter session expired. Run `npm run login` to refresh authentication."
    );
  }
}

/**
 * Open the compose tweet dialog from the home page.
 */
async function openComposeDialog(page) {
  const composeButton = await waitForSelector(page, [
    '[data-testid="SideNav_NewTweet_Button"]',
    'a[aria-label="Post"]',
    'a[href="/compose/post"]',
  ]);

  await composeButton.click();
}

/**
 * Type content into the active tweet/reply text area.
 */
async function typeIntoTextarea(page, content) {
  const textarea = await waitForSelector(page, [
    '[data-testid="tweetTextarea_0"]',
    'div[role="textbox"][data-testid="tweetTextarea_0"]',
    'div[contenteditable="true"][role="textbox"]',
  ]);

  await textarea.click();
  await textarea.fill(content);
}

/**
 * Click the Post / Reply submit button.
 */
async function clickSubmitButton(page) {
  const submitButton = await waitForSelector(page, [
    '[data-testid="tweetButton"]',
    '[data-testid="tweetButtonInline"]',
    'div[role="button"]:has-text("Post")',
    'div[role="button"]:has-text("Reply")',
  ]);

  await submitButton.click();
}

/**
 * CREATE_POST — open home, compose, paste content, post.
 */
async function createPost(page, content) {
  await navigateTo(page, TWITTER_HOME);
  await openComposeDialog(page);
  await typeIntoTextarea(page, content);
  await clickSubmitButton(page);

  // Confirm dialog closed or success toast
  await page
    .waitForSelector('[data-testid="toast"]', { timeout: 10000 })
    .catch(() => page.waitForTimeout(2000));
}

/**
 * REPLY_COMMENT — open tweet URL, click reply, paste content, submit.
 */
async function replyToComment(page, tweetUrl, content) {
  await navigateTo(page, tweetUrl);

  const replyButton = await waitForSelector(page, [
    '[data-testid="reply"]',
    'div[role="button"][data-testid="reply"]',
  ]);

  await replyButton.click();
  await typeIntoTextarea(page, content);
  await clickSubmitButton(page);

  await page
    .waitForSelector('[data-testid="toast"]', { timeout: 10000 })
    .catch(() => page.waitForTimeout(2000));
}

/**
 * REPLY_MENTION — open mention tweet URL, reply, return success.
 */
async function replyToMention(page, mentionUrl, content) {
  await replyToComment(page, mentionUrl, content);
}

/**
 * Execute a Playwright browser action for the given task.
 */
async function executeTask(task, { content, tweetUrl, mentionUrl }) {
  if (!hasStorageState()) {
    throw new Error(
      "No saved Twitter session found. Run `npm run login` first."
    );
  }

  let browser;

  try {
    const session = await launchBrowser();
    browser = session.browser;
    const { page } = session;

    switch (task) {
      case "CREATE_POST":
        await createPost(page, content);
        break;

      case "REPLY_COMMENT":
        if (!tweetUrl) {
          throw new Error("tweetUrl is required for REPLY_COMMENT task");
        }
        await replyToComment(page, tweetUrl, content);
        break;

      case "REPLY_MENTION":
        if (!mentionUrl && !tweetUrl) {
          throw new Error(
            "mentionUrl or tweetUrl is required for REPLY_MENTION task"
          );
        }
        await replyToMention(page, mentionUrl || tweetUrl, content);
        break;

      default:
        throw new Error(`Unsupported Playwright task: ${task}`);
    }

    return { success: true };
  } catch (error) {
    if (error.message.includes("browserType.launch")) {
      throw new Error("Browser launch failure: " + error.message);
    }
    throw error;
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = {
  executeTask,
  createPost,
  replyToComment,
  replyToMention,
};
