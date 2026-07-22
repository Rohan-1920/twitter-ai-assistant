const fs = require("fs");
const path = require("path");
const { config } = require("../utils/config");

const DATA_DIR = path.join(__dirname, "..", "data");
const PROCESSED_REPLIES_PATH = path.join(DATA_DIR, "processed-replies.json");
const TRACKED_TWEETS_PATH = path.join(DATA_DIR, "tracked-tweets.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, fallback);
    return structuredClone(fallback);
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Anti-duplicate store for reply IDs + tracked tweets we created.
 */
const storageService = {
  getProcessedReplies() {
    const data = readJson(PROCESSED_REPLIES_PATH, { replyIds: [] });
    return new Set(data.replyIds || []);
  },

  hasProcessedReply(replyId) {
    if (!replyId) return false;
    return this.getProcessedReplies().has(String(replyId));
  },

  markReplyProcessed(replyId, meta = {}) {
    if (!replyId) return;
    const data = readJson(PROCESSED_REPLIES_PATH, { replyIds: [], details: {} });
    const id = String(replyId);

    if (!data.replyIds.includes(id)) {
      data.replyIds.push(id);
    }

    data.details = data.details || {};
    data.details[id] = {
      ...meta,
      processedAt: new Date().toISOString(),
    };

    // Cap growth
    if (data.replyIds.length > 5000) {
      const removed = data.replyIds.splice(0, data.replyIds.length - 5000);
      for (const oldId of removed) {
        delete data.details[oldId];
      }
    }

    writeJson(PROCESSED_REPLIES_PATH, data);
  },

  getTrackedTweets() {
    const data = readJson(TRACKED_TWEETS_PATH, { tweets: [] });
    return data.tweets || [];
  },

  addTrackedTweet({ tweetId, tweetUrl, content }) {
    if (!tweetId && !tweetUrl) return;

    const data = readJson(TRACKED_TWEETS_PATH, { tweets: [] });
    const tweets = data.tweets || [];
    const id = tweetId ? String(tweetId) : null;

    const exists = tweets.some(
      (t) => (id && t.tweetId === id) || (tweetUrl && t.tweetUrl === tweetUrl)
    );

    if (!exists) {
      tweets.unshift({
        tweetId: id,
        tweetUrl: tweetUrl || (id ? `${config.twitterUrl}/i/web/status/${id}` : null),
        content: content || null,
        createdAt: new Date().toISOString(),
      });
    }

    data.tweets = tweets.slice(0, config.maxTrackedTweets);
    writeJson(TRACKED_TWEETS_PATH, data);
  },
};

module.exports = storageService;
