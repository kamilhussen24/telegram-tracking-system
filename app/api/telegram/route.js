import { kv } from "@vercel/kv";

export const runtime = "nodejs";

/* ══════════════════════════════════════════════════════════════════
   SHA-256 — Facebook requires all PII hashed before sending
   ══════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════
   Build full Facebook CAPI payload
   All fields that improve Event Match Quality (EMQ)
   ══════════════════════════════════════════════════════════════════ */
async function buildPayload({
  fbclid, fbp, fbc,
  userAgent, clientIp, pageUrl,
  timestamp, userId, chatId,
  username, firstName,
}) {
  // fbc priority: pixel cookie > our constructed value > fbclid fallback
  const finalFbc = fbc || (fbclid ? `fb.1.${timestamp * 1000}.${fbclid}` : undefined);

  // Hash all PII in parallel
  const [
    h_userId,
    h_ip,
    h_firstName,
    h_username,
  ] = await Promise.all([
    sha256(userId),
    sha256(clientIp),
    sha256(firstName),
    sha256(username),
  ]);

  const eventId   = `tg_joinreq_${chatId}_${userId}`;
  const eventTime = Math.floor(Date.now() / 1000);

  // user_data — every available signal for maximum EMQ
  const user_data = {
    // Hashed identifiers
    external_id: h_userId,
    ...(h_ip        && { client_ip_address: h_ip }),
    ...(h_firstName && { fn: h_firstName }),
    ...(h_username  && { ln: h_username }),

    // Facebook signals — NOT hashed (Facebook spec)
    ...(finalFbc  && { fbc: finalFbc }),
    ...(fbp       && { fbp }),
    ...(userAgent && { client_user_agent: userAgent }),
  };

  const event = {
    event_name:    "CompleteRegistration",
    event_time:    eventTime,
    event_id:      eventId,
    action_source: "website",

    user_data,

    custom_data: {
      content_name:     "Community Join Request",
      content_category: "community",
      status:           "join_requested",
      has_fbclid:       fbclid    ? "yes" : "no",
      has_fbp:          fbp       ? "yes" : "no",
      has_fbc:          finalFbc  ? "yes" : "no",
      has_ip:           clientIp  ? "yes" : "no",
      has_ua:           userAgent ? "yes" : "no",
    },
  };

  return { eventId, eventTime, event, finalFbc };
}

/* ══════════════════════════════════════════════════════════════════
   Send to Facebook CAPI with full logging
   ══════════════════════════════════════════════════════════════════ */
