# KDex Community Tracker v5.2
## Facebook CAPI — Final Production Release

---

## Environment Variables (Vercel → Settings → Env Vars)

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHAT_ID` | Channel ID (negative number e.g. -1003870239597) |
| `TELEGRAM_WEBHOOK_SECRET` | Any strong random string |
| `FACEBOOK_PIXEL_ID` | Your Pixel ID |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Same Pixel ID (for browser Pixel) |
| `FACEBOOK_ACCESS_TOKEN` | Events Manager → CAPI → Generate Token |

**Testing only — remove before going live:**
```
FACEBOOK_TEST_EVENT_CODE = TEST12345
```

---

## First Time Setup

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "kdex v5.2"
git remote add origin https://github.com/YOUR/repo.git
git push -u origin main
```

### 2. Import to Vercel
[vercel.com/new](https://vercel.com/new) → Select repo → Deploy

### 3. Connect Vercel KV
Project → Storage → Create → KV (Upstash) → Connect to project

### 4. Add Bot as Channel Admin
Channel → Edit → Administrators → Add your bot
Required permission: ✅ **Add Members / Invite via Link**

### 5. Register Telegram Webhook (run once after deploy)
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR-SITE.vercel.app/api/telegram",
    "secret_token": "YOUR_WEBHOOK_SECRET",
    "allowed_updates": ["chat_join_request"]
  }'
```

Verify:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## Meta CAPI — Hashing Rules (v5.2 Compliant)

| Field | Hashed | Reason |
|---|---|---|
| `external_id` | ✅ SHA-256 | PII — Telegram user ID |
| `fn` (first_name) | ✅ SHA-256 | PII |
| `ln` (username) | ✅ SHA-256 | PII |
| `client_ip_address` | ❌ Plain | Meta normalizes internally |
| `client_user_agent` | ❌ Plain | Meta spec |
| `fbc` | ❌ Plain | Meta spec |
| `fbp` | ❌ Plain | Meta spec |

---

## Expected Payload

```json
{
  "data": [{
    "event_name": "CompleteRegistration",
    "event_time": 1777450060,
    "event_id": "tg_joinreq_-1003870239597_666840337",
    "action_source": "website",
    "user_data": {
      "external_id": "07c43d4a...SHA256",
      "fn":          "604de9db...SHA256",
      "ln":          "31d6ced8...SHA256",
      "client_ip_address": "103.20.110.200",
      "client_user_agent": "Mozilla/5.0 ...",
      "fbc": "fb.1.1777430040459.IwAR123xyz",
      "fbp": "fb.2.1777430040459.234464121986"
    },
    "custom_data": {
      "content_name": "Community Join Request",
      "content_category": "community",
      "status": "join_requested",
      "has_fbclid": "yes",
      "has_fbp": "yes",
      "has_fbc": "yes",
      "has_ip": "yes",
      "has_ua": "yes"
    }
  }]
}
```

---

## Invite Link Limit Solution

Telegram allows max 100 active invite links per chat.

**v5.2 solution:** Each link expires after **1 hour**.
- User clicks Join → gets link → opens it immediately
- 1 hour later → link auto-deletes from Telegram
- Slot freed for next user
- Capacity: **2,400+ unique links per day** — no limit issues

---

## Vercel Logs Reference

```
[create-link] OK | uniqueId:f1d3ca... | fbclid:IwAR123 | fbp:yes | fbc:yes | ip:103.20.110.200 | expires:2026-04-29T09:00:00.000Z

[Webhook] Join request | user:666840337 (@johndoe) | chat:-1003870239597
[KV] Session found | fbclid:IwAR123 | fbp:yes | fbc:yes | ip:103.20.110.200
[CAPI] Payload: { ... full JSON ... }
[CAPI] Success | events_received:1 | fbtrace_id:AbCdEf | event_id:tg_joinreq_...
[CAPI] Signals | fbclid:yes | fbp:yes | fbc:yes | ip:yes | ua:yes | name:yes

[Webhook] Duplicate — user 666840337 already tracked, skipping
```

---

## Reset Test User (KV)

Vercel → Storage → KV → Data Browser → delete key:
```
processed:{CHAT_ID}:{USER_ID}
```

---

## Facebook Campaign Setup

| Setting | Value |
|---|---|
| Objective | Conversions |
| Conversion Event | CompleteRegistration |
| Performance Goal | Maximize conversions |
| Budget | Min ৳500/day |
| Audience | Broad (CAPI signals do the targeting) |
| Learning phase | Wait for 50 events before judging |
