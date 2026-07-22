/**
 * Print storage/storageState.json as base64 for Render STORAGE_STATE_BASE64 env var.
 */
const fs = require("fs");
const path = require("path");

const sessionPath = path.join(__dirname, "..", "storage", "storageState.json");

if (!fs.existsSync(sessionPath)) {
  console.error("No session found. Run: npm run login");
  process.exit(1);
}

const json = fs.readFileSync(sessionPath, "utf8");
const base64 = Buffer.from(json, "utf8").toString("base64");

console.log("Add this to Render as env var STORAGE_STATE_BASE64:\n");
console.log(base64);
