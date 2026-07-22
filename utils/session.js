const path = require("path");
const fs = require("fs");

const STORAGE_DIR = path.join(__dirname, "..", "storage");
const STORAGE_STATE_PATH = path.join(STORAGE_DIR, "storageState.json");
const LEGACY_STORAGE_PATH = path.join(__dirname, "..", "auth", "storageState.json");

const SESSION_EXPIRED_MESSAGE =
  "Session expired. Please run npm run login";
const NO_SESSION_MESSAGE = "No Twitter session found.";

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function isValidSessionData(data) {
  return (
    data &&
    typeof data === "object" &&
    Array.isArray(data.cookies) &&
    data.cookies.length > 0
  );
}

function writeSessionFile(data) {
  ensureStorageDir();
  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Parse session JSON from env — supports raw JSON or base64 (STORAGE_STATE_BASE64).
 */
function parseEnvSession() {
  const base64 = process.env.STORAGE_STATE_BASE64;
  if (base64 && base64.trim()) {
    try {
      const decoded = Buffer.from(base64.trim(), "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch {
      throw new Error(
        "STORAGE_STATE_BASE64 is invalid. Generate with: node scripts/export-session.js"
      );
    }
  }

  const raw = process.env.STORAGE_STATE_JSON;
  if (!raw || !raw.trim()) return null;

  let text = raw.trim();

  // Render sometimes wraps the value in extra quotes.
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      text = JSON.parse(text);
    } catch {
      // keep original text
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "STORAGE_STATE_JSON is invalid JSON. Paste the full storage/storageState.json contents."
    );
  }
}

/**
 * Materialize storage/storageState.json from Render env when set.
 * File on disk takes precedence unless env is newer (always refresh from env when present).
 */
function syncStorageStateFromEnv() {
  const data = parseEnvSession();
  if (!data) return false;

  if (!isValidSessionData(data)) {
    throw new Error(
      "STORAGE_STATE_JSON / STORAGE_STATE_BASE64 must contain a cookies array."
    );
  }

  writeSessionFile(data);
  return true;
}

function migrateLegacySession() {
  if (!fs.existsSync(STORAGE_STATE_PATH) && fs.existsSync(LEGACY_STORAGE_PATH)) {
    ensureStorageDir();
    fs.copyFileSync(LEGACY_STORAGE_PATH, STORAGE_STATE_PATH);
    return true;
  }
  return false;
}

function readSessionFile() {
  if (!fs.existsSync(STORAGE_STATE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function hasStorageState() {
  try {
    syncStorageStateFromEnv();
  } catch {
    // Invalid env — fall through to file check
  }

  migrateLegacySession();

  const data = readSessionFile();
  return isValidSessionData(data);
}

function getStorageStatePath() {
  return STORAGE_STATE_PATH;
}

function getSessionSource() {
  if (process.env.STORAGE_STATE_JSON || process.env.STORAGE_STATE_BASE64) {
    if (hasStorageState()) return "env";
  }
  if (fs.existsSync(STORAGE_STATE_PATH)) return "file";
  if (fs.existsSync(LEGACY_STORAGE_PATH)) return "legacy";
  return "none";
}

function assertSessionExists() {
  if (!hasStorageState()) {
    const err = new Error(NO_SESSION_MESSAGE);
    err.code = "NO_SESSION";
    throw err;
  }
}

module.exports = {
  STORAGE_DIR,
  STORAGE_STATE_PATH,
  SESSION_EXPIRED_MESSAGE,
  NO_SESSION_MESSAGE,
  ensureStorageDir,
  syncStorageStateFromEnv,
  migrateLegacySession,
  hasStorageState,
  getStorageStatePath,
  getSessionSource,
  assertSessionExists,
  isValidSessionData,
  writeSessionFile,
};
