const { logRequest } = require("../utils/logger");
const twitterService = require("../services/twitter.service");
const { AppError, ERROR_CODES, toErrorResponse } = require("../utils/errors");

/**
 * POST /api/twitter/action
 * n8n → validate → twitter.service → queue → playwright.service → Twitter
 * Fully automated — no manual posting step.
 */
async function handleAction(req, res) {
  const startTime = Date.now();
  const body = req.body || {};
  const task = body.task || "UNKNOWN";

  const validation = twitterService.validatePayload(body);
  if (!validation.valid) {
    const status = validation.status || 400;

    logRequest({
      task,
      success: false,
      executionTimeMs: Date.now() - startTime,
      error: validation.error,
    });

    return res.status(status).json({
      success: false,
      task,
      error: validation.error,
      code: validation.code || ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const resolvedTask = validation.task || body.task;

  try {
    const result = await twitterService.executeAction(body);

    logRequest({
      task: resolvedTask,
      success: true,
      executionTimeMs: Date.now() - startTime,
    });

    const response = {
      success: true,
      task: result.task || resolvedTask,
      message: result.message || "Tweet published successfully",
    };

    if (result.tweetId !== undefined) {
      response.tweetId = result.tweetId;
    }
    if (result.tweetUrl !== undefined) {
      response.tweetUrl = result.tweetUrl;
    }

    return res.status(200).json(response);
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError(
            ERROR_CODES.POST_FAILED,
            error.message || "Tweet publishing failed.",
            500
          );

    const mapped = toErrorResponse(appError, resolvedTask);

    logRequest({
      task: resolvedTask,
      success: false,
      executionTimeMs: Date.now() - startTime,
      error: mapped.body.error,
    });

    return res.status(mapped.status).json(mapped.body);
  }
}

async function handleSessionCheck(req, res) {
  try {
    const result = await twitterService.checkSession();
    return res.status(200).json(result);
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError(
            ERROR_CODES.POST_FAILED,
            error.message || "Session check failed.",
            500
          );
    const mapped = toErrorResponse(appError, "SESSION_CHECK");
    return res.status(mapped.status).json(mapped.body);
  }
}

module.exports = { handleAction, handleSessionCheck };
