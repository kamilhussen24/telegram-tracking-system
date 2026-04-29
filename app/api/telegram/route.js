import { kv } from "@vercel/kv";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 — Meta CAPI hashing rules:
//   HASH   : external_id, fn, ln, em, ph, ct, st, zp, country, db, ge
//   NO HASH: client_ip_address, client_user_agent, fbc, fbp
// Ref: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
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
// Build Meta CAPI payload
// ─────────────────────────────────────────────────────────────────────────────
async function buildPayload({ fbclid, fbp, fbc, userAgent, clientIp, timestamp, userId, chatId, username, firstName }) {

  // fbc: priority → pixel cookie (_fbc) → construct from fbclid
  const finalFbc = fbc || (fbclid ? `fb.1.${timestamp * 1000}.${fbclid}` : undefined);

  // Hash only PII (Meta requirement)
  const [h_userId, h_firstName, h_username] = await Promise.all([
    sha256(userId),
    sha256(firstName),
    sha256(username),
  ]);

  const eventId   = `tg_joinreq_${chatId}_${userId}`;
  const eventTime = Math.floor(Date.now() / 1000);

  const user_data = {
    // ✅ Hashed PII
    external_id: h_userId,
    ...(h_firstName && { fn: h_firstName }),
    ...(h_username  && { ln: h_username }),

    // ✅ Raw — Meta normalizes/processes these internally (do NOT hash)
    ...(clientIp  && { client_ip_address: clientIp }),
    ...(userAgent && { client_user_agent: userAgent }),
    ...(finalFbc  && { fbc: finalFbc }),
    ...(fbp       && { fbp }),
  };

  const event = {
    event_name:    "CompleteRegistration",
    event_time:    eventTime,
    event_id:      eventId,        // Deduplication — Meta ignores duplicates with same event_id
    action_source: "website",
    user_data,
    custom_data: {
      content_name:     "Community Join Request",
      content_category: "community",
      status:           "join_requested",
      has_fbclid:       fbclid   ? "yes" : "no",
      has_fbp:          fbp      ? "yes" : "no",
      has_fbc:          finalFbc ? "yes" : "no",
      has_ip:           clientIp ? "yes" : "no",
      has_ua:           userAgent? "yes" : "no",
    },
  };

  return { eventId, eventTime, event, finalFbc };
}

// ─────────────────────────────────────────────────────────────────────────────
// Send to Facebook CAPI
// ─────────────────────────────────────────────────────────────────────────────
async function sendToFacebook(params) {
  const PIXEL_ID     = process.env.FACEBOOK_PIXEL_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const TEST_CODE    = process.env.FACEBOOK_TEST_EVENT_CODE;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.log("[CAPI] Skipped — FACEBOOK_PIXEL_ID or FACEBOOK_ACCESS_TOKEN not configured");
    return;
  }

  const { eventId, eventTime, event, finalFbc } = await buildPayload(params);

  const body = {
    data: [event],
    ...(TEST_CODE && { test_event_code: TEST_CODE }),
  };

  // Log full payload for debugging
  console.log("[CAPI] Payload:");
  console.log(JSON.stringify(body, null, 2));

  let json;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    json = await res.json();
  } catch (netErr) {
    console.error("[CAPI] Network error:", netErr?.message || netErr);
    return;
  }

  if (json.error) {
    console.error(`[CAPI] Error ${json.error.code} (${json.error.type}): ${json.error.message}`);
    if (json.error.error_subcode) {
      console.error(`[CAPI] Subcode: ${json.error.error_subcode}`);
    }
  } else {
    console.log(
      `[CAPI] Success | events_received:${json.events_received}` +
      ` | fbtrace_id:${json.fbtrace_id}` +
      ` | event_id:${eventId}`
    );
    console.log(
      `[CAPI] Signals | fbclid:${params.fbclid ? "yes" : "no"}` +
      ` | fbp:${params.fbp ? "yes" : "no"}` +
      ` | fbc:${finalFbc ? "yes" : "no"}` +
      ` | ip:${params.clientIp ? "yes" : "no"}` +
      ` | ua:${params.userAgent ? "yes" : "no"}` +
      ` | name:${params.firstName ? "yes" : "no"}`
    );
    if (json.messages?.length) {
      console.log(`[CAPI] Messages: ${json.messages.join(" | ")}`);
    }
  }

  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify Telegram webhook secret header
