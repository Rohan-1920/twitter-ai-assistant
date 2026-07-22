const {
  launchBrowser,
  closeBrowser,
  hasStorageState,
  DEFAULT_TIMEOUT,
} = require("../utils/browser");
const {
  SESSION_EXPIRED_MESSAGE,
  NO_SESSION_MESSAGE,
} = require("../utils/session");
const { AppError, ERROR_CODES } = require("../utils/errors");
const { config } = require("../utils/config");
const { log } = require("../utils/logger");
const { isLinuxOrRender } = require("../utils/playwright-env");

const TWITTER_HOME = config.twitterHome;
const RENDER_TIMEOUT = 60000;

/**
 * Wait for first matching visible selector.
 */
async function waitForSelector(page, selectors, options = {}) {
  const timeout =
    options.timeout ||
    (isLinuxOrRender() ? RENDER_TIMEOUT : DEFAULT_TIMEOUT);
  const perSelector = Math.max(2500, Math.floor(timeout / selectors.length));

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: perSelector });
      return locator;
    } catch {
      // try next
    }
  }

  throw new AppError(
    options.errorCode || ERROR_CODES.TWITTER_UI_CHANGED,
    options.errorMessage ||
      `Twitter UI changed or element missing. Tried: ${selectors.join(", ")}`,
    options.status || 502
  );
}

function assertSessionValid(page) {
  const url = page.url();
  if (
    url.includes("/login") ||
    url.includes("/i/flow/login") ||
    url.includes("/i/flow/signup")
  ) {
    throw new AppError(
      ERROR_CODES.SESSION_EXPIRED,
      SESSION_EXPIRED_MESSAGE,
      401
    );
  }
}

async function detectRateLimit(page) {
  const rateBanner = page.locator(
    'text=/rate limit|too many requests|you are rate limited/i'
  );

  if (await rateBanner.first().isVisible().catch(() => false)) {
    throw new AppError(
      ERROR_CODES.RATE_LIMITED,
      "Rate limited by Twitter. Wait and retry.",
      429
    );
  }
}

async function navigateTo(page, url) {
  let response;

  try {
    response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: DEFAULT_TIMEOUT,
    });
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("Timeout") || err.name === "TimeoutError" || msg.includes("net::")) {
      throw new AppError(
        ERROR_CODES.NETWORK_TIMEOUT,
        "Network timeout while loading Twitter.",
        504
      );
    }
    throw err;
  }

  if (!response) {
    throw new AppError(
      ERROR_CODES.NETWORK_TIMEOUT,
      "Network timeout: no response from Twitter.",
      504
    );
  }

  if (response.status() === 429) {
    throw new AppError(
      ERROR_CODES.RATE_LIMITED,
      "Rate limited by Twitter (HTTP 429).",
      429
    );
  }

  if (response.status() >= 500) {
    throw new AppError(
      ERROR_CODES.NETWORK_TIMEOUT,
      `Twitter unavailable (HTTP ${response.status()}).`,
      504
    );
  }

  await page.waitForLoadState("domcontentloaded");
  if (isLinuxOrRender()) {
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  assertSessionValid(page);
  await dismissOverlays(page);
  await detectRateLimit(page);
}

/** Dismiss cookie / overlay dialogs that block the composer on headless Render. */
async function dismissOverlays(page) {
  const selectors = [
    'button:has-text("Accept all cookies")',
    'button:has-text("Accept all")',
    'button:has-text("Refuse non-essential")',
    '[data-testid="app-bar-close"]',
    '[aria-label="Close"]',
  ];

  for (const selector of selectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(800);
    }
  }
}

/**
 * Wait until home / composer shell is ready, then focus the composer.
 */
