/**
 * Ensure Chromium exists before starting the server (Render runtime safety net).
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
require("../utils/playwright-env");

const { spawnSync } = require("child_process");
const {
  isLinuxOrRender,
  isChromiumInstalled,
  getProjectBrowsersPath,
} = require("../utils/playwright-env");

if (isChromiumInstalled()) {
  console.log("[playwright] Chromium ready.");
  process.exit(0);
}

if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === "1") {
  console.error(
    "[playwright] Chromium missing but PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1."
  );
  process.exit(1);
}

console.warn("[playwright] Chromium not found — installing now...");

if (isLinuxOrRender()) {
  console.log(`[playwright] Target: ${getProjectBrowsersPath()}`);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", "install", "chromium"],
  { stdio: "inherit", shell: true, env: process.env }
);

if (result.status !== 0) {
  console.error("[playwright] Chromium install failed on startup.");
  process.exit(result.status || 1);
}

if (!isChromiumInstalled()) {
  console.error("[playwright] Chromium still missing after install.");
  process.exit(1);
}

console.log("[playwright] Chromium installed and ready.");
