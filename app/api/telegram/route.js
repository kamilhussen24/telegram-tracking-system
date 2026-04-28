import { kv } from "@vercel/kv";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256  (required by Facebook — user_data must be hashed)
// ─────────────────────────────────────────────────────────────────────────────
async function sha256(value) {
  if (!value) return undefined;
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(value).toLowerCase().trim())
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Facebook CAPI payload — all recommended fields included
// https://developers.facebook.com/docs/marketing-api/conversions-api/parameters
// ─────────────────────────────────────────────────────────────────────────────
async function buildFBPayload({ fbclid, timestamp, userId, chatId, username, firstName }) {
  const PIXEL_ID     = process.env.FACEBOOK_PIXEL_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const TEST_CODE    = process.env.FACEBOOK_TEST_EVENT_CODE; // optional

  if (!PIXEL_ID || !ACCESS_TOKEN) return null;

  // fbc — Facebook Click ID cookie format
  // fb.{subdomain_index}.{creation_time_ms}.{fbclid}
  const fbc = fbclid ? `fb.1.${timestamp * 1000}.${fbclid}` : undefined;

  // Hash all PII before sending (Facebook requirement)
  const hashedUserId    = await sha256(userId);
  const hashedUsername  = username  ? await sha256(username)  : undefined;
  const hashedFirstName = firstName ? await sha256(firstName) : undefined;

  // Stable dedup ID — prevents same event firing twice even if webhook retries
  const eventId = `tg_joinreq_${chatId}_${userId}`;

  const eventData = {
    event_name:    "CompleteRegistration",   // Standard FB event — best for conversion campaigns
    event_time:    Math.floor(Date.now() / 1000),
    event_id:      eventId,                  // Deduplication key
    action_source: "website",               // Required field

    user_data: {
      external_id:   hashedUserId,           // Telegram user ID (hashed)
      ...(fbc            && { fbc }),        // Ad click ID — attribution
      ...(hashedUsername && { fn: hashedUsername }),    // first_name proxy
      ...(hashedFirstName && { ln: hashedFirstName }),  // last_name proxy (optional)
      client_user_agent: "TelegramBot/1.0", // Required for website action_source
    },

    custom_data: {
      // Custom fields — visible in Events Manager
      content_name:     "Telegram Channel Join Request",
      content_category: "community",
      status:           "join_requested",
      telegram_chat_id: String(chatId),
      has_fbclid:       fbclid ? "yes" : "no",
    },
  };

  const body = {
    data: [eventData],
    ...(TEST_CODE && { test_event_code: TEST_CODE }),
  };

  return { PIXEL_ID, ACCESS_TOKEN, body, eventId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Send to Facebook CAPI
// ─────────────────────────────────────────────────────────────────────────────
async function sendToFacebook(params) {
  const built = await buildFBPayload(params);
  if (!built) {
    console.warn("[FB] CAPI env vars not set — skipping");
    return { skipped: true };
  }

  const { PIXEL_ID, ACCESS_TOKEN, body, eventId } = built;

  const res  = await fetch(
    `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    }
  );

  const json = await res.json();

  // Detailed log — visible in Vercel Functions logs
  if (json.error) {
    console.error(`[FB] ❌ CAPI ERROR — eventId:${eventId}`, JSON.stringify(json.error));
  } else {
    console.log(
      `[FB] ✅ CAPI SUCCESS — eventId:${eventId}` +
      ` events_received:${json.events_received}` +
      ` fbtrace_id:${json.fbtrace_id}` +
      (json.messages?.length ? ` messages:${json.messages.join(",")}` : "")
    );
  }

  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify Telegram webhook secret header
// ─────────────────────────────────────────────────────────────────────────────
function isValidSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // not configured — skip check
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main webhook entry point
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request) {

  // 1. Security check
  if (!isValidSecret(request)) {
    console.warn("[Webhook] ⛔ Invalid secret token — request rejected");
    return Response.json({ ok: false }, { status: 403 });
  }

  // 2. Parse body
  let update;
  try {
    update = await request.json();
  } catch {
    console.error("[Webhook] Failed to parse JSON body");
    return Response.json({ ok: false }, { status: 400 });
  }

  const updateType = Object.keys(update).find(k => k !== "update_id") ?? "unknown";
  console.log(`[Webhook] Received update_id:${update.update_id} type:${updateType}`);

  // 3. Only handle chat_join_request — ignore all other update types
  const joinReq = update.chat_join_request;
  if (!joinReq) {
    return Response.json({ ok: true }); // Telegram needs 200 OK always
  }

  // 4. Extract key fields
  const userId    = joinReq.from?.id;
  const chatId    = joinReq.chat?.id;
  const username  = joinReq.from?.username  || null;
  const firstName = joinReq.from?.first_name || null;
  const invName   = joinReq.invite_link?.name ?? "";

  console.log(
    `[Webhook] JoinRequest — user:${userId} (${firstName || "?"} @${username || "?"})` +
    ` chat:${chatId} inviteName:"${invName}"`
  );

  if (!userId || !chatId) {
    console.error("[Webhook] Missing userId or chatId — skipping");
    return Response.json({ ok: true });
  }

  // 5. Deduplication — one event per user per chat, ever
  const dedupeKey = `processed:${chatId}:${userId}`;
  try {
    const already = await kv.get(dedupeKey);
    if (already) {
      console.log(`[Webhook] ⏩ Duplicate — user:${userId} already processed — skipping FB event`);
      return Response.json({ ok: true });
    }
  } catch (kvErr) {
    console.error("[Webhook] KV dedup read error:", kvErr);
    // Proceed anyway — better to send duplicate than miss conversion
  }

  // 6. Extract uniqueId from invite link name: "start=<uniqueId>"
  let uniqueId = null;
  if (invName.startsWith("start=")) {
    uniqueId = invName.slice(6).trim();
  }

  // 7. Retrieve original fbclid & timestamp from KV
  let fbclid    = "";
  let timestamp = Math.floor(Date.now() / 1000);

  if (uniqueId) {
    try {
      const raw = await kv.get(`join:${uniqueId}`);
      if (raw) {
        const parsed  = typeof raw === "string" ? JSON.parse(raw) : raw;
        fbclid        = parsed.fbclid    || "";
        timestamp     = parsed.timestamp || timestamp;
        console.log(`[KV] ✅ Found — uniqueId:${uniqueId} fbclid:${fbclid || "(none)"}`);
      } else {
        console.warn(`[KV] ⚠️ No record for uniqueId:${uniqueId} — sending event without fbclid`);
      }
    } catch (kvErr) {
      console.error("[KV] Read/parse error:", kvErr);
    }
  } else {
    console.warn("[Webhook] Invite link has no uniqueId (manual link?) — no fbclid");
  }

  // 8. Send Facebook CAPI event
  try {
    await sendToFacebook({ fbclid, timestamp, userId, chatId, username, firstName });
  } catch (fbErr) {
    console.error("[FB] Unhandled CAPI error:", fbErr);
    // Don't fail — Telegram needs 200 OK
  }

  // 9. Mark as processed — 30 day TTL
  try {
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 30 });
  } catch (kvErr) {
    console.error("[Webhook] KV dedup write error:", kvErr);
  }

  // 10. Always return 200 to Telegram
  return Response.json({ ok: true });
}
