import { kv } from "@vercel/kv";

export const runtime = "nodejs";

/* ═══════════════════════════════════════════════════════════════════
   SHA-256 hash — Facebook requires all PII to be hashed
   ═══════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════
   Build the full Facebook CAPI payload
   All recommended fields for maximum Event Match Quality (EMQ)
   Docs: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters
   ═══════════════════════════════════════════════════════════════════ */
async function buildCAPIPayload({
  fbclid, fbp, userAgent, clientIp, pageUrl,
  timestamp, userId, chatId, username, firstName,
}) {
  /* ── fbc: Facebook Click ID cookie ─────────────────────────────
     Format: fb.{subdomain_index}.{timestamp_ms}.{fbclid}
     This is the MAIN attribution signal — do not hash             */
  const fbc = fbclid
    ? `fb.1.${timestamp * 1000}.${fbclid}`
    : undefined;

  /* ── Hash all PII (Facebook requirement) ───────────────────────*/
  const [
    hashedUserId,
    hashedIp,
    hashedUsername,
    hashedFirstName,
  ] = await Promise.all([
    sha256(userId),
    sha256(clientIp),
    sha256(username),
    sha256(firstName),
  ]);

  /* ── Stable dedup event_id ──────────────────────────────────────
     Same user + same chat → always same ID → FB deduplicates      */
  const eventId   = `tg_joinreq_${chatId}_${userId}`;
  const eventTime = Math.floor(Date.now() / 1000);

  /* ── Full user_data object ──────────────────────────────────────*/
  const user_data = {
    // Identifiers (hashed)
    external_id:  hashedUserId,
    ...(hashedIp        && { client_ip_address: hashedIp }),
    ...(hashedFirstName && { fn: hashedFirstName }),
    ...(hashedUsername  && { ln: hashedUsername }),

    // Facebook signals (NOT hashed)
    ...(fbc        && { fbc }),
    ...(fbp        && { fbp }),
    ...(userAgent  && { client_user_agent: userAgent }),
  };

  /* ── Full event object ──────────────────────────────────────────*/
  const event = {
    event_name:    "CompleteRegistration",
    event_time:    eventTime,
    event_id:      eventId,
    action_source: "website",

    user_data,

    custom_data: {
      content_name:     "Telegram Channel Join Request",
      content_category: "community",
      status:           "join_requested",
      telegram_chat_id: String(chatId),
      has_fbclid:       fbclid ? "yes" : "no",
      has_fbp:          fbp    ? "yes" : "no",
    },
  };

  return { eventId, eventTime, event, fbc };
}

/* ═══════════════════════════════════════════════════════════════════
   Send to Facebook CAPI + log the full payload
   ═══════════════════════════════════════════════════════════════════ */
