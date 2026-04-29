# KDex Telegram Join Tracker v2.0 — Facebook CAPI

Facebook Ad → Landing Page → Telegram Join Request → `CompleteRegistration` ✅

---

## What's New in v2.0
- ✅ Real browser IP address sent to Facebook (↑ EMQ score)
- ✅ Real User Agent sent to Facebook (↑ EMQ score)
- ✅ `_fbp` cookie captured and sent (↑ attribution accuracy)
- ✅ Full CAPI payload printed in Vercel logs
- ✅ Spinner auto-stops after Telegram redirect
- ✅ Manual Telegram link shown if redirect blocked
- ✅ KDex footer credit
- ✅ Join button at top of card (no scrolling needed)

---

## Deploy Steps

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "kdex-tg v2.0"
git remote add origin https://github.com/YOUR/repo.git
git push -u origin main
```

### 2. Import to Vercel → [vercel.com/new](https://vercel.com/new)

### 3. Connect Vercel KV
Project → Storage → Create → KV (Upstash) → Connect to project

### 4. Set Environment Variables
Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHAT_ID` | `-1003870239597` |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string e.g. `kdex2025secret` |
| `FACEBOOK_PIXEL_ID` | Your Pixel ID |
| `FACEBOOK_ACCESS_TOKEN` | From Events Manager → CAPI |

### 5. Make Bot Admin of Your Channel
Channel → Edit → Administrators → Add Bot
Required permission: ✅ **Add Members / Invite via Link**

### 6. Register Webhook (run once after first deploy)
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR-SITE.vercel.app/api/telegram",
    "secret_token": "kdex2025secret",
    "allowed_updates": ["chat_join_request"]
  }'
```

Verify:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## Testing

### Step 1 — Enable Test Mode
Add env var in Vercel:
```
FACEBOOK_TEST_EVENT_CODE = TEST12345
```
(Get code from Events Manager → Test Events tab)

### Step 2 — Run Test
```
https://your-site.vercel.app?fbclid=TESTCLICK001
→ Click Join → Telegram opens → Request to Join
```

### Step 3 — Check Vercel Logs
Vercel → Functions → Logs

Look for this pattern:
```
━━━━━━━━━━━━━━━━━━━━━━━
[FB] ✅ CAPI SUCCESS:
  event_id        : tg_joinreq_-1003870239597_123456
  events_received : 1
  fbtrace_id      : AbCdEf...
  fbc             : fb.1.1714385700000.TESTCLICK001
  has_fbp         : yes
  has_ip          : yes
  has_ua          : yes
━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 4 — Go Live
Remove `FACEBOOK_TEST_EVENT_CODE` from env vars → Redeploy

---

## Vercel Log Reference

| Log | Meaning |
|---|---|
| `[create-link] ✅ Session saved` | User clicked Join, link created |
| `[Webhook] 📨 JOIN REQUEST RECEIVED` | User tapped Request to Join in Telegram |
| `[KV] ✅ Session retrieved` | fbclid + signals matched successfully |
| `[KV] ⚠️ No session for uniqueId` | Link wasn't created by our system |
| `[FB] 📤 CAPI PAYLOAD SENDING` | Full JSON payload (check for completeness) |
| `[FB] ✅ CAPI SUCCESS events_received:1` | Facebook confirmed receipt ✅ |
| `[FB] ❌ CAPI ERROR` | Check Pixel ID / Access Token |
| `[Webhook] ⏩ DUPLICATE` | Same user joined twice — correctly skipped |
| `[Webhook] ⛔ Invalid secret` | Webhook secret mismatch |

---

## Facebook Event — Full Schema

```json
{
  "event_name": "CompleteRegistration",
  "event_time": 1714385741,
  "event_id": "tg_joinreq_-1003870239597_123456789",
  "action_source": "website",
  "user_data": {
    "external_id":        "<SHA-256 of Telegram user ID>",
    "client_ip_address":  "<SHA-256 of real IP>",
    "fn":                 "<SHA-256 of first_name>",
    "ln":                 "<SHA-256 of username>",
    "fbc":                "fb.1.1714385700000.IwAR123xyz",
    "fbp":                "_fbp cookie value",
    "client_user_agent":  "Mozilla/5.0 ..."
  },
  "custom_data": {
    "content_name":     "Telegram Channel Join Request",
    "content_category": "community",
    "status":           "join_requested",
    "telegram_chat_id": "-1003870239597",
    "has_fbclid":       "yes",
    "has_fbp":          "yes"
  }
}
```

---

## Facebook Campaign Setup (Best Practice)

- **Objective:** Conversions
- **Conversion Event:** CompleteRegistration
- **Performance Goal:** Maximize conversions
- **Budget:** Min ৳500/day — let Facebook collect 50 events before judging
- **Audience:** Broad (let CAPI signals do the work)
