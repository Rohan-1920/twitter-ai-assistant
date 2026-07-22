/**
 * Install Playwright Chromium using the default bundled browser cache.
 * Linux/Render: installs system deps via --with-deps.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("../utils/playwright-env");

const { spawnSync } = require("child_process");
const { isLinuxOrRender } = require("../utils/playwright-env");

const args = ["playwright", "install"];

if (isLinuxOrRender()) {
  args.push("--with-deps");
}

args.push("chromium");

console.log(`Installing Playwright Chromium (${isLinuxOrRender() ? "linux/render" : "local"})...`);

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
