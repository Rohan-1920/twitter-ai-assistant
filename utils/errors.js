/**
 * Shared automation / API error codes for n8n-compatible JSON responses.
 */
const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NO_SESSION: "NO_SESSION",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  TWITTER_UI_CHANGED: "TWITTER_UI_CHANGED",
  TWEET_BUTTON_NOT_FOUND: "TWEET_BUTTON_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  BROWSER_CRASHED: "BROWSER_CRASHED",
  NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  POST_FAILED: "POST_FAILED",
};

class AppError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status=500]
   */
  constructor(code, message, status = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

const HTTP_STATUS_BY_CODE = {
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.NO_SESSION]: 401,
  [ERROR_CODES.SESSION_EXPIRED]: 401,
  [ERROR_CODES.TWITTER_UI_CHANGED]: 502,
  [ERROR_CODES.TWEET_BUTTON_NOT_FOUND]: 502,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.BROWSER_CRASHED]: 503,
  [ERROR_CODES.NETWORK_TIMEOUT]: 504,
  [ERROR_CODES.NOT_IMPLEMENTED]: 501,
  [ERROR_CODES.POST_FAILED]: 500,
};

/**
 * Build a structured JSON error body for Express / n8n.
 */
function toErrorResponse(error, task = null) {
  const code = error.code || ERROR_CODES.POST_FAILED;
  const status = error.status || HTTP_STATUS_BY_CODE[code] || 500;

  const body = {
    success: false,
    error: error.message || "An unexpected error occurred.",
    code,
  };

  if (task) {
    body.task = task;
  }

  return { status, body };
}

module.exports = {
  ERROR_CODES,
  AppError,
  HTTP_STATUS_BY_CODE,
  toErrorResponse,
};
