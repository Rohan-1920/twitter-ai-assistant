const playwrightService = require("./playwright.service");
const queueService = require("./queue.service");
const storageService = require("./storage.service");
const { AppError, ERROR_CODES } = require("../utils/errors");
const { log } = require("../utils/logger");

/**
 * Task registry — CREATE_POST is live; others stay extensible.
 * REPLY_MENTION is accepted as an alias of REPLY_COMMENT for older n8n flows.
 */
const TASKS = {
  CREATE_POST: {
    implemented: true,
    requiresContent: true,
  },
  REPLY_COMMENT: {
    implemented: true,
    requiresContent: true,
    requiresTweetUrl: true,
  },
  SEND_DM: {
    implemented: false,
    requiresContent: true,
  },
  DELETE_POST: {
    implemented: false,
    requiresContent: false,
    requiresPostUrl: true,
  },
};

const SUPPORTED_TASKS = Object.keys(TASKS);
const IMPLEMENTED_TASKS = SUPPORTED_TASKS.filter((t) => TASKS[t].implemented);

/**
 * Validate n8n / webhook payload. Accepts optional platform field.
 */
function validatePayload(body) {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      error: "Invalid JSON: request body must be an object",
      code: ERROR_CODES.VALIDATION_ERROR,
    };
  }

  let { task, content, platform } = body;

  // Backward-compatible alias from older workflows
  if (task === "REPLY_MENTION") {
    task = "REPLY_COMMENT";
    body.task = "REPLY_COMMENT";
    if (!body.tweetUrl && body.mentionUrl) {
      body.tweetUrl = body.mentionUrl;
    }
  }

  if (platform && typeof platform === "string") {
    const normalized = platform.toLowerCase();
    if (normalized !== "twitter" && normalized !== "x") {
      return {
        valid: false,
        error: `Unsupported platform: ${platform}. Use "twitter".`,
        code: ERROR_CODES.VALIDATION_ERROR,
      };
    }
  }

  if (!task || typeof task !== "string") {
    return {
      valid: false,
      error: "Missing or invalid field: task",
      code: ERROR_CODES.VALIDATION_ERROR,
    };
  }

  if (!SUPPORTED_TASKS.includes(task)) {
    return {
      valid: false,
      error: `Unsupported task: ${task}. Supported: ${SUPPORTED_TASKS.join(", ")}`,
      code: ERROR_CODES.VALIDATION_ERROR,
    };
  }

  const meta = TASKS[task];

  if (!meta.implemented) {
    return {
      valid: false,
      error: `Task ${task} is recognized but not implemented yet.`,
      code: ERROR_CODES.NOT_IMPLEMENTED,
      status: 501,
    };
  }

  if (meta.requiresContent) {
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return {
        valid: false,
        error: "Missing or invalid field: content",
        code: ERROR_CODES.VALIDATION_ERROR,
      };
    }

    if (content.length > 280) {
      return {
        valid: false,
        error: "Content exceeds Twitter 280 character limit",
        code: ERROR_CODES.VALIDATION_ERROR,
      };
    }
  }

  if (meta.requiresTweetUrl) {
    const tweetUrl = body.tweetUrl || body.mentionUrl;
    if (!tweetUrl || typeof tweetUrl !== "string") {
      return {
        valid: false,
        error: "tweetUrl is required for REPLY_COMMENT",
        code: ERROR_CODES.VALIDATION_ERROR,
      };
    }
  }

  if (meta.requiresPostUrl) {
    if (!body.postUrl || typeof body.postUrl !== "string") {
      return {
        valid: false,
        error: "postUrl is required for DELETE_POST",
        code: ERROR_CODES.VALIDATION_ERROR,
      };
    }
  }

  return { valid: true, task };
}

/**
 * Business layer — queues Playwright work. No browser logic here.
 */
async function executeAction(payload) {
  const task = payload.task;

  if (!TASKS[task] || !TASKS[task].implemented) {
    throw new AppError(
      ERROR_CODES.NOT_IMPLEMENTED,
      `Task ${task} is not implemented yet.`,
      501
    );
  }

  const content = payload.content ? payload.content.trim() : "";

  const result = await queueService.enqueue(task, () =>
    playwrightService.executeTask(task, {
      content,
      tweetUrl: payload.tweetUrl || payload.mentionUrl,
      mentionUrl: payload.mentionUrl,
      postUrl: payload.postUrl,
    })
  );

  if (task === "CREATE_POST" && (result.tweetId || result.tweetUrl)) {
    storageService.addTrackedTweet({
      tweetId: result.tweetId,
      tweetUrl: result.tweetUrl,
      content,
    });

    log({
      event: "TWEET_TRACKED",
      tweetId: result.tweetId || null,
      tweetUrl: result.tweetUrl || null,
    });
  }

  return result;
}

async function checkSession() {
  return queueService.enqueue("SESSION_CHECK", () =>
    playwrightService.checkSession()
  );
}

module.exports = {
  TASKS,
  SUPPORTED_TASKS,
  IMPLEMENTED_TASKS,
  validatePayload,
  executeAction,
  checkSession,
};
