# Telegram Join Tracker — Facebook CAPI

Facebook Ad click → Landing Page → Telegram Join Request → Facebook CompleteRegistration ✅

## কিভাবে কাজ করে

```
Facebook Ad (fbclid)
  → yoursite.com?fbclid=IwAR...
  → User "Join" বাটনে ক্লিক
  → Unique invite link তৈরি (fbclid KV তে save)
  → User Telegram এ "Request to Join" করে
  → Webhook fire → Facebook CAPI event পাঠানো হয়
  → Admin manually approve করে Telegram এ
```

---

## Deploy Steps

### 1. GitHub এ push করুন
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR/repo.git
git push -u origin main
```

### 2. Vercel এ import করুন
[vercel.com/new](https://vercel.com/new) → GitHub repo select করুন

### 3. Vercel KV চালু করুন
Project → Storage → Create → KV → Connect to project

### 4. Environment Variables সেট করুন
Vercel Project → Settings → Environment Variables:

```
TELEGRAM_BOT_TOKEN       = আপনার bot token (@BotFather থেকে)
TELEGRAM_CHAT_ID         = আপনার channel ID (negative number)
TELEGRAM_WEBHOOK_SECRET  = যেকোনো random string (e.g. mysecret123)
FACEBOOK_PIXEL_ID        = আপনার Pixel ID
FACEBOOK_ACCESS_TOKEN    = Events Manager থেকে CAPI token
NEXT_PUBLIC_SITE_URL     = https://yoursite.vercel.app
```

### 5. Bot কে Channel Admin বানান
- আপনার private channel এ bot কে add করুন
- Admin permissions: **Invite Users** ✅

### 6. Webhook Register করুন (একবারই)
Deploy হওয়ার পর এই command run করুন:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yoursite.vercel.app/api/telegram",
    "secret_token": "mysecret123",
    "allowed_updates": ["chat_join_request"]
  }'
```

Verify করুন:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## Test করুন

1. `https://yoursite.vercel.app?fbclid=TEST_CLICK_123` এ যান
2. "Join Community" ক্লিক করুন
3. Telegram link ওপেন হবে → "Request to Join" করুন
4. Vercel → Functions → Logs এ দেখুন `[FB] CAPI response`
5. Facebook Events Manager → Test Events এ দেখুন

**Test Events এর জন্য:**
`app/api/telegram/route.js` এ এই লাইন uncomment করুন:
```js
test_event_code: "TEST12345",
```
(Events Manager থেকে আপনার code নিন)

---

## Channel ID বের করার উপায়

Option 1: Bot দিয়ে
```
https://api.telegram.org/bot<TOKEN>/getUpdates
```
Channel এ একটা message পাঠান, তারপর এই URL hit করুন।

Option 2: @userinfobot কে channel এ add করুন — ID দিয়ে দেবে।

---

## Important Notes

- **Auto-approve নেই** — Admin manually Telegram থেকে approve করবেন
- **Event কখন যায়** — Join request করার সাথে সাথে (approve এর আগে)
- **Duplicate protection** — একই user দুইবার event fire করবে না
- **fbclid ছাড়াও কাজ করে** — শুধু attribution হবে না

---

## File Structure

```
app/
  page.js                     ← Landing page (fbclid capture করে)
  layout.js
  globals.css
  api/
    create-link/route.js      ← Unique invite link তৈরি + KV save
    telegram/route.js         ← Webhook handler + FB CAPI
.env.example
package.json
next.config.js
```
