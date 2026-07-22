const twitterService = require("../services/twitter.service");
const { logRequest } = require("../utils/logger");

/**
 * POST /api/twitter/action
 * Receives task + content from n8n webhook, delegates to Playwright.
 */
async function handleAction(req, res) {
  const startTime = Date.now();
  const { task } = req.body || {};

  try {
    const validation = twitterService.validatePayload(req.body);

    if (!validation.valid) {
      logRequest({
        task: task || "UNKNOWN",
        success: false,
        executionTimeMs: Date.now() - startTime,
        error: validation.error,
      });

      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    await twitterService.executeAction(req.body);

    const executionTimeMs = Date.now() - startTime;

    logRequest({
      task,
      success: true,
      executionTimeMs,
    });

    return res.status(200).json({
      success: true,
      task,
      executionTimeMs,
    });
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error.message || "An unexpected error occurred";

    logRequest({
      task: task || "UNKNOWN",
      success: false,
      executionTimeMs,
      error: errorMessage,
    });

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}

module.exports = { handleAction };
