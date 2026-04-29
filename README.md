# KDex Community Tracker — v5.4
### Facebook CAPI + Telegram Join Tracking | Production Ready

---

## Flow

```
Facebook Ad (fbclid)
  → Landing page captures: fbclid, _fbp, _fbc, IP, User Agent
  → User clicks "Join" → unique invite link created (expires 1hr)
  → User taps "Request to Join" in community
  → Telegram webhook fires → session retrieved from KV
  → Facebook CAPI receives CompleteRegistration ✅
  → Ad campaign optimizes on real joins
```

---

## Environment Variables

**Vercel → Project → Settings → Environment Variables:**

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From @BotFather |
| `TELEGRAM_CHAT_ID` | Channel ID (e.g. `-1003870239597`) |
| `TELEGRAM_WEBHOOK_SECRET` | Any strong random string |
| `FACEBOOK_PIXEL_ID` | Your Pixel ID |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Same Pixel ID (browser Pixel) |
| `FACEBOOK_ACCESS_TOKEN` | Events Manager → CAPI → Generate Token |

**Testing only — remove before going live:**
```
FACEBOOK_TEST_EVENT_CODE = TEST12345
```

---

## First Time Setup (Step by Step)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "kdex v5.4"
git remote add origin https://github.com/YOUR/repo.git
git push -u origin main
```

### 2. Deploy on Vercel
[vercel.com/new](https://vercel.com/new) → Import GitHub repo → Deploy

### 3. Connect Vercel KV
Project → Storage → Create Database → **KV (Upstash)** → Connect to project

### 4. Add All Environment Variables
Project → Settings → Environment Variables → add all from table above

### 5. Make Bot Admin of Your Channel
- Channel → Edit → Administrators → Add your bot
- Required permission: ✅ **Invite Users via Link**

### 6. Register Telegram Webhook (run once after deploy)
```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR-SITE.vercel.app/api/telegram",
    "secret_token": "YOUR_WEBHOOK_SECRET",
    "allowed_updates": ["chat_join_request"]
  }'
```

**Verify:**
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### 7. Redeploy after adding env vars
Vercel → Deployments → latest → **Redeploy**

---

## Testing

**Step 1** — Add test code to Vercel env vars:
```
FACEBOOK_TEST_EVENT_CODE = TEST12345
```
(Get code: Events Manager → Test Events tab)

**Step 2** — Visit landing page with test fbclid:
```
https://your-site.vercel.app?fbclid=TESTCLICK001
```

**Step 3** — Click Join → community link opens → tap Request to Join

**Step 4** — Check Vercel → Functions → Logs:
```
[create-link] OK | uniqueId:f1d3ca... | fbclid:TESTCLICK001 | fbp:yes | ip:103.x.x.x
[Webhook] Join request | user:12345 (@username) | chat:-100387...
[KV] Session found | fbclid:TESTCLICK001 | fbp:yes | ip:103.x.x.x
[CAPI] Success | events_received:1 | fbtrace_id:AbCdEf...
[CAPI] Signals | fbclid:yes | fbp:yes | fbc:yes | ip:yes | ua:yes | fn:yes | ln:yes
```

**Step 5** — Check Facebook Events Manager → Test Events → CompleteRegistration ✅

**Step 6 — Go Live:**
Remove `FACEBOOK_TEST_EVENT_CODE` from Vercel env vars → Redeploy

---

## Meta CAPI — Data Sent

```json
{
  "event_name": "CompleteRegistration",
  "event_id":   "tg_joinreq_{chatId}_{userId}",
  "action_source": "website",
  "user_data": {
    "external_id":        "SHA-256(telegram_user_id)",
    "fn":                 "SHA-256(first_name)   — if available",
    "ln":                 "SHA-256(last_name)    — if available",
    "client_ip_address":  "103.20.110.200        — plain, NOT hashed",
    "client_user_agent":  "Mozilla/5.0 ...       — plain, NOT hashed",
    "fbc":                "fb.1.timestamp.fbclid — plain, NOT hashed",
    "fbp":                "_fbp cookie value     — plain, NOT hashed"
  }
}
```

**Hashing rules (Meta official spec):**
| Field | Hashed |
|---|---|
| `external_id` | ✅ SHA-256 |
| `fn`, `ln` | ✅ SHA-256 |
| `client_ip_address` | ❌ Plain |
| `client_user_agent` | ❌ Plain |
| `fbc`, `fbp` | ❌ Plain |

---

## Key Features

| Feature | Detail |
|---|---|
| **Bot-only filter** | Only `start=<id>` invite links fire FB events — external/manual links ignored |
| **Duplicate protection** | One event per user per chat — 30 day window |
| **Invite link limit fix** | Links expire after 1 hour → Telegram 100-link limit never hit |
| **Auto-retry** | Frontend retries once on network error |
| **15s timeout** | Request timeout with user-friendly error message |
| **Facebook Pixel** | `_fbp` and `_fbc` cookies collected from browser |
| **All signals** | fbclid, fbp, fbc, IP, UA, fn, ln all sent when available |
| **Optional fields** | Missing name/username → field skipped, event still fires |

---

## Vercel Logs Reference

| Log | Meaning |
|---|---|
| `[create-link] OK` | User clicked Join, link created successfully |
| `[Webhook] Join request` | User tapped Request to Join |
| `[Webhook] Skipped — not our bot link` | External/manual link — correctly ignored |
| `[Webhook] Duplicate — already tracked` | Same user again — correctly skipped |
| `[KV] Session found` | fbclid + signals matched ✅ |
| `[KV] No session for uniqueId` | KV expired or link not from our system |
| `[CAPI] Success | events_received:1` | Facebook confirmed ✅ |
| `[CAPI] Error 190` | Access Token expired — regenerate in Events Manager |
| `[CAPI] Error 100` | Wrong Pixel ID |

---

## Maintenance

**Every ~60 days:**
Facebook Access Token may expire → Events Manager → Regenerate → Update Vercel env var → Redeploy

**Telegram Bot Token:**
Never expires unless you revoke it via @BotFather

**Vercel KV (Upstash free plan):**
10,000 requests/day limit. For high traffic (500+ joins/day) → upgrade to paid plan

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
| Budget | Min ৳500/day to start |
| Audience | Broad (CAPI signals handle targeting) |
| Learning phase | Wait for 50+ events before scaling |

---

## File Structure

```
kdex-v54/
├── app/
│   ├── layout.js                    ← Facebook Pixel base code
│   ├── page.js                      ← Landing page
│   └── api/
│       ├── create-link/route.js     ← Creates unique invite + saves session to KV
│       └── telegram/route.js        ← Webhook → FB CAPI
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
└── README.md
```
