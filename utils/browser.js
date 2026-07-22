const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// MUST load before playwright — strips invalid PLAYWRIGHT_BROWSERS_PATH on Render.
require("./playwright-env");

const { chromium } = require("playwright");
const {
  getChromiumLaunchOptions,
} = require("./playwright-env");
const {
  ensureStorageDir,
  syncStorageStateFromEnv,
  migrateLegacySession,
  hasStorageState,
  getStorageStatePath,
  getSessionSource,
  STORAGE_STATE_PATH,
} = require("./session");

const DEFAULT_TIMEOUT = Number(process.env.PLAYWRIGHT_TIMEOUT_MS) || 45000;

/**
 * Launch Chromium with saved session. Headless by default (Render-safe).
 * Uses Playwright bundled Chromium — no executablePath.
 */
async function launchBrowser() {
  ensureStorageDir();
  syncStorageStateFromEnv();
  migrateLegacySession();

  const headless = process.env.HEADLESS !== "false";

  const browser = await chromium.launch(
    getChromiumLaunchOptions({ headless })
  );

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
      // Already closed
    }
  }
}

/**
 * Manual login → storage/storageState.json
 * Run once locally: npm run login
 */
async function loginAndSaveSession() {
  ensureStorageDir();

  const browser = await chromium.launch(
    getChromiumLaunchOptions({ headless: false })
  );

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
    console.log("Launching Chromium (headed mode)...");
    console.log("Opening https://x.com/login");
    console.log("Log in manually in the browser (CAPTCHA / 2FA supported).");

    await page.goto("https://x.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("Waiting for https://x.com/home (up to 5 minutes)...");

    await page.waitForURL(
      (url) =>
        (url.hostname === "x.com" || url.hostname === "twitter.com") &&
        url.pathname.startsWith("/home"),
      { timeout: 300000 }
    );

    await page.waitForSelector(
      '[data-testid="SideNav_NewTweet_Button"], [data-testid="AppTabBar_Home_Link"], [data-testid="primaryColumn"]',
      { timeout: 30000 }
    );

    await context.storageState({ path: STORAGE_STATE_PATH });

    console.log("Twitter session saved successfully.");
    console.log(`Saved to: ${STORAGE_STATE_PATH}`);
    console.log("");
    console.log("Render deploy:");
    console.log("  1. Copy storage/storageState.json contents into STORAGE_STATE_JSON");
    console.log("  OR run: node scripts/export-session.js");
    console.log("  2. Paste output into Render env var STORAGE_STATE_BASE64");
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
  getSessionSource,
  syncStorageStateFromEnv,
  DEFAULT_TIMEOUT,
};