async function openComposer(page) {
  // Confirm authenticated home shell loaded.
  try {
    await waitForSelector(
      page,
      [
        '[data-testid="primaryColumn"]',
        '[data-testid="SideNav_NewTweet_Button"]',
        '[data-testid="AppTabBar_Home_Link"]',
        'a[href="/home"]',
      ],
      {
        errorCode: ERROR_CODES.TWITTER_UI_CHANGED,
        errorMessage:
          "Twitter UI changed: home timeline / navigation did not load.",
      }
    );
  } catch (err) {
    assertSessionValid(page);
    throw err;
  }

  assertSessionValid(page);

  const inlineComposer = page.locator('[data-testid="tweetTextarea_0"]').first();
  if (await inlineComposer.isVisible().catch(() => false)) {
    await inlineComposer.click();
    return;
  }

  const placeholder = page
    .locator(
      '[data-testid="tweetTextarea_0Placeholder"], div[aria-label="Post text"], div[aria-label="Tweet text"]'
    )
    .first();

  if (await placeholder.isVisible().catch(() => false)) {
    await placeholder.click();
    return;
  }

  try {
    const composeButton = await waitForSelector(
      page,
      [
        '[data-testid="SideNav_NewTweet_Button"]',
        'a[aria-label="Post"]',
        'a[href="/compose/post"]',
      ],
      {
        errorCode: ERROR_CODES.TWITTER_UI_CHANGED,
        errorMessage:
          'Twitter UI changed: could not find "Post" / "What\'s happening?" composer.',
      }
    );
    await composeButton.click();
  } catch (err) {
    assertSessionValid(page);
    throw err;
  }
}

async function pasteIntoTextarea(page, content) {
  let textarea;

  try {
    textarea = await waitForSelector(
      page,
      [
        '[data-testid="tweetTextarea_0"]',
        'div[role="textbox"][data-testid="tweetTextarea_0"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[aria-label="Post text"]',
        'div[aria-label="Tweet text"]',
      ],
      {
        errorCode: ERROR_CODES.TWITTER_UI_CHANGED,
        errorMessage: "Twitter UI changed: tweet composer text area not found.",
      }
    );
  } catch (err) {
    assertSessionValid(page);
    throw err;
  }

  await textarea.click();

  const mod = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press("Backspace");

  try {
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, content);
    await page.keyboard.press(`${mod}+V`);
  } catch {
    await page.keyboard.insertText(content);
  }

  const preview = content.slice(0, Math.min(24, content.length));
  const filled = await page
    .locator('[data-testid="tweetTextarea_0"]')
    .first()
    .innerText()
    .catch(() => "");

  if (!filled || (preview && !filled.includes(preview))) {
    await textarea.fill(content);
  }
}

async function clickPostButton(page) {
  let submitButton;

  try {
    submitButton = await waitForSelector(
      page,
      [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        'button[data-testid="tweetButtonInline"]',
        'button[data-testid="tweetButton"]',
        'div[role="button"][data-testid="tweetButtonInline"]',
        'div[role="button"][data-testid="tweetButton"]',
      ],
      {
        errorCode: ERROR_CODES.TWEET_BUTTON_NOT_FOUND,
        errorMessage: "Tweet button not found.",
        status: 502,
      }
    );
  } catch (err) {
    assertSessionValid(page);
    throw err;
  }

  const deadline = Date.now() + (isLinuxOrRender() ? 20000 : 12000);
  while (Date.now() < deadline) {
    const ariaDisabled = await submitButton.getAttribute("aria-disabled");
    const disabled = await submitButton.isDisabled().catch(() => false);
    if (ariaDisabled !== "true" && !disabled) break;
    await page.waitForTimeout(200);
  }

  const ariaDisabled = await submitButton.getAttribute("aria-disabled");
  if (ariaDisabled === "true") {
    throw new AppError(
      ERROR_CODES.TWEET_BUTTON_NOT_FOUND,
      "Tweet button not found or not clickable (still disabled).",
      502
    );
  }

  await submitButton.click();
}

/**
 * Extract tweet rest_id from CreateTweet GraphQL JSON.
 */
function extractTweetIdFromPayload(payload) {
  try {
    const result =
      payload?.data?.create_tweet?.tweet_results?.result ||
      payload?.data?.CreateTweet?.tweet_results?.result;

    if (!result) return null;

    if (result.rest_id) return String(result.rest_id);
    if (result.legacy?.id_str) return String(result.legacy.id_str);
    if (result.tweet?.rest_id) return String(result.tweet.rest_id);

    return null;
  } catch {
    return null;
  }
}

function buildTweetUrl(tweetId) {
  if (!tweetId) return null;
  return `${config.twitterUrl}/i/web/status/${tweetId}`;
}

/**
 * Confirm publish via CreateTweet GraphQL, toast, or composer reset.
 * Returns { tweetId, tweetUrl } when available.
 */
