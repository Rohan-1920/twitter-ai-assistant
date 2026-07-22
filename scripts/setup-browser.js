/**
 * Install Playwright Chromium into D: drive only (never C: default cache).
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const browsersPath =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "D:\\playwright-browsers";

fs.mkdirSync(browsersPath, { recursive: true });

process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

console.log(`Installing Chromium to: ${browsersPath}`);

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
  console.error("Browser install failed. Free at least ~500MB on D: drive and retry.");
  process.exit(result.status || 1);
}

console.log("Chromium installed successfully on D: drive.");
