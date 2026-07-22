const fs = require("fs");
const path = require("path");

const LOGS_DIR = path.join(__dirname, "..", "logs");

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getLogFilePath() {
  const date = new Date().toISOString().split("T")[0];
  return path.join(LOGS_DIR, `twitter-${date}.log`);
}

function formatEntry(entry) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

/**
 * Append a structured log entry to the daily log file + console.
 */
function log(entry) {
  ensureLogsDir();
  const line = formatEntry(entry);
  fs.appendFileSync(getLogFilePath(), line + "\n", "utf8");

  const event = entry.event || entry.task || "LOG";
  if (entry.error) {
    console.error(`[${event}]`, entry.error, entry.code || "");
  } else {
    console.log(`[${event}]`, line);
  }
}

/**
 * Log an API request and its execution result.
 */
function logRequest({ task, success, executionTimeMs, error = null }) {
  log({
    event: success ? "API_SUCCESS" : "API_ERROR",
    task,
    success,
    executionTimeMs,
    error,
  });
}

module.exports = { log, logRequest };