async function waitForPostSuccess(page) {
  let createTweetOk = false;
  let createTweetRateLimited = false;
  let createTweetResponse = null;
  let tweetId = null;

  const responseWaiter = page
    .waitForResponse(
      (res) => {
        const url = res.url();
        if (!url.includes("CreateTweet")) return false;
        if (res.request().method() !== "POST") return false;
        if (res.status() === 429) {
          createTweetRateLimited = true;
          return true;
        }
        if (res.status() < 400) {
          createTweetOk = true;
          createTweetResponse = res;
          return true;
        }
        return false;
      },
      { timeout: 20000 }
    )
    .catch(() => null);

  const toastWaiter = page
    .locator('[data-testid="toast"]')
    .first()
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);

  await Promise.race([responseWaiter, toastWaiter]);

  // If toast won the race, give CreateTweet a moment to finish.
  if (!createTweetResponse && !createTweetRateLimited) {
    await Promise.race([
      responseWaiter,
      page.waitForTimeout(2500),
    ]);
  }

  if (createTweetRateLimited) {
    throw new AppError(
      ERROR_CODES.RATE_LIMITED,
      "Rate limited by Twitter while publishing.",
      429
    );
  }

  if (createTweetResponse) {
    try {
      const json = await createTweetResponse.json();
      tweetId = extractTweetIdFromPayload(json);
    } catch {
      // Response body may not be JSON — continue with soft confirmation.
    }
  }

  // Toast sometimes includes a status link.
  if (!tweetId) {
    const toastLink = page.locator('[data-testid="toast"] a[href*="/status/"]').first();
    if (await toastLink.isVisible().catch(() => false)) {
      const href = await toastLink.getAttribute("href");
      const match = href && href.match(/status\/(\d+)/);
      if (match) tweetId = match[1];
    }
  }

  if (createTweetOk || tweetId) {
    assertSessionValid(page);
    return { tweetId, tweetUrl: buildTweetUrl(tweetId) };
  }

  const toastVisible = await page
    .locator('[data-testid="toast"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (toastVisible) {
    assertSessionValid(page);
    return { tweetId, tweetUrl: buildTweetUrl(tweetId) };
  }

  // Inline composer often clears after a successful post.
  await page.waitForTimeout(2000);
  assertSessionValid(page);
  await detectRateLimit(page);

  const textLeft = await page
    .locator('[data-testid="tweetTextarea_0"]')
    .first()
    .innerText()
    .catch(() => "");

  if (textLeft && textLeft.trim().length > 0) {
    throw new AppError(
      ERROR_CODES.POST_FAILED,
      "Tweet may not have been published. Confirmation was not detected.",
      500
    );
  }

  return { tweetId, tweetUrl: buildTweetUrl(tweetId) };
}

/** CREATE_POST — fully automated publish using saved session. */
async function createPost(page, content) {
  await navigateTo(page, TWITTER_HOME);

  try {
    await openComposer(page);
  } catch (err) {
    log({
      event: "COMPOSER_FALLBACK",
      message: "Home composer failed, trying /compose/post",
      error: err.message,
    });
    await navigateTo(page, `${config.twitterUrl}/compose/post`);
    await dismissOverlays(page);
  }

  await pasteIntoTextarea(page, content);
  await clickPostButton(page);
  return waitForPostSuccess(page);
}

async function replyToComment(page, tweetUrl, content) {
  await navigateTo(page, tweetUrl);

  const replyButton = await waitForSelector(
    page,
    ['[data-testid="reply"]', 'div[role="button"][data-testid="reply"]'],
    {
      errorCode: ERROR_CODES.TWITTER_UI_CHANGED,
      errorMessage: "Twitter UI changed: reply button not found.",
    }
  );

  await replyButton.click();
  await pasteIntoTextarea(page, content);
  await clickPostButton(page);
  return waitForPostSuccess(page);
}

/**
 * Parse reply cards under a tweet permalink page.
 */