async function sendToFacebook(params) {
  const PIXEL_ID     = process.env.FACEBOOK_PIXEL_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const TEST_CODE    = process.env.FACEBOOK_TEST_EVENT_CODE;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("[FB] ⚠️  CAPI env vars not set — event skipped");
    return;
  }

  const { eventId, eventTime, event, fbc } = await buildCAPIPayload(params);

  const body = {
    data: [event],
    ...(TEST_CODE && { test_event_code: TEST_CODE }),
  };

  /* ── Log the full payload (visible in Vercel → Functions → Logs) */
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[FB] 📤 CAPI PAYLOAD SENDING:");
  console.log(JSON.stringify(body, null, 2));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const res  = await fetch(
    `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    }
  );

  const json = await res.json();

  /* ── Log the result ─────────────────────────────────────────── */
  if (json.error) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("[FB] ❌ CAPI ERROR:");
    console.error(JSON.stringify(json, null, 2));
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } else {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[FB] ✅ CAPI SUCCESS:");
    console.log(`  event_id        : ${eventId}`);
    console.log(`  event_time      : ${eventTime} (${new Date(eventTime * 1000).toISOString()})`);
    console.log(`  events_received : ${json.events_received}`);
    console.log(`  fbtrace_id      : ${json.fbtrace_id}`);
    console.log(`  fbc             : ${fbc || "(none — no fbclid)"}`);
    console.log(`  has_fbp         : ${params.fbp ? "yes" : "no"}`);
    console.log(`  has_ip          : ${params.clientIp ? "yes" : "no"}`);
    console.log(`  has_ua          : ${params.userAgent ? "yes" : "no"}`);
    if (json.messages?.length) {
      console.log(`  messages        : ${json.messages.join(" | ")}`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  return json;
}

/* ═══════════════════════════════════════════════════════════════════
   Verify Telegram webhook secret
   ═══════════════════════════════════════════════════════════════════ */
function isValidSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN WEBHOOK HANDLER
   ═══════════════════════════════════════════════════════════════════ */
export async function POST(request) {

  /* 1. Security ── */
  if (!isValidSecret(request)) {
    console.warn("[Webhook] ⛔ Invalid secret — rejected");
    return Response.json({ ok: false }, { status: 403 });
  }

  /* 2. Parse ── */
  let update;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  /* 3. Filter — only chat_join_request ── */
  const joinReq = update.chat_join_request;
  if (!joinReq) {
    return Response.json({ ok: true });
  }

  /* 4. Extract Telegram fields ── */
  const userId    = joinReq.from?.id;
  const chatId    = joinReq.chat?.id;
  const username  = joinReq.from?.username   || null;
  const firstName = joinReq.from?.first_name || null;
  const invName   = joinReq.invite_link?.name ?? "";

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[Webhook] 📨 JOIN REQUEST RECEIVED:");
  console.log(`  user_id    : ${userId}`);
  console.log(`  username   : @${username || "(none)"}`);
  console.log(`  first_name : ${firstName || "(none)"}`);
  console.log(`  chat_id    : ${chatId}`);
  console.log(`  invite_name: ${invName || "(none)"}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!userId || !chatId) {
    console.error("[Webhook] ❌ Missing userId or chatId");
    return Response.json({ ok: true });
  }

  /* 5. Deduplication ── */
  const dedupeKey = `processed:${chatId}:${userId}`;
  try {
    const already = await kv.get(dedupeKey);
    if (already) {
      console.log(`[Webhook] ⏩ DUPLICATE — user ${userId} already processed — FB event skipped`);
      return Response.json({ ok: true });
    }
  } catch (e) {
    console.error("[Webhook] ⚠️  KV dedup read error:", e);
    // Proceed — better to risk duplicate than miss conversion
  }

  /* 6. Extract uniqueId from invite name: "start=<id>" ── */
  let uniqueId = null;
  if (invName.startsWith("start=")) {
    uniqueId = invName.slice(6).trim();
  }

  /* 7. Retrieve session data (fbclid, IP, UA, fbp) from KV ── */
  let session = {
    fbclid: "", fbp: "", userAgent: "", clientIp: "", pageUrl: "",
    timestamp: Math.floor(Date.now() / 1000),
  };

  if (uniqueId) {
    try {
      const raw = await kv.get(`join:${uniqueId}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        session = { ...session, ...parsed };
        console.log("[KV] ✅ Session retrieved:");
        console.log(`  uniqueId  : ${uniqueId}`);
        console.log(`  fbclid    : ${session.fbclid || "(none)"}`);
        console.log(`  fbp       : ${session.fbp    || "(none)"}`);
        console.log(`  ip        : ${session.clientIp || "(none)"}`);
        console.log(`  ua        : ${(session.userAgent || "").slice(0, 80) || "(none)"}`);
        console.log(`  page_url  : ${session.pageUrl || "(none)"}`);
      } else {
        console.warn(`[KV] ⚠️  No session for uniqueId:${uniqueId} — event will fire without fbclid`);
      }
    } catch (e) {
      console.error("[KV] ❌ Read error:", e);
    }
  } else {
    console.warn("[Webhook] ⚠️  No uniqueId in invite name — manual link or external join");
  }

  /* 8. Send Facebook CAPI ── */
  try {
    await sendToFacebook({
      ...session,
      userId,
      chatId,
      username,
      firstName,
    });
  } catch (e) {
    console.error("[FB] ❌ Unhandled CAPI error:", e);
    // Must not throw — Telegram needs 200 OK
  }

  /* 9. Mark processed — 30 days ── */
  try {
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 30 });
  } catch (e) {
    console.error("[Webhook] ⚠️  KV dedup write error:", e);
  }

  /* 10. Always 200 OK to Telegram ── */
  return Response.json({ ok: true });
}
