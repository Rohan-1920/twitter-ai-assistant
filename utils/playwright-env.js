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
    // Servers have no display — always headless on Render/Linux.
    process.env.HEADLESS = "true";
    console.log(
      `[playwright] Browser path (linux/render): ${PROJECT_BROWSERS_DIR}`
    );
    console.log("[playwright] Headless mode forced (no X server on server)");
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
 * Resolve headless mode. Always true on Render/Linux (no X server / display).
 */
function resolveHeadless(requested = true) {
  if (isLinuxOrRender()) {
    return true;
  }
  if (typeof requested === "boolean") {
    return requested;
  }
  return process.env.HEADLESS !== "false";
}

/**
 * Standard Chromium launch options — never sets executablePath.
 */
function getChromiumLaunchOptions({ headless = true } = {}) {
  const launchOptions = { headless: resolveHeadless(headless) };

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
  resolveHeadless,
  getChromiumLaunchOptions,
};
