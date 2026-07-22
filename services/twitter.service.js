const playwrightService = require("./playwright.service");

const SUPPORTED_TASKS = ["CREATE_POST", "REPLY_COMMENT", "REPLY_MENTION"];

/**
 * Validate incoming webhook payload.
 */
function validatePayload(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid JSON: request body must be an object" };
  }

  const { task, content } = body;

  if (!task || typeof task !== "string") {
    return { valid: false, error: "Missing or invalid field: task" };
  }

  if (!SUPPORTED_TASKS.includes(task)) {
    return {
      valid: false,
      error: `Unsupported task: ${task}. Supported tasks: ${SUPPORTED_TASKS.join(", ")}`,
    };
  }

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return { valid: false, error: "Missing or invalid field: content" };
  }

  if (content.length > 280) {
    return { valid: false, error: "Content exceeds Twitter 280 character limit" };
  }

  if (task === "REPLY_COMMENT" && !body.tweetUrl) {
    return { valid: false, error: "tweetUrl is required for REPLY_COMMENT" };
  }

  if (task === "REPLY_MENTION" && !body.mentionUrl && !body.tweetUrl) {
    return {
      valid: false,
      error: "mentionUrl or tweetUrl is required for REPLY_MENTION",
    };
  }

  return { valid: true };
}

/**
 * Route a validated task to the Playwright service.
 */
async function executeAction(payload) {
  const { task, content, tweetUrl, mentionUrl } = payload;

  return playwrightService.executeTask(task, {
    content: content.trim(),
    tweetUrl,
    mentionUrl,
  });
}

module.exports = {
  SUPPORTED_TASKS,
  validatePayload,
  executeAction,
};
