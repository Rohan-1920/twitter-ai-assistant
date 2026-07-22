const { config } = require("../utils/config");
const { log } = require("../utils/logger");
const storageService = require("./storage.service");
const queueService = require("./queue.service");
const openaiService = require("./openai.service");
const playwrightService = require("./playwright.service");
const { hasStorageState } = require("../utils/browser");

let timer = null;
let tickInProgress = false;
const inFlightReplies = new Set();

async function handleReply(reply) {
  const replyId = String(reply.replyId);

  if (storageService.hasProcessedReply(replyId)) {
    return;
  }

  if (inFlightReplies.has(replyId)) {
    return;
  }

  inFlightReplies.add(replyId);

  try {
    log({
      event: "REPLY_DETECTED",
      replyId,
      author: reply.author,
      textPreview: String(reply.text).slice(0, 120),
      replyUrl: reply.replyUrl,
    });

    // Reserve immediately to prevent duplicates across overlapping ticks.
    storageService.markReplyProcessed(replyId, {
      status: "processing",
      author: reply.author,
    });

    const aiReply = await openaiService.generateReply(reply.text, {
      parentTweet: reply.parentContent || null,
    });

    const targetUrl = reply.replyUrl;
    if (!targetUrl) {
      log({
        event: "REPLY_SKIPPED",
        replyId,
        reason: "missing replyUrl",
      });
      return;
    }

    const result = await queueService.enqueue("REPLY_COMMENT", () =>
      playwrightService.executeTask("REPLY_COMMENT", {
        content: aiReply,
        tweetUrl: targetUrl,
      })
    );

    storageService.markReplyProcessed(replyId, {
      status: "replied",
      author: reply.author,
      aiReply,
      ourReplyId: result.tweetId || null,
      ourReplyUrl: result.tweetUrl || null,
    });

    log({
      event: "REPLY_POSTED",
      replyId,
      aiReplyPreview: aiReply.slice(0, 120),
      ourReplyId: result.tweetId || null,
    });
  } catch (error) {
    storageService.markReplyProcessed(replyId, {
      status: "error",
      error: error.message || String(error),
      code: error.code || null,
    });

    log({
      event: "AUTO_REPLY_ERROR",
      replyId,
      error: error.message || String(error),
      code: error.code || null,
    });
  } finally {
    inFlightReplies.delete(replyId);
  }
}

async function tick() {
  if (tickInProgress) {
    log({ event: "REPLY_MONITOR_SKIP", reason: "previous tick still running" });
    return;
  }

  tickInProgress = true;

  try {
    const tracked = storageService.getTrackedTweets();

    const replies = await queueService.enqueue("SCAN_REPLIES", () =>
      playwrightService.scanForNewReplies(tracked)
    );

    log({
      event: "REPLY_SCAN_COMPLETE",
      found: replies.length,
      trackedTweets: tracked.length,
    });

    for (const reply of replies) {
      await handleReply(reply);
    }
  } finally {
    tickInProgress = false;
  }
}

/**
 * Background monitor: detect new replies → AI reply → Playwright post.
 * Starts with the Express server; runs on CHECK_INTERVAL.
 */
const replyMonitorService = {
  start() {
    if (!config.replyMonitorEnabled) {
      log({ event: "REPLY_MONITOR_DISABLED" });
      return;
    }

    if (!config.openaiApiKey) {
      log({
        event: "REPLY_MONITOR_DISABLED",
        reason: "OPENAI_API_KEY missing",
      });
      return;
    }

    if (!hasStorageState()) {
      log({
        event: "REPLY_MONITOR_DISABLED",
        reason: "No storageState.json / STORAGE_STATE_JSON",
      });
      return;
    }

    if (timer) return;

    log({
      event: "REPLY_MONITOR_STARTED",
      intervalMs: config.checkIntervalMs,
    });

    // First tick after a short delay so the HTTP server can bind first.
    setTimeout(() => {
      tick().catch((err) => {
        log({
          event: "REPLY_MONITOR_ERROR",
          error: err.message || String(err),
        });
      });
    }, 5000);

    timer = setInterval(() => {
      tick().catch((err) => {
        log({
          event: "REPLY_MONITOR_ERROR",
          error: err.message || String(err),
        });
      });
    }, config.checkIntervalMs);

    if (typeof timer.unref === "function") {
      timer.unref();
    }
  },

  stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      log({ event: "REPLY_MONITOR_STOPPED" });
    }
  },

  tick,
};

module.exports = replyMonitorService;
