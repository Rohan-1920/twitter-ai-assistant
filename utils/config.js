require("dotenv").config();

/**
 * Central env config for production automation.
 */
const config = {
  port: Number(process.env.PORT) || 3000,
  headless: process.env.HEADLESS !== "false",
  twitterUrl: (process.env.TWITTER_URL || "https://x.com").replace(/\/$/, ""),
  twitterHome: `${(process.env.TWITTER_URL || "https://x.com").replace(/\/$/, "")}/home`,
  twitterUsername: (process.env.TWITTER_USERNAME || "").replace(/^@/, "").toLowerCase(),
  checkIntervalMs: Number(process.env.CHECK_INTERVAL) || 90000,
  replyMonitorEnabled: process.env.REPLY_MONITOR_ENABLED !== "false",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  playwrightTimeoutMs: Number(process.env.PLAYWRIGHT_TIMEOUT_MS) || 45000,
  maxTrackedTweets: Number(process.env.MAX_TRACKED_TWEETS) || 50,
};

module.exports = { config };
