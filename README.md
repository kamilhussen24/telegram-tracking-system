# KDex Community Tracker v5.0
## Facebook CAPI — Production Ready

---

## Meta CAPI Hashing Rules (v5 Compliant)

| Field | Hashed? | Reason |
|---|---|---|
| `external_id` | ✅ SHA-256 | PII — Telegram user ID |
| `fn` (first_name) | ✅ SHA-256 | PII |
| `ln` (username) | ✅ SHA-256 | PII |
| `client_ip_address` | ❌ Raw/Plain | Meta normalizes it internally |
| `client_user_agent` | ❌ Raw/Plain | Meta spec |
| `fbc` | ❌ Raw/Plain | Meta spec |
| `fbp` | ❌ Raw/Plain | Meta spec |

Ref: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters

---

## Expected Payload (v5)

```json
{
  "data": [{
    "event_name": "CompleteRegistration",
    "event_time": 1777450060,
    "event_id": "tg_joinreq_-1003870239597_666840337",
    "action_source": "website",
    "user_data": {
      "external_id": "07c43d4a...SHA256",
      "fn": "604de9db...SHA256",
      "ln": "31d6ced8...SHA256",
      "client_ip_address": "103.20.110.200",
      "client_user_agent": "Mozilla/5.0 (Linux; Android...",
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

## Environment Variables (Vercel → Settings → Env Vars)

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHAT_ID` | Your channel ID (negative number) |
| `TELEGRAM_WEBHOOK_SECRET` | Any strong random string |
| `FACEBOOK_PIXEL_ID` | Your Pixel ID |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Same Pixel ID (browser Pixel) |
| `FACEBOOK_ACCESS_TOKEN` | From Events Manager → CAPI |

Testing only (remove before going live):
```
FACEBOOK_TEST_EVENT_CODE = TEST12345
```

---

## Webhook Register (run once)

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR-SITE.vercel.app/api/telegram",
    "secret_token": "YOUR_WEBHOOK_SECRET",
    "allowed_updates": ["chat_join_request"]
  }'
```

---

## Vercel Logs (clean format)

```
[Webhook] Join request — user: 666840337 (@johndoe) | chat: -1003870239597
[KV] Session found — fbclid: IwAR123 | fbp: yes | fbc: yes | ip: 103.20.110.200
[CAPI] Sending payload: { ... }
[CAPI] Success — events_received: 1 | fbtrace_id: AbCdEf123
[CAPI] Signals — fbclid: yes | fbp: yes | fbc: yes | ip: yes | ua: yes
```

---

## Reset Test User

Vercel → Storage → KV → Data Browser → delete:
```
processed:{CHAT_ID}:{USER_ID}
```

---

## Facebook Campaign Setup

| Setting | Value |
|---|---|
| Objective | Conversions |
| Conversion Event | CompleteRegistration |
| Performance Goal | Maximize number of conversions |
| Budget | Min ৳500/day |
| Audience | Broad |
| Learning Phase | 50 events minimum |
