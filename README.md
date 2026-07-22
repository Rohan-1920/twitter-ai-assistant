# Twitter AI Assistant

Production-ready Node.js backend that connects **n8n**, **OpenAI**, and **Playwright** to fully automate Twitter/X posting and replies.

No manual browser clicking is needed after the one-time login step.

---

## What This Project Does

| Feature | Description |
|---------|-------------|
| **Auto Tweet Posting** | n8n sends AI-generated content → backend posts it on Twitter via Playwright |
| **Session Reuse** | Login once, save cookies → all future posts use saved session |
| **Reply Monitor** | Background service watches for new replies on your tweets |
| **AI Auto-Reply** | OpenAI generates natural replies → Playwright posts them automatically |
| **Queue** | Only one browser automation runs at a time (no conflicts) |
| **Anti-Duplicate** | Same reply is never answered twice |

---

## Tech Stack (Kya Kya Use Hua Hai)

| Technology | Role |
|------------|------|
| **Node.js** | Backend runtime |
| **Express.js** | REST API server |
| **Playwright** | Browser automation (Chromium) for Twitter posting |
| **OpenAI API** | AI reply generation |
| **n8n** | Workflow automation (schedule, AI content, webhooks) |
| **JSON files** | Session storage, tracked tweets, processed reply IDs |
| **Render** | Cloud deployment (optional) |

### NPM Packages

- `express` — HTTP server & routes
- `playwright` — headless/headed Chromium automation
- `cors` — allow n8n / external requests
- `dotenv` — environment variables from `.env`

---

## Architecture

```
n8n Workflow
    │
    ├── OpenAI  →  generates tweet content
    │
    └── HTTP Request  →  POST /api/twitter/action
                              │
                              ▼
                         Express Server
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              Twitter Service      Reply Monitor (background)
                    │                   │
                    ▼                   ├── OpenAI (reply text)
              Queue Service             └── Playwright (post reply)
                    │
                    ▼
            Playwright Service
                    │
                    ▼
              Twitter / X  (x.com)
```

### Request Flow (CREATE_POST)

```
n8n → POST { task, content } → Controller → Twitter Service → Queue → Playwright
                                                                          │
                                                              storage/storageState.json
                                                                          │
                                                              x.com/home → Post Tweet
                                                                          │
                                                              ← { success, tweetId, tweetUrl }
```

---

## Laptop Setup (Apne Computer Pe Kaise Set Karein)

### Requirements

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Git** — clone the repo
- **~500 MB disk** — for Playwright Chromium browser
- **Twitter/X account**

### Step 1 — Clone & Install

```bash
git clone https://github.com/Rohan-1920/twitter-ai-assistant.git
cd twitter-ai-assistant
npm install
```

### Step 2 — Install Chromium Browser

Chromium installs automatically on `npm install` via `postinstall`.

To install manually:

```bash
npm run setup:browser
```

Playwright uses its **bundled Chromium** from the default cache — no custom paths needed.

### Step 3 — Environment File

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
PORT=3000
HEADLESS=true
TWITTER_URL=https://x.com
TWITTER_USERNAME=your_handle

# Required for auto-replies
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini

# Reply monitor (optional)
CHECK_INTERVAL=90000
REPLY_MONITOR_ENABLED=true
```

> **Note:** Twitter email/password are **not required**. Login is done manually in the browser.

### Step 4 — Twitter Login (One Time Only)

```bash
npm run login
```

What happens:

1. Chromium opens in **headed mode** (visible window)
2. `https://x.com/login` opens
3. **You log in manually** (CAPTCHA / 2FA supported)
4. Script waits until `https://x.com/home` loads
5. Session saved to `storage/storageState.json`
6. Console prints: **Twitter session saved successfully.**

You only need to repeat this when the session expires.

### Step 5 — Start the Server

```bash
npm start
```

You should see:

```
Twitter AI Backend running on port 3000
Session loaded: true (source: file)
Reply monitor: enabled
```

Test in browser: `http://localhost:3000`

---

## n8n Workflow Setup

### Overview

n8n handles **scheduling** and **AI content generation**.  
This backend handles **actual Twitter posting** via Playwright.

```
Schedule Trigger  →  OpenAI (generate tweet)  →  HTTP Request (this backend)  →  Done
```

### Step 1 — Make Sure Backend Is Running

```bash
npm start
```

