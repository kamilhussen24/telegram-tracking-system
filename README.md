# KDex Community Tracker v3.0 — Facebook CAPI

## What's New in v3.0
- ✅ Facebook Pixel installed on landing page → `_fbp` cookie auto-collected
- ✅ `_fbc` cookie also collected from Pixel (more accurate than manual fbc)
- ✅ No "Telegram" branding on landing page (ad-safe)
- ✅ `InitiateCheckout` browser Pixel event fires on Join button click
- ✅ `ViewContent` browser Pixel event fires on page load
- ✅ Beautiful structured logs in Vercel
- ✅ White KDex footer credit
- ✅ Spinner stops correctly after redirect

---

## Environment Variables (Vercel → Settings → Env Vars)

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHAT_ID` | `-1003870239597` |
| `TELEGRAM_WEBHOOK_SECRET` | `kdex2025secret` |
| `FACEBOOK_PIXEL_ID` | Your Pixel ID |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Same Pixel ID (for browser Pixel) |
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
    "secret_token": "kdex2025secret",
    "allowed_updates": ["chat_join_request"]
  }'
```

---

## Vercel Log Reference

```
┌─────────────────────────────────────────
│ [FB] ✅ CAPI SUCCESS
│ event_id        : tg_joinreq_-100387..._12345
│ events_received : 1
│ fbtrace_id      : AbCdEf123
│ fbc             : fb.1.1714385700000.IwAR...
│ has_fbp         : ✅ yes
│ has_ip          : ✅ yes
│ has_ua          : ✅ yes
│ has_name        : ✅ yes
└─────────────────────────────────────────
```

## Facebook Campaign Setup

- **Objective:** Conversions
- **Event:** CompleteRegistration
- **Goal:** Maximize conversions
- **Budget:** Min ৳500/day
- **Wait for:** 50 events before judging performance
