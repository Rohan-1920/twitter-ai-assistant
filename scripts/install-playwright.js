/**
 * Install Playwright Chromium using the default bundled browser cache.
 *
 * Render/CI: chromium only (no --with-deps — requires root/su which fails on Render).
 * Local Linux with deps: PLAYWRIGHT_INSTALL_DEPS=true npm run setup:browser
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("../utils/playwright-env");

const { spawnSync } = require("child_process");

const useSystemDeps =
  process.env.PLAYWRIGHT_INSTALL_DEPS === "true" &&
  !process.env.RENDER &&
  !process.env.CI;

const args = ["playwright", "install"];

if (useSystemDeps) {
  args.push("--with-deps");
}

args.push("chromium");

const mode = process.env.RENDER
  ? "render"
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