Backend URL: `http://localhost:3000`

If n8n is **cloud-hosted** (n8n.io), your laptop backend is not reachable directly. Use one of:

- **ngrok** — `ngrok http 3000` → use the public URL
- **Render deploy** — deploy backend to Render (see below)

### Step 2 — Create n8n Workflow

#### Node 1: Schedule Trigger

- Run every X hours / daily / custom cron
- Example: every 6 hours

#### Node 2: OpenAI (Generate Tweet)

- **Resource:** Message a Model
- **Model:** `gpt-4o-mini` (or your choice)
- **Prompt example:**

```
Write a short, engaging tweet about AI and business automation.
Max 280 characters. No hashtags unless natural.
```

- Output field: `content` (or map `{{ $json.message.content }}`)

#### Node 3: HTTP Request (Post to Backend)

| Setting | Value |
|---------|-------|
| **Method** | `POST` |
| **URL** | `http://localhost:3000/api/twitter/action` |
| **Authentication** | None |
| **Body Content Type** | JSON |
| **Timeout** | **`180000` ms (3 minutes)** — required for Render + Playwright |
| **Body** | see below |

```json
{
  "platform": "twitter",
  "task": "CREATE_POST",
  "content": "{{ $json.message.content }}"
}
```

> Adjust `content` expression to match your OpenAI node output field.

> **Important:** Default n8n timeout is 30 seconds. Playwright tweet posting on Render often takes **60–120 seconds** (browser launch + Twitter load + post). Set timeout to **180000** or the workflow will fail with `timeout of 30000ms exceeded` even if the tweet eventually posts.

> **Render cold start:** Add an optional HTTP Request node before posting: `GET https://your-app.onrender.com/health` to wake the server first.

#### Node 4 (Optional): IF / Error Handler

Check `{{ $json.success }}` — if `false`, send alert (email, Slack, etc.)

### Step 3 — Test the Workflow

1. Run workflow manually (Execute Workflow button)
2. Check n8n output — should return:

```json
{
  "success": true,
  "task": "CREATE_POST",
  "message": "Tweet published successfully",
  "tweetId": "1234567890",
  "tweetUrl": "https://x.com/i/web/status/1234567890"
}
```

3. Verify tweet appears on your Twitter profile

### n8n Workflow Diagram

```
┌─────────────────┐
│ Schedule Trigger│  every 6 hours
└────────┬────────┘
         │
┌────────▼────────┐
│  OpenAI Node    │  generate tweet text
└────────┬────────┘
         │
┌────────▼────────┐
│  HTTP Request   │  POST /api/twitter/action
└────────┬────────┘
         │
    success: true
    tweet posted on X
```

---

## API Reference

### `GET /`

Health check.

```json
{
  "success": true,
  "message": "Twitter AI Backend Running",
  "sessionLoaded": true,
  "endpoint": "POST /api/twitter/action"
}
```

### `GET /health`

```json
{
  "success": true,
  "sessionLoaded": true,
  "queue": { "running": false, "pending": 0 },
  "replyMonitorEnabled": true
}
```

### `POST /api/twitter/action`

Main endpoint used by n8n.

#### CREATE_POST

```json
{
  "platform": "twitter",
  "task": "CREATE_POST",
  "content": "AI is transforming businesses."
}
```

**Success response:**

```json
{
  "success": true,
  "task": "CREATE_POST",
  "message": "Tweet published successfully",
  "tweetId": "1234567890",
  "tweetUrl": "https://x.com/i/web/status/1234567890"
}
```

#### REPLY_COMMENT

```json
{
  "platform": "twitter",
  "task": "REPLY_COMMENT",
  "content": "Thank you for your comment!",
  "tweetUrl": "https://x.com/user/status/1234567890"
}
```

#### Supported Tasks

| Task | Status |
|------|--------|
| `CREATE_POST` | ✅ Live |
| `REPLY_COMMENT` | ✅ Live |
| `SEND_DM` | 🔜 Planned |
| `DELETE_POST` | 🔜 Planned |

#### Error Responses

| Error | Code | Meaning |
|-------|------|---------|
| `No Twitter session found.` | `NO_SESSION` | Run `npm run login` |
| `Session expired. Please run npm run login` | `SESSION_EXPIRED` | Re-login required |
| `Rate limited by Twitter.` | `RATE_LIMITED` | Wait and retry |
| `Tweet button not found.` | `TWEET_BUTTON_NOT_FOUND` | Twitter UI changed |
| `Browser crashed...` | `BROWSER_CRASHED` | Playwright / Chromium issue |

