/**
 * Ensure Chromium OS libraries exist (libglib, etc.).
 * Railway Nixpacks images often miss these unless install-deps runs.
 */
const fs = require("fs");
const { spawnSync } = require("child_process");

const GLIB_CANDIDATES = [
  "/usr/lib/x86_64-linux-gnu/libglib-2.0.so.0",
  "/lib/x86_64-linux-gnu/libglib-2.0.so.0",
  "/usr/lib/aarch64-linux-gnu/libglib-2.0.so.0",
  "/lib/aarch64-linux-gnu/libglib-2.0.so.0",
];

function hasGlib() {
  return GLIB_CANDIDATES.some((p) => fs.existsSync(p));
}

if (hasGlib()) {
  console.log("[playwright] System libraries OK (libglib found).");
  process.exit(0);
}

if (process.platform !== "linux") {
  console.log("[playwright] Skipping install-deps (not Linux).");
  process.exit(0);
}

console.warn(
  "[playwright] libglib-2.0.so.0 missing — running: npx playwright install-deps chromium"
);

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", "install-deps", "chromium"],
  { stdio: "inherit", shell: true, env: process.env }
);

if (result.status !== 0) {
  console.error(
    "[playwright] install-deps failed. Browser launch will crash until OS libs are installed."
  );
  console.error(
    "[playwright] On Railway: use Dockerfile builder (mcr.microsoft.com/playwright) or apt packages."
  );
  // Do not exit hard — let /health stay up; CREATE_POST will still error clearly.
  process.exit(0);
}

if (!hasGlib()) {
  console.error("[playwright] libglib still missing after install-deps.");
  process.exit(0);
}

console.log("[playwright] System libraries installed.");
