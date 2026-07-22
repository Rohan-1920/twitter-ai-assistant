const { config } = require("../utils/config");
const { AppError, ERROR_CODES } = require("../utils/errors");
const { log } = require("../utils/logger");

/**
 * OpenAI chat completions for natural auto-replies.
 */
async function generateReply(commentText, context = {}) {
  if (!config.openaiApiKey) {
    throw new AppError(
      ERROR_CODES.POST_FAILED,
      "OPENAI_API_KEY is not configured.",
      500
    );
  }

  const systemPrompt =
    process.env.OPENAI_REPLY_SYSTEM_PROMPT ||
    [
      "You are a friendly Twitter/X account assistant.",
      "Write a short, natural reply to a user comment.",
      "Keep it under 240 characters.",
      "Be warm, human, and concise.",
      "Do not use hashtags unless the user used them.",
      "Do not invent facts about products.",
    ].join(" ");

  const userPrompt = [
    context.parentTweet
      ? `Original tweet:\n${context.parentTweet}\n`
      : "",
    `User comment:\n${commentText}\n`,
    "Write the reply text only.",
  ].join("\n");

  let response;
  try {
    response = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.openaiModel,
        temperature: 0.7,
        max_tokens: 120,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    throw new AppError(
      ERROR_CODES.NETWORK_TIMEOUT,
      "Network timeout calling OpenAI: " + (err.message || String(err)),
      504
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new AppError(
        ERROR_CODES.RATE_LIMITED,
        "OpenAI rate limited. Try again later.",
        429
      );
    }
    throw new AppError(
      ERROR_CODES.POST_FAILED,
      `OpenAI error (HTTP ${response.status}): ${errText.slice(0, 200)}`,
      500
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new AppError(
      ERROR_CODES.POST_FAILED,
      "OpenAI returned an empty reply.",
      500
    );
  }

  const cleaned = text.replace(/^["']|["']$/g, "").slice(0, 280);

  log({
    event: "AI_REPLY_GENERATED",
    model: config.openaiModel,
    commentPreview: String(commentText).slice(0, 80),
    replyPreview: cleaned.slice(0, 80),
  });

  return cleaned;
}

module.exports = {
  generateReply,
};
