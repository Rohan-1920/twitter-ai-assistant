# Twitter AI Assistant

Simple Twitter/X automation backend.

**In one line:** n8n AI se tweet likhta hai → yeh server Twitter pe **khud** post kar deta hai.

Login **sirf ek dafa**. Uske baad har post automatic.

---

# 1. Installation (Pehle Yeh Karo)

Naya PC / sister setup — **upar se neeche** steps follow karo. Koi step skip mat karo.

---

## 1.1 Pehle yeh software install karo

| # | Software | Kyun | Link |
|---|----------|------|------|
| 1 | **Git** | Code download (clone) | https://git-scm.com/downloads |
| 2 | **Node.js 20 LTS** | Project chalane ke liye | https://nodejs.org → **LTS** |
| 3 | Twitter/X account | Posting | https://x.com |
| 4 | OpenAI key (optional) | Auto-reply ke liye | https://platform.openai.com |

Install ke baad **naya terminal** kholo aur check karo:

```powershell
node -v
npm -v
git --version
```

`node -v` → `v20` ya usse bada hona chahiye.

---

## 1.2 Project download (clone)

```powershell
git clone https://github.com/Rohan-1920/twitter-ai-assistant.git
cd twitter-ai-assistant
```

---

## 1.3 Packages + browser install

```powershell
npm install
```

**Yeh command yeh cheezein install karti hai:**

- Node packages: `express`, `cors`, `dotenv`, `playwright`
- Chromium browser (automatic) → folder `.playwright-browsers/`
- Size ~200–400 MB — pehli dafa thoda time lag sakta hai

Agar browser na aaye:

```powershell
npm run setup:browser
```

---

## 1.4 Config file (`.env`)

```powershell
copy .env.example .env
```

`.env` kholo aur yeh set karo:

```env
PORT=3000
HEADLESS=true
TWITTER_URL=https://x.com
TWITTER_USERNAME=your_handle

OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini

CHECK_INTERVAL=90000
REPLY_MONITOR_ENABLED=true
```

- `TWITTER_USERNAME` = apna handle (`@` ke bina)
- `OPENAI_API_KEY` = auto-replies ke liye (sirf posting ke liye optional)
- Twitter password yahan **zaroori nahi**

---

## 1.5 Twitter login (ek dafa)

```powershell
npm run login
```

1. Browser window khulegi  
2. Twitter pe **manually** login karo (CAPTCHA/2FA OK)  
3. Home page aate hi session save ho jati hai  
4. File: `storage/storageState.json`

Expire ho to dubara `npm run login`.

---

## 1.6 Server start

```powershell
npm start
```

Success:

```text
Twitter AI Backend running on port 3000
Session loaded: true
```

Browser mein kholo:

- http://localhost:3000  
- http://localhost:3000/health  

Dono pe `success: true` aana chahiye.

Server chalne do. Band karna ho to `Ctrl + C`.

---

## Installation checklist

- [ ] Git + Node.js 20+ installed  
- [ ] `git clone` + `cd twitter-ai-assistant`  
- [ ] `npm install` done  
- [ ] `.env` banaya  
- [ ] `npm run login` successful  
- [ ] `npm start` → health OK  

**Yahan tak setup complete.** Neeche project samajhne ke liye hai (HR / demo).

---

# 2. Yeh Project Kya Hai? (HR / Simple Explanation)

| Point | Simple words |
|-------|----------------|
| **Problem** | Har tweet manually likhna / post karna time leta hai |
| **Solution** | AI + automation se tweet schedule / post hota hai |
| **n8n** | Workflow tool — kab post ho, AI content kya ho |
| **Yeh backend** | Asli Twitter pe browser automation se post karta hai |
| **Playwright** | Computer pe Chromium browser chalata hai (jaise insan post kare) |
| **Safety** | Login cookies save; password har request pe nahi bhejte |

**Flow (easy):**

```text
n8n (AI content)
    →
Backend API (yeh project)
    →
Playwright browser
    →
Twitter/X pe tweet live
```

---

# 3. Features

| Feature | Matlab |
|---------|--------|
| Auto Tweet Posting | API/n8n se content aaye → Twitter pe post |
| One-time Login | Session save; baar-baar login nahi |
| Reply Monitor | Apne tweets pe naye replies dekhna |
| AI Auto-Reply | OpenAI se jawab → auto post |
| Queue | Ek time pe ek hi browser job |
| No Duplicate Replies | Same reply do dafa jawab nahi |

---

# 4. Tech Stack (Short)

| Tool | Role |
|------|------|
| Node.js + Express | Backend API |
| Playwright | Twitter automation |
| OpenAI | AI replies |
| n8n | Schedule + content workflow |
| Railway / Render | Cloud pe 24/7 (optional) |

---

# 5. n8n Setup (Short)

Backend pehle `npm start` se chal raha ho.

| Setting | Value |
|---------|--------|
| Method | `POST` |
| URL (local) | `http://localhost:3000/api/twitter/action` |
| Timeout | `180000` (3 minutes) |

Body:

```json
{
  "task": "CREATE_POST",
  "content": "Your tweet text here"
}
```

**n8n Cloud** laptop ke `localhost` ko nahi chhoo sakta.  
Tab Railway/Render URL use karo, masalan:

```text
https://twitter-ai-agent-production.up.railway.app/api/twitter/action
```

---

# 6. API (Short)

### Health

- `GET /`  
- `GET /health`

### Post tweet

`POST /api/twitter/action`

```json
{
  "task": "CREATE_POST",
  "content": "AI is transforming businesses."
}
```

### Reply

```json
{
  "task": "REPLY_COMMENT",
  "content": "Thank you!",
  "tweetUrl": "https://x.com/user/status/123"
}
```

### Success response

```json
{
  "success": true,
  "task": "CREATE_POST",
  "message": "Tweet published successfully",
  "tweetId": "1234567890",
  "tweetUrl": "https://x.com/i/web/status/1234567890"
}
```

---

# 7. Useful Commands

| Command | Kaam |
|---------|------|
| `npm install` | Install packages + browser |
| `npm run setup:browser` | Sirf Chromium dubara |
| `npm run login` | Twitter login / session |
| `npm start` | Server start |
| `npm run export-session` | Session export (cloud ke liye) |

---

# 8. Folders (Simple)

```text
twitter-ai-assistant/
├── server.js          → App start
├── .env.example       → Copy karke .env banao
├── routes/            → API URLs
├── services/          → Twitter + Playwright logic
├── scripts/           → login, browser install
├── storage/           → login session (secret)
└── .playwright-browsers/ → Chromium (auto)
```

---

# 9. Cloud (Optional — 24/7)

Laptop band ho to bhi post chahiye:

1. Local: `npm run login` → `npm run export-session`  
2. Railway pe deploy (repo mein `Dockerfile` hai)  
3. Env: `STORAGE_STATE_BASE64`, `HEADLESS=true`, `OPENAI_API_KEY`  
4. n8n mein Railway URL + `/api/twitter/action`

---

# 10. Common Problems

| Error | Fix |
|-------|-----|
| `node` not found | Node install + terminal restart |
| No session | `npm run login` |
| Session expired | Phir `npm run login` |
| Browser missing | `npm run setup:browser` |
| n8n `POST /` not found | URL mein `/api/twitter/action` lagao |
| n8n unreachable | Cloud n8n + localhost = galat; cloud URL use karo |
| Timeout 30s | n8n timeout `180000` |

---

# License

ISC
