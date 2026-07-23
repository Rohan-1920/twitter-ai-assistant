/**
 * Install Playwright Chromium using the default bundled browser cache.
 *
 * - Docker /ms-playwright → skip (image already has browsers + libs)
 * - Railway (non-Docker) → install with --with-deps when possible
 * - Render/CI → chromium only (no --with-deps)
 * - Local: PLAYWRIGHT_INSTALL_DEPS=true for --with-deps
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("../utils/playwright-env");

const fs = require("fs");
const { spawnSync } = require("child_process");

if (
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1" ||
  fs.existsSync("/ms-playwright")
) {
  console.log(
    "Skipping Playwright browser download (Docker image /ms-playwright)."
  );
  process.exit(0);
}

const onRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID
);

const useSystemDeps =
  !process.env.RENDER &&
  (process.env.PLAYWRIGHT_INSTALL_DEPS === "true" || onRailway);

const args = ["playwright", "install"];

if (useSystemDeps) {
  args.push("--with-deps");
}

args.push("chromium");

const mode = process.env.RENDER
  ? "render"
  : onRailway
    ? "railway+deps"
    : process.env.CI
      ? "ci"
      : useSystemDeps
        ? "local+deps"
        : "local";

console.log(`Installing Playwright Chromium (${mode})...`);

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  args,
  { stdio: "inherit", shell: true }
);

if (result.status !== 0) {
  console.error("Playwright Chromium install failed.");
  process.exit(result.status || 1);
}

console.log("Playwright Chromium installed successfully.");
