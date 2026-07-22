const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Local Windows default only — never force a D: path on Render/Linux.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.platform === "win32") {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "D:\\playwright-browsers";
}

const { chromium } = require("playwright");
const { config } = require("./config");

const STORAGE_DIR = path.join(__dirname, "..", "storage");
const STORAGE_STATE_PATH = path.join(STORAGE_DIR, "storageState.json");
const DEFAULT_TIMEOUT = Number(process.env.PLAYWRIGHT_TIMEOUT_MS) || 45000;

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * If STORAGE_STATE_JSON is set (Render secret), materialize storage/storageState.json.
 * Prefer file on disk when already present.
 */
function syncStorageStateFromEnv() {
  const raw = process.env.STORAGE_STATE_JSON;
  if (!raw || !raw.trim()) return;

  ensureStorageDir();

  try {
    const parsed = JSON.parse(raw);
    fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(parsed, null, 2), "utf8");
  } catch (err) {
    throw new Error(
      "STORAGE_STATE_JSON is invalid JSON. Paste the full storageState.json contents."
    );
  }
}

/** Migrate legacy auth/storageState.json → storage/storageState.json */
function migrateLegacySession() {
  const legacyPath = path.join(__dirname, "..", "auth", "storageState.json");
  if (!fs.existsSync(STORAGE_STATE_PATH) && fs.existsSync(legacyPath)) {
    ensureStorageDir();
    fs.copyFileSync(legacyPath, STORAGE_STATE_PATH);
  }
}

function hasStorageState() {
  syncStorageStateFromEnv();
  migrateLegacySession();
  return fs.existsSync(STORAGE_STATE_PATH);
}

function getStorageStatePath() {
  return STORAGE_STATE_PATH;
}

/**
 * Launch Chromium with saved session. Headless by default (Render-safe).
 * Does not perform login — uses storage/storageState.json only.
 */
async function launchBrowser() {
  ensureStorageDir();
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

/**
 * One-time manual login → storage/storageState.json
 * Run via: npm run login
 *
 * For Render: copy file contents into STORAGE_STATE_JSON env var.
 */
async function loginAndSaveSession() {
  ensureStorageDir();

  const browser = await chromium.launch({
    headless: false,
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
    console.log("Opening Twitter login page...");
    console.log("Please log in manually in the browser window (CAPTCHA / 2FA supported).");

    await page.goto(`${config.twitterUrl}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("Waiting for login to complete (up to 5 minutes)...");

    await page.waitForURL(
      (url) => url.hostname.includes("x.com") && url.pathname.includes("/home"),
      { timeout: 300000 }
    );

    await page.waitForSelector(
      '[data-testid="SideNav_NewTweet_Button"], [data-testid="AppTabBar_Home_Link"], [data-testid="primaryColumn"]',
      { timeout: 30000 }
    );

    await context.storageState({ path: STORAGE_STATE_PATH });

    console.log("Twitter session saved successfully.");
    console.log(`Saved to: ${STORAGE_STATE_PATH}`);
    console.log("For Render: copy this file into env var STORAGE_STATE_JSON");
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
