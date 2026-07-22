/**
 * Playwright environment — Render/Linux installs browsers inside the project
 * so they are included in the deployed slug (Render cache is not available at runtime).
 */
const path = require("path");
const fs = require("fs");

const PROJECT_BROWSERS_DIR = path.join(__dirname, "..", ".playwright-browsers");

function isLinuxOrRender() {
  return process.platform === "linux" || Boolean(process.env.RENDER);
}

function getProjectBrowsersPath() {
  return PROJECT_BROWSERS_DIR;
}

/**
 * Configure PLAYWRIGHT_BROWSERS_PATH before require("playwright").
 *
 * Render/Linux → project/.playwright-browsers (bundled with deploy)
 * Windows local  → default Playwright cache (strip bad D:\ paths from .env)
 */
function configurePlaywrightEnv() {
  if (isLinuxOrRender()) {
    fs.mkdirSync(PROJECT_BROWSERS_DIR, { recursive: true });
    process.env.PLAYWRIGHT_BROWSERS_PATH = PROJECT_BROWSERS_DIR;
    console.log(
      `[playwright] Browser path (linux/render): ${PROJECT_BROWSERS_DIR}`
    );
    return;
  }

  const existing = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (existing && (/^[A-Za-z]:[\\/]/.test(existing) || existing.includes("\\"))) {
    console.warn(
      `[playwright] Ignoring invalid PLAYWRIGHT_BROWSERS_PATH: ${existing}`
    );
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  }
}

/**
 * Check whether Chromium binary exists for the current Playwright install.
 */
function isChromiumInstalled() {
  try {
    const { chromium } = require("playwright");
    const execPath = chromium.executablePath();
    return Boolean(execPath && fs.existsSync(execPath));
  } catch {
    return false;
  }
}

/**
 * Standard Chromium launch options — never sets executablePath.
 */
function getChromiumLaunchOptions({ headless = true } = {}) {
  const launchOptions = { headless };

  if (isLinuxOrRender()) {
    launchOptions.args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ];
  }

  return launchOptions;
}

// MUST run before require("playwright") anywhere in the app.
configurePlaywrightEnv();

module.exports = {
  isLinuxOrRender,
  getProjectBrowsersPath,
  configurePlaywrightEnv,
  isChromiumInstalled,
  getChromiumLaunchOptions,
};
