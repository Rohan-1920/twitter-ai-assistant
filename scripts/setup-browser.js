/**
 * Install Playwright Chromium for local Windows or Render/Linux.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.platform === "win32") {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "D:\\playwright-browsers";
}

if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
  fs.mkdirSync(process.env.PLAYWRIGHT_BROWSERS_PATH, { recursive: true });
  console.log(`Installing Chromium to: ${process.env.PLAYWRIGHT_BROWSERS_PATH}`);
} else {
  console.log("Installing Chromium to Playwright default cache...");
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", "install", "chromium"],
  {
    stdio: "inherit",
    env: process.env,
    shell: true,
  }
);

if (result.status !== 0) {
  console.error("Browser install failed.");
  process.exit(result.status || 1);
}

console.log("Chromium installed successfully.");