// ─────────────────────────────────────────────────────────────────────────────
function isValidSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // skip check if not configured
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main webhook handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request) {

  // 1. Verify secret
  if (!isValidSecret(request)) {
    console.warn("[Webhook] Rejected — invalid secret token");
    return Response.json({ ok: false }, { status: 403 });
  }

  // 2. Parse body
  let update;
  try {
    update = await request.json();
  } catch {
    console.error("[Webhook] Failed to parse request body");
    return Response.json({ ok: false }, { status: 400 });
  }

  // 3. Only handle chat_join_request — ignore all other update types
  const joinReq = update.chat_join_request;
  if (!joinReq) return Response.json({ ok: true });

  // 4. Extract fields from Telegram update
  const userId    = joinReq.from?.id;
  const chatId    = joinReq.chat?.id;
  const username  = joinReq.from?.username   || null;
  const firstName = joinReq.from?.first_name || null;
  const lastName  = joinReq.from?.last_name  || null;
  const invName   = joinReq.invite_link?.name ?? "";

  console.log(`[Webhook] Join request | user:${userId} (@${username || "?"}) | chat:${chatId}`);

  if (!userId || !chatId) {
    console.error("[Webhook] Missing userId or chatId in update");
    return Response.json({ ok: true });
  }

  // 5. Deduplication — one CAPI event per user per chat (30 days)
  const dedupeKey = `processed:${chatId}:${userId}`;
  try {
    const already = await kv.get(dedupeKey);
    if (already) {
      console.log(`[Webhook] Duplicate — user ${userId} already tracked, skipping`);
      return Response.json({ ok: true });
    }
  } catch (kvErr) {
    // KV read failed — proceed anyway (better to risk duplicate than miss conversion)
    console.error("[Webhook] KV dedup read error:", kvErr?.message || kvErr);
  }

  // 6. Extract uniqueId from invite link name: "start=<uniqueId>"
  let uniqueId = null;
  if (invName.startsWith("start=")) {
    uniqueId = invName.slice(6).trim() || null;
  }

  // 7. Retrieve browser session signals from KV
  let session = {
    fbclid: "", fbp: "", fbc: "",
    userAgent: "", clientIp: "",
    timestamp: Math.floor(Date.now() / 1000),
  };

  if (uniqueId) {
    try {
      const raw = await kv.get(`join:${uniqueId}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        session = { ...session, ...parsed };
        console.log(
          `[KV] Session found | fbclid:${session.fbclid || "none"}` +
          ` | fbp:${session.fbp ? "yes" : "no"}` +
          ` | fbc:${session.fbc ? "yes" : "no"}` +
          ` | ip:${session.clientIp || "none"}`
        );
      } else {
        console.warn(`[KV] No session for uniqueId:${uniqueId} — event will fire without fbclid`);
      }
    } catch (kvErr) {
      console.error("[KV] Read/parse error:", kvErr?.message || kvErr);
    }
  } else {
    console.warn(`[Webhook] No uniqueId in invite name "${invName}" — manual link or external join`);
  }

  // 8. Send to Facebook CAPI
  try {
    await sendToFacebook({
      ...session,
      userId,
      chatId,
      username,
      firstName: firstName || lastName, // use lastName as fallback if no firstName
    });
  } catch (fbErr) {
    // Never let CAPI errors break the webhook response to Telegram
    console.error("[CAPI] Unhandled error:", fbErr?.message || fbErr);
  }

  // 9. Mark as processed (30 days TTL)
  try {
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 30 });
  } catch (kvErr) {
    console.error("[KV] Dedup write error:", kvErr?.message || kvErr);
  }

  // 10. Always return 200 OK to Telegram (critical — Telegram retries on non-200)
  return Response.json({ ok: true });
}
