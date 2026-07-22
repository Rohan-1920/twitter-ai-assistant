const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Strip PLAYWRIGHT_BROWSERS_PATH before any Playwright import on Render.
require("./utils/playwright-env");
const { isChromiumInstalled, getProjectBrowsersPath } = require("./utils/playwright-env");

const twitterRoutes = require("./routes/twitter.routes");
const { syncStorageStateFromEnv, hasStorageState, getSessionSource } = require("./utils/browser");
const { config } = require("./utils/config");
const replyMonitorService = require("./services/replyMonitor.service");
const queueService = require("./services/queue.service");
const { log } = require("./utils/logger");

// Materialize session from Render env before handling traffic.
try {
  syncStorageStateFromEnv();
} catch (err) {
  console.error("STORAGE_STATE_JSON error:", err.message);
}

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Twitter AI Backend Running",
    sessionLoaded: hasStorageState(),
    replyMonitorEnabled: config.replyMonitorEnabled,
    endpoint: "POST /api/twitter/action",
  });
});

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    sessionLoaded: hasStorageState(),
    queue: queueService.getStatus(),
    replyMonitorEnabled: config.replyMonitorEnabled,
  });
});

app.use("/api/twitter", twitterRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      "GET /",
      "GET /health",
      "POST /api/twitter/action",
    ],
  });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON in request body",
      code: "VALIDATION_ERROR",
    });
  }

  console.error("Unhandled error:", err);
  log({
    event: "UNHANDLED_ERROR",
    error: err.message || String(err),
  });
  return res.status(500).json({
    success: false,
    error: "Internal server error",
    code: "POST_FAILED",
  });
});

const PORT = config.port;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Twitter AI Backend running on port ${PORT}`);
  console.log(`Session loaded: ${hasStorageState()} (source: ${getSessionSource()})`);
  console.log(`Chromium ready: ${isChromiumInstalled()}`);
  if (process.env.RENDER) {
    console.log(`Browser path: ${getProjectBrowsersPath()}`);
  }
  console.log(`Reply monitor: ${config.replyMonitorEnabled ? "enabled" : "disabled"}`);
  console.log(`Check interval: ${config.checkIntervalMs}ms`);

  replyMonitorService.start();
});