async function sendToFacebook(params) {
  const PIXEL_ID     = process.env.FACEBOOK_PIXEL_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const TEST_CODE    = process.env.FACEBOOK_TEST_EVENT_CODE;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("[FB] ⚠️  CAPI env vars not set — event skipped");
    return;
  }

  const { eventId, eventTime, event, finalFbc } = await buildPayload(params);

  const body = {
    data: [event],
    ...(TEST_CODE && { test_event_code: TEST_CODE }),
  };

  // Log full payload for debugging
  console.log("┌─────────────────────────────────────────────────────");
  console.log("│ [FB] 📤 CAPI PAYLOAD");
  console.log("│ " + JSON.stringify(body, null, 2).split("\n").join("\n│ "));
  console.log("└─────────────────────────────────────────────────────");

  const res  = await fetch(
    `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    }
  );

  const json = await res.json();

  if (json.error) {
    console.error("┌─────────────────────────────────────────────────────");
    console.error("│ [FB] ❌ CAPI ERROR");
    console.error("│ code    : " + json.error.code);
    console.error("│ message : " + json.error.message);
    console.error("│ type    : " + json.error.type);
    console.error("└─────────────────────────────────────────────────────");
  } else {
    console.log("┌─────────────────────────────────────────────────────");
    console.log("│ [FB] ✅ CAPI SUCCESS");
    console.log("│ event_id        : " + eventId);
    console.log("│ event_time      : " + new Date(eventTime * 1000).toISOString());
    console.log("│ events_received : " + json.events_received);
    console.log("│ fbtrace_id      : " + json.fbtrace_id);
    console.log("│ fbc             : " + (finalFbc || "(none)"));
    console.log("│ has_fbp         : " + (params.fbp       ? "✅ yes" : "❌ no"));
    console.log("│ has_ip          : " + (params.clientIp  ? "✅ yes" : "❌ no"));
    console.log("│ has_ua          : " + (params.userAgent ? "✅ yes" : "❌ no"));
    console.log("│ has_name        : " + (params.firstName ? "✅ yes" : "❌ no"));
    if (json.messages?.length) {
      console.log("│ messages        : " + json.messages.join(" | "));
    }
    console.log("└─────────────────────────────────────────────────────");
  }

  return json;
}

/* ══════════════════════════════════════════════════════════════════
   Verify Telegram secret header
   ══════════════════════════════════════════════════════════════════ */
function isValidSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

/* ══════════════════════════════════════════════════════════════════
   MAIN WEBHOOK HANDLER
   ══════════════════════════════════════════════════════════════════ */
export async function POST(request) {

  // 1. Security
  if (!isValidSecret(request)) {
    console.warn("[Webhook] ⛔ Invalid secret — rejected");
    return Response.json({ ok: false }, { status: 403 });
  }

  // 2. Parse
  let update;
  try { update = await request.json(); }
  catch { return Response.json({ ok: false }, { status: 400 }); }

  // 3. Only handle chat_join_request
  const joinReq = update.chat_join_request;
  if (!joinReq) return Response.json({ ok: true });

  // 4. Extract Telegram fields
  const userId    = joinReq.from?.id;
  const chatId    = joinReq.chat?.id;
  const username  = joinReq.from?.username   || null;
  const firstName = joinReq.from?.first_name || null;
  const lastName  = joinReq.from?.last_name  || null;
  const invName   = joinReq.invite_link?.name ?? "";

  console.log("┌─────────────────────────────────────────────────────");
  console.log("│ [Webhook] 📨 JOIN REQUEST");
  console.log("│ user_id    : " + userId);
  console.log("│ username   : @" + (username || "(none)"));
  console.log("│ first_name : " + (firstName || "(none)"));
  console.log("│ chat_id    : " + chatId);
  console.log("│ invite     : " + (invName || "(none)"));
  console.log("└─────────────────────────────────────────────────────");

  if (!userId || !chatId) {
    console.error("[Webhook] ❌ Missing userId or chatId");
    return Response.json({ ok: true });
  }

  // 5. Deduplication — one event per user per chat
  const dedupeKey = `processed:${chatId}:${userId}`;
  try {
    const already = await kv.get(dedupeKey);
    if (already) {
      console.log(`[Webhook] ⏩ DUPLICATE — user ${userId} already processed — skipped`);
      return Response.json({ ok: true });
    }
  } catch (e) {
    console.error("[Webhook] ⚠️  KV dedup read error:", e);
  }

  // 6. Extract uniqueId from invite name
  let uniqueId = null;
  if (invName.startsWith("start=")) uniqueId = invName.slice(6).trim();

  // 7. Retrieve session from KV
  let session = {
    fbclid: "", fbp: "", fbc: "", userAgent: "",
    clientIp: "", pageUrl: "",
    timestamp: Math.floor(Date.now() / 1000),
  };

  if (uniqueId) {
    try {
      const raw = await kv.get(`join:${uniqueId}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        session = { ...session, ...parsed };
        console.log("┌─────────────────────────────────────────────────────");
        console.log("│ [KV] ✅ Session found");
        console.log("│ uniqueId : " + uniqueId);
        console.log("│ fbclid   : " + (session.fbclid   || "(none)"));
        console.log("│ fbp      : " + (session.fbp      || "(none)"));
        console.log("│ fbc      : " + (session.fbc      || "(none)"));
        console.log("│ ip       : " + (session.clientIp || "(none)"));
        console.log("│ ua       : " + (session.userAgent?.slice(0,60) || "(none)"));
        console.log("└─────────────────────────────────────────────────────");
      } else {
        console.warn(`[KV] ⚠️  No session for uniqueId:${uniqueId}`);
      }
    } catch (e) {
      console.error("[KV] ❌ Read error:", e);
    }
  } else {
    console.warn("[Webhook] ⚠️  No uniqueId in invite name");
  }

  // 8. Send to Facebook CAPI
  try {
    await sendToFacebook({
      ...session,
      userId,
      chatId,
      username,
      firstName: firstName || lastName,
    });
  } catch (e) {
    console.error("[FB] ❌ Unhandled error:", e);
  }

  // 9. Mark as processed — 30 days
  try {
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 30 });
  } catch (e) {
    console.error("[Webhook] ⚠️  KV write error:", e);
  }

  // 10. Always 200 OK to Telegram
  return Response.json({ ok: true });
}
