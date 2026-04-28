# Telegram Join Tracker — Facebook CAPI (Production)

Facebook Ad → Landing Page → Telegram Join Request → `CompleteRegistration` ✅

---

## Flow

```
Facebook Ad click (fbclid=IwAR...)
  ↓
Landing page captures fbclid from URL
  ↓
User clicks "Join" → POST /api/create-link
  ↓
Unique invite link created (fbclid saved to KV with uniqueId)
  ↓
User redirected to Telegram → taps "Request to Join"
  ↓
Telegram fires webhook → POST /api/telegram
  ↓
Webhook: KV lookup → fbclid found → Facebook CAPI event sent
  ↓
Facebook Events Manager receives CompleteRegistration ✅
  ↓
Ads optimized for real Telegram joins (not just landing page clicks)
```

---

## Deploy (First Time)

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/YOUR/repo.git
git push -u origin main
```

### 2. Import to Vercel
[vercel.com/new](https://vercel.com/new) → select your repo → Deploy

### 3. Connect Vercel KV
Project → Storage → Create Database → **KV** (Upstash) → Connect

### 4. Set Environment Variables
Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHAT_ID` | Your channel ID (negative number) |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string e.g. `abc123xyz` |
| `FACEBOOK_PIXEL_ID` | Your Pixel ID |
| `FACEBOOK_ACCESS_TOKEN` | From Events Manager → CAPI |
| `FACEBOOK_TEST_EVENT_CODE` | *(optional)* e.g. `TEST12345` — for testing only |

### 5. Make Bot Admin of Your Channel
- Go to your private channel → Add Admin → search your bot
- Required permissions: **✅ Add Members / Invite via Link**

### 6. Register Telegram Webhook (run once after deploy)
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR-SITE.vercel.app/api/telegram",
    "secret_token": "abc123xyz",
    "allowed_updates": ["chat_join_request"]
  }'
```

Verify:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## Testing

### Step 1 — Enable Test Events
Add to Vercel env vars:
```
FACEBOOK_TEST_EVENT_CODE = TEST12345
```
(Get your code from Events Manager → Test Events tab)

### Step 2 — Test Full Flow
```
https://YOUR-SITE.vercel.app?fbclid=TESTCLICK123
→ Click "Join Community"
→ Telegram opens → tap "Request to Join"
```

### Step 3 — Check Vercel Logs
Vercel → Functions → Logs — look for:
```
[FB] ✅ CAPI SUCCESS — eventId:tg_joinreq_... events_received:1
```

### Step 4 — Check Facebook
Events Manager → Test Events → should show `CompleteRegistration`

### Step 5 — Go Live
Remove `FACEBOOK_TEST_EVENT_CODE` from env vars → Redeploy

---

## Vercel Logs Reference

| Log line | Meaning |
|---|---|
| `[create-link] OK — uniqueId:xxx fbclid:yyy` | Link created successfully |
| `[Webhook] JoinRequest — user:123 ...` | User requested to join |
| `[KV] ✅ Found — uniqueId:xxx fbclid:yyy` | fbclid retrieved successfully |
| `[KV] ⚠️ No record for uniqueId` | Link wasn't created via our system |
| `[FB] ✅ CAPI SUCCESS — events_received:1` | Facebook received the event ✅ |
| `[FB] ❌ CAPI ERROR` | Check Pixel ID and Access Token |
| `[Webhook] ⏩ Duplicate — already processed` | Same user joined twice — skipped |
| `[Webhook] ⛔ Invalid secret token` | Webhook secret mismatch |

---

## Facebook Event Details

**Event Name:** `CompleteRegistration`

**User Data sent:**
- `external_id` — Telegram user ID (SHA-256 hashed)
- `fbc` — Facebook click ID cookie (when fbclid present)
- `fn` — Username (hashed, if available)
- `client_user_agent` — `TelegramBot/1.0`

**Custom Data:**
- `content_name` — "Telegram Channel Join Request"
- `content_category` — "community"
- `status` — "join_requested"
- `has_fbclid` — "yes" / "no"

**Deduplication:** `event_id = tg_joinreq_{chatId}_{userId}`

---

## Notes

- **No auto-approve** — admin approves manually in Telegram
- **Event fires on join request** — not on approval
- **Duplicate protection** — each user fires event exactly once (30-day window)
- **No fbclid = still works** — event sent, just no ad attribution