---

## Render Deployment (Cloud)

Render pe file system persist nahi hota — session **env var** mein deni hogi.

### Step 1 — Login Locally First

```bash
npm run login
```

### Step 2 — Export Session for Render

```bash
npm run export-session
```

Copy the base64 output.

### Step 3 — Render Environment Variables

| Variable | Value |
|----------|-------|
| `STORAGE_STATE_BASE64` | paste base64 from export-session |
| `HEADLESS` | `true` |
| `OPENAI_API_KEY` | your OpenAI key |
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `CHECK_INTERVAL` | `90000` |
| `REPLY_MONITOR_ENABLED` | `true` |
| `NODE_VERSION` | `20` |

**Build command:**
```
npm install
```

Chromium installs automatically via `postinstall`. Do **not** use `--with-deps` on Render (requires root).

**Start command:**
```
npm start
```

### Step 4 — Update n8n URL

Change HTTP Request URL from `localhost` to your Render URL:

```
https://your-app.onrender.com/api/twitter/action
```

### Session Expired on Render?

1. Run `npm run login` locally again
2. Run `npm run export-session`
3. Update `STORAGE_STATE_BASE64` on Render dashboard
4. Manual Deploy

---

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the backend server |
| `npm run login` | Open browser, manual Twitter login, save session |
| `npm run export-session` | Export session as base64 for Render |
| `npm run setup:browser` | Install Playwright Chromium |
| `npm run build` | Install Chromium (for Render build step) |

---

## Project Structure

```
twitter-ai-agent/
├── server.js                    # Express entry point
├── package.json
├── render.yaml                  # Render deploy config
├── .env.example                 # Environment template
│
├── routes/
│   └── twitter.routes.js        # POST /api/twitter/action
│
├── controllers/
│   └── twitter.controller.js    # Request validation & response
│
├── services/
│   ├── twitter.service.js       # Task routing & validation
│   ├── playwright.service.js    # Browser automation (post, reply, scan)
│   ├── queue.service.js         # Serial job queue
│   ├── replyMonitor.service.js  # Background reply watcher
│   ├── openai.service.js        # AI reply generation
│   └── storage.service.js       # Tracked tweets & processed reply IDs
│
├── utils/
│   ├── browser.js               # Chromium launch & login
│   ├── session.js               # Session file / env loader
│   ├── config.js                # Central env config
│   ├── errors.js                # Structured error codes
│   └── logger.js                # File + console logging
│
├── scripts/
│   ├── login.js                 # npm run login
│   ├── export-session.js        # npm run export-session
│   └── setup-browser.js         # npm run setup:browser
│
├── storage/
│   └── storageState.json        # Twitter session (gitignored)
│
├── data/
│   ├── tracked-tweets.json      # Tweets we posted (for reply monitor)
│   └── processed-replies.json   # Reply IDs already answered
│
└── logs/
    └── twitter-YYYY-MM-DD.log   # Daily structured logs
```

---

## Troubleshooting

### `No Twitter session found.`

```bash
npm run login
npm start
```

### `Session expired. Please run npm run login`

Session cookies expired. Re-login:

```bash
npm run login
```

If on Render, also run `npm run export-session` and update `STORAGE_STATE_BASE64`.

### `timeout of 30000ms exceeded` in n8n

This is **n8n's HTTP timeout**, not a backend crash. Playwright on Render needs more time.

**Fix in n8n HTTP Request node:**
- Open **Options** → **Timeout**
- Set to **`180000`** (3 minutes)

Also wake Render before posting (optional):
```
GET https://your-app.onrender.com/health
```
then run the CREATE_POST request.

### n8n cannot reach localhost

- n8n cloud → use **ngrok** or deploy to **Render**
- n8n self-hosted on same machine → `http://localhost:3000` works

### Chromium not found

```bash
npm run setup:browser
```

### Reply monitor not starting

Check `.env`:
- `OPENAI_API_KEY` must be set
- `REPLY_MONITOR_ENABLED=true`
- Session must exist (`npm run login`)

### Tweet posts but no tweetId in response

Twitter sometimes doesn't return ID in GraphQL response. Tweet still posts — check your profile.

---

## License

ISC
