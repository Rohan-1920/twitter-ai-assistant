/**
 * Playwright environment helpers — Render/Linux safe, no hardcoded paths.
 */

function isLinuxOrRender() {
  return process.platform === "linux" || Boolean(process.env.RENDER);
}

/**
 * Always use Playwright bundled Chromium from the default cache.
 * Strips PLAYWRIGHT_BROWSERS_PATH if set (e.g. old D:\playwright-browsers on Render).
 */
function sanitizePlaywrightEnv() {
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!browsersPath) return;

  console.warn(
    `[playwright] Ignoring PLAYWRIGHT_BROWSERS_PATH — using bundled Chromium: ${browsersPath}`
  );
  delete process.env.PLAYWRIGHT_BROWSERS_PATH;
}

/**
 * Standard Chromium launch options — never sets executablePath.
 * @param {{ headless?: boolean }} options
 */
function getChromiumLaunchOptions({ headless = true } = {}) {
  const launchOptions = { headless };

  // Required on Render/Linux containers
  if (isLinuxOrRender()) {
    launchOptions.args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ];
  }

  return launchOptions;
}

module.exports = {
  isLinuxOrRender,
  sanitizePlaywrightEnv,
  getChromiumLaunchOptions,
};