async function scrapeRepliesOnPage(page, parentTweetId) {
  const articles = page.locator('article[data-testid="tweet"]');
  const count = await articles.count();
  const replies = [];
  const ownUser = config.twitterUsername;

  for (let i = 0; i < count; i++) {
    const article = articles.nth(i);
    const statusLink = article.locator('a[href*="/status/"]').first();
    const href = await statusLink.getAttribute("href").catch(() => null);
    if (!href) continue;

    const match = href.match(/\/([^/]+)\/status\/(\d+)/);
    if (!match) continue;

    const author = match[1].toLowerCase();
    const replyId = match[2];

    // Skip the parent tweet itself.
    if (parentTweetId && replyId === String(parentTweetId)) continue;
    // Skip our own account replies.
    if (ownUser && author === ownUser) continue;

    const text = await article
      .locator('[data-testid="tweetText"]')
      .innerText()
      .catch(() => "");

    if (!text || !text.trim()) continue;

    replies.push({
      replyId,
      author,
      text: text.trim(),
      replyUrl: href.startsWith("http")
        ? href
        : `${config.twitterUrl}${href}`,
      parentTweetId: parentTweetId || null,
    });
  }

  return replies;
}

/**
 * Open a tweet and collect reply comments (browser must already be open).
 */
async function collectRepliesForTweet(page, tweetUrl, tweetId) {
  await navigateTo(page, tweetUrl);
  await page.waitForTimeout(2000);

  // Scroll a bit to load replies.
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(1500);

  const idFromUrl = tweetId || (tweetUrl.match(/status\/(\d+)/) || [])[1];
  return scrapeRepliesOnPage(page, idFromUrl);
}

/**
 * Scan notifications for reply-type activity.
 */
async function collectNotificationReplies(page) {
  await navigateTo(page, `${config.twitterUrl}/notifications`);
  await page.waitForTimeout(2000);

  const articles = page.locator('article[data-testid="notification"], article[data-testid="tweet"]');
  const count = Math.min(await articles.count(), 30);
  const replies = [];
  const ownUser = config.twitterUsername;

  for (let i = 0; i < count; i++) {
    const article = articles.nth(i);
    const statusLink = article.locator('a[href*="/status/"]').first();
    const href = await statusLink.getAttribute("href").catch(() => null);
    if (!href) continue;

    const match = href.match(/\/([^/]+)\/status\/(\d+)/);
    if (!match) continue;

    const author = match[1].toLowerCase();
    const replyId = match[2];
    if (ownUser && author === ownUser) continue;

    const text = await article
      .locator('[data-testid="tweetText"]')
      .innerText()
      .catch(async () => article.innerText().catch(() => ""));

    if (!text || !text.trim()) continue;

    replies.push({
      replyId,
      author,
      text: text.trim().slice(0, 500),
      replyUrl: href.startsWith("http")
        ? href
        : `${config.twitterUrl}${href}`,
      parentTweetId: null,
    });
  }

  return replies;
}

/**
 * Browser-scoped scan used by the reply monitor (via queue).
 */
async function scanForNewReplies(trackedTweets = []) {
  if (!hasStorageState()) {
    throw new AppError(
      ERROR_CODES.NO_SESSION,
      "No Twitter session found for reply monitoring.",
      401
    );
  }

  let browser;

  try {
    const session = await launchBrowser();
    browser = session.browser;
    const { page } = session;
    const allReplies = [];

    for (const tweet of trackedTweets.slice(0, 10)) {
      if (!tweet.tweetUrl && !tweet.tweetId) continue;
      const url =
        tweet.tweetUrl || buildTweetUrl(tweet.tweetId);

      try {
        const replies = await collectRepliesForTweet(page, url, tweet.tweetId);
        for (const reply of replies) {
          reply.parentTweetId = tweet.tweetId || reply.parentTweetId;
          reply.parentTweetUrl = url;
          reply.parentContent = tweet.content || null;
        }
        allReplies.push(...replies);
      } catch (err) {
        log({
          event: "REPLY_SCAN_ERROR",
          tweetUrl: url,
          error: err.message || String(err),
          code: err.code || null,
        });
      }
    }

    // Also scan notifications for replies we may have missed.
    try {
      const notificationReplies = await collectNotificationReplies(page);
      allReplies.push(...notificationReplies);
    } catch (err) {
      log({
        event: "NOTIFICATION_SCAN_ERROR",
        error: err.message || String(err),
        code: err.code || null,
      });
    }

    // Dedupe by replyId within this scan.
    const seen = new Set();
    const unique = [];
    for (const reply of allReplies) {
      if (seen.has(reply.replyId)) continue;
      seen.add(reply.replyId);
      unique.push(reply);
    }

    return unique;
  } catch (error) {
    throw classifyError(error);
  } finally {
    await closeBrowser(browser);
  }
}

