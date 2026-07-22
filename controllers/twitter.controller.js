const { logRequest } = require("../utils/logger");

/**
 * POST /api/twitter/action
 * Receives task + content from n8n webhook.
 * Playwright / Twitter posting will be wired in a later step.
 */
async function handleAction(req, res) {
  const startTime = Date.now();
  const body = req.body || {};
  const { task } = body;

  logRequest({
    task: task || "UNKNOWN",
    success: true,
    executionTimeMs: Date.now() - startTime,
  });

  return res.status(200).json({
    success: true,
    message: "Request received successfully",
    received: body,
  });
}

module.exports = { handleAction };
