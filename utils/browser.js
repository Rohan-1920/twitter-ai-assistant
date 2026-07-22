const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Local Windows default only — never force a D: path on Render/Linux.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.platform === "win32") {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "D:\\playwright-browsers";
}

const { chromium } = require("playwright");

const AUTH_DIR = path.join(__dirname, "..", "auth");
const STORAGE_STATE_PATH = path.join(AUTH_DIR, "storageState.json");
const DEFAULT_TIMEOUT = Number(process.env.PLAYWRIGHT_TIMEOUT_MS) || 45000;

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

/**
 * If STORAGE_STATE_JSON is set (Render secret), materialize auth/storageState.json.
 * Prefer file on disk when already present.
 */
function syncStorageStateFromEnv() {
  const raw = process.env.STORAGE_STATE_JSON;
  if (!raw || !raw.trim()) return;

  ensureAuthDir();

  try {
    const parsed = JSON.parse(raw);
    fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(parsed, null, 2), "utf8");
  } catch (err) {
    throw new Error(
      "STORAGE_STATE_JSON is invalid JSON. Paste the full storageState.json contents."
    );
  }
}

function hasStorageState() {
  syncStorageStateFromEnv();
  return fs.existsSync(STORAGE_STATE_PATH);
}

function getStorageStatePath() {
  return STORAGE_STATE_PATH;
}

/**
 * Launch Chromium with saved session. Headless by default (Render-safe).
 * Does not perform login — uses storageState.json only.
 */
async function launchBrowser() {
  ensureAuthDir();
  syncStorageStateFromEnv();

  const headless = process.env.HEADLESS !== "false";

  const launchOptions = {
    headless,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  };

  const browser = await chromium.launch(launchOptions);

  const contextOptions = {
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  };

  if (hasStorageState()) {
    contextOptions.storageState = STORAGE_STATE_PATH;
  }

  const context = await browser.newContext(contextOptions);
  context.setDefaultTimeout(DEFAULT_TIMEOUT);
  context.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);

  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "https://x.com",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  return { browser, context, page };
}

async function closeBrowser(browser) {
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Already closed / crashed
    }
  }
}

async function firstVisible(page, selectors, timeout = DEFAULT_TIMEOUT) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }
    await page.waitForTimeout(400);
  }

  throw new Error(`No visible element for: ${selectors.join(" | ")}`);
}

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
 * One-time local login → auth/storageState.json
 * For Render: upload that file content as STORAGE_STATE_JSON env var.
 */
async function loginAndSaveSession() {
  const email = process.env.TWITTER_EMAIL;
  const username = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;

  if (!email || !password) {
    throw new Error("TWITTER_EMAIL and TWITTER_PASSWORD are required for login");
  }

  ensureAuthDir();

  const headless = process.env.HEADLESS === "true";
  const browser = await chromium.launch({
    headless,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
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
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    try {
      const emailInput = await firstVisible(page, [
        'input[autocomplete="username"]',
        'input[name="text"]',
        'input[type="text"]',
      ]);
      await emailInput.click();
      await emailInput.fill(email);
      await clickNext(page);

      const unusualInput = page.locator(
        'input[data-testid="ocfEnterTextTextInput"]'
      );
      const unusualVisible = await unusualInput
        .waitFor({ state: "visible", timeout: 8000 })
        .then(() => true)
        .catch(() => false);

      if (unusualVisible) {
        console.log("Username verification step detected...");
        await unusualInput.fill(username || email);
        await clickNext(page);
      }

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
    console.log(
      "For Render: copy this file contents into env var STORAGE_STATE_JSON"
    );
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
  syncStorageStateFromEnv,
  DEFAULT_TIMEOUT,
};