function classifyError(error) {
  if (error instanceof AppError) return error;

  const message = error.message || String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("target closed") ||
    lower.includes("browser has been closed") ||
    lower.includes("browser closed") ||
    lower.includes("crashed")
  ) {
    return new AppError(
      ERROR_CODES.BROWSER_CRASHED,
      "Browser crashed during automation.",
      503
    );
  }

  if (
    lower.includes("browsertype.launch") ||
    lower.includes("executable doesn't exist") ||
    lower.includes("failed to launch")
  ) {
    return new AppError(
      ERROR_CODES.BROWSER_CRASHED,
      "Browser crashed or failed to launch. Ensure Playwright Chromium is installed on Render.",
      503
    );
  }

  if (lower.includes("rate limit") || lower.includes("429")) {
    return new AppError(
      ERROR_CODES.RATE_LIMITED,
      "Rate limited by Twitter.",
      429
    );
  }

  if (
    lower.includes("timeout") ||
    lower.includes("net::") ||
    error.name === "TimeoutError"
  ) {
    return new AppError(
      ERROR_CODES.NETWORK_TIMEOUT,
      "Network timeout while automating Twitter.",
      504
    );
  }

  if (lower.includes("session expired") || lower.includes("/login")) {
    return new AppError(
      ERROR_CODES.SESSION_EXPIRED,
      SESSION_EXPIRED_MESSAGE,
      401
    );
  }

  return new AppError(ERROR_CODES.POST_FAILED, message, 500);
}

/**
 * Run a Playwright task. Reuses storageState — never logs in per request.
 */
async function executeTask(task, payload) {
  if (!hasStorageState()) {
    throw new AppError(
      ERROR_CODES.NO_SESSION,
      NO_SESSION_MESSAGE,
      401
    );
  }

  let browser;

  try {
    let session;
    try {
      session = await launchBrowser();
    } catch (err) {
      throw new AppError(
        ERROR_CODES.BROWSER_CRASHED,
        "Browser crashed or failed to launch: " + (err.message || String(err)),
        503
      );
    }

    browser = session.browser;
    const { page } = session;
    const { content, tweetUrl, mentionUrl } = payload;

    switch (task) {
      case "CREATE_POST": {
        const meta = await createPost(page, content);
        log({
          event: "TWEET_CREATED",
          tweetId: meta.tweetId || null,
          tweetUrl: meta.tweetUrl || null,
        });
        return {
          success: true,
          task: "CREATE_POST",
          message: "Tweet published successfully",
          tweetId: meta.tweetId || null,
          tweetUrl: meta.tweetUrl || null,
        };
      }

      case "REPLY_COMMENT": {
        const meta = await replyToComment(
          page,
          tweetUrl || mentionUrl,
          content
        );
        log({
          event: "REPLY_POSTED",
          tweetId: meta.tweetId || null,
          tweetUrl: meta.tweetUrl || null,
          targetUrl: tweetUrl || mentionUrl || null,
        });
        return {
          success: true,
          task: "REPLY_COMMENT",
          message: "Reply published successfully",
          tweetId: meta.tweetId || null,
          tweetUrl: meta.tweetUrl || null,
        };
      }

      case "SEND_DM":
        throw new AppError(
          ERROR_CODES.NOT_IMPLEMENTED,
          "SEND_DM is not implemented yet.",
          501
        );

      case "DELETE_POST":
        throw new AppError(
          ERROR_CODES.NOT_IMPLEMENTED,
          "DELETE_POST is not implemented yet.",
          501
        );

      default:
        throw new AppError(
          ERROR_CODES.VALIDATION_ERROR,
          `Unsupported Playwright task: ${task}`,
          400
        );
    }
  } catch (error) {
    throw classifyError(error);
  } finally {
    await closeBrowser(browser);
  }
}

module.exports = {
  executeTask,
  createPost,
  replyToComment,
  scanForNewReplies,
  collectRepliesForTweet,
  buildTweetUrl,
};
