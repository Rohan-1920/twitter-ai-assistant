require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

// Force Playwright browsers onto D: (never default C: cache)
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "D:\\playwright-browsers";

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const AUTH_DIR = path.join(__dirname, "..", "auth");
const STORAGE_STATE_PATH = path.join(AUTH_DIR, "storageState.json");

const DEFAULT_TIMEOUT = 30000;

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

function hasStorageState() {
  return fs.existsSync(STORAGE_STATE_PATH);
}

function getStorageStatePath() {
  return STORAGE_STATE_PATH;
}

/**
 * Launch Chromium with saved session state when available.
 */
async function launchBrowser() {
  ensureAuthDir();

  const headless = process.env.HEADLESS !== "false";

  const launchOptions = {
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  };

  const browser = await chromium.launch(launchOptions);

  const contextOptions = {
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  if (hasStorageState()) {
    contextOptions.storageState = STORAGE_STATE_PATH;
  }

  const context = await browser.newContext(contextOptions);
  context.setDefaultTimeout(DEFAULT_TIMEOUT);
  context.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);

  const page = await context.newPage();

  return { browser, context, page };
}

/**
 * Safely close browser and all contexts.
 */
async function closeBrowser(browser) {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Browser may already be closed
    }
  }
}

/**
 * Find the first visible locator from a list of selectors.
 */
async function firstVisible(page, selectors, timeout = DEFAULT_TIMEOUT) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }
    await page.waitForTimeout(500);
  }

  throw new Error(`No visible element for: ${selectors.join(" | ")}`);
}

/**
 * Click Next / continue button when present.
 */
async function clickNext(page) {
  const next = page
    .locator(
      'button:has-text("Next"), div[role="button"]:has-text("Next"), [data-testid="ocfEnterTextNextButton"]'
    )
    .first();

  if (await next.isVisible().catch(() => false)) {
    await next.click();
  }
}

/**
 * Perform initial Twitter login and persist session to storageState.json.
 * Run once via: npm run login
 *
 * If auto-login fails (CAPTCHA / unusual activity), keep the browser open
 * so you can finish login manually — session is still saved afterward.
 */
async function loginAndSaveSession() {
  const email = process.env.TWITTER_EMAIL;
  const username = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "TWITTER_EMAIL and TWITTER_PASSWORD are required for login"
    );
  }

  ensureAuthDir();

  const headless = process.env.HEADLESS === "true";
  const browser = await chromium.launch({
    headless,
    channel: undefined,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  try {
    console.log("Opening X login page...");
    await page.goto("https://x.com/i/flow/login", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    try {
      // Email / username step
      const emailInput = await firstVisible(page, [
        'input[autocomplete="username"]',
        'input[name="text"]',
        'input[type="text"]',
      ]);
      await emailInput.click();
      await emailInput.fill(email);
      await clickNext(page);

      // Unusual activity → ask for username/phone
      const unusualInput = page.locator(
        'input[data-testid="ocfEnterTextTextInput"]'
      );
      const unusualVisible = await unusualInput
        .waitFor({ state: "visible", timeout: 8000 })
        .then(() => true)
        .catch(() => false);

      if (unusualVisible) {
        const value = username || email;
        console.log("Username verification step detected...");
        await unusualInput.fill(value);
        await clickNext(page);
      }

      // Password step
      const passwordInput = await firstVisible(page, [
        'input[name="password"]',
        'input[type="password"]',
        'input[autocomplete="current-password"]',
      ]);
      await passwordInput.fill(password);

      const loginBtn = await firstVisible(page, [
        '[data-testid="LoginForm_Login_Button"]',
        'button[data-testid="LoginForm_Login_Button"]',
        'div[role="button"]:has-text("Log in")',
        'button:has-text("Log in")',
      ]);
      await loginBtn.click();
    } catch (autoError) {
      console.warn("Auto-login step failed:", autoError.message);
      console.log(
        "Complete login manually in the browser window (CAPTCHA / 2FA ok)."
      );
    }

    console.log("Waiting for successful login (up to 3 minutes)...");
    await page.waitForSelector(
      '[data-testid="SideNav_NewTweet_Button"], [data-testid="AppTabBar_Home_Link"], a[href="/home"]',
      { timeout: 180000 }
    );

    await context.storageState({ path: STORAGE_STATE_PATH });
    console.log(`Session saved to ${STORAGE_STATE_PATH}`);
  } finally {
    await browser.close();
  }
}

module.exports = {
  launchBrowser,
  closeBrowser,
  loginAndSaveSession,
  hasStorageState,
  getStorageStatePath,
  DEFAULT_TIMEOUT,
};
