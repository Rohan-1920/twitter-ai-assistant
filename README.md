# Twitter AI Assistant

Production-ready Node.js backend that connects **n8n**, **OpenAI**, and **Playwright** to automate Twitter/X actions.

## Features (v1)

- AI Tweet Generation (via n8n + OpenAI)
- Tweet Publishing (`CREATE_POST`)
- Reply to Tweets (`REPLY_COMMENT`)
- Reply to Mentions (`REPLY_MENTION`)

DM automation is planned for Version 2.

## Architecture

```
User → n8n → OpenAI → Webhook → Node.js Backend → Playwright → Twitter/X
```

## Setup

```bash
npm install
npm run setup:browser
cp .env.example .env
# Edit .env with your Twitter credentials
npm run login
npm start
```

## API

### Health

`GET /` → `Twitter AI Backend Running`

### Action

`POST /api/twitter/action`

```json
{
  "task": "CREATE_POST",
  "content": "AI is transforming businesses."
}
```

## n8n

Point an HTTP Request node to:

`POST http://localhost:3000/api/twitter/action`

If n8n is cloud-hosted, expose the backend with ngrok.
