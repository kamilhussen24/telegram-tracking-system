import { kv } from "@vercel/kv";

export const runtime = "nodejs";

// ─── SHA-256 — only for PII that Meta requires hashed ─────────────────────
// Meta CAPI hashing rules:
//   HASH:     external_id, em, ph, fn, ln, ct, st, zp, country, db, ge
//   NO HASH:  client_ip_address, client_user_agent, fbc, fbp
// Ref: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
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

// ─── Build Facebook CAPI payload ──────────────────────────────────────────
async function buildPayload({
  fbclid, fbp, fbc,
  userAgent, clientIp,
  timestamp, userId, chatId,
  username, firstName,
}) {
  // fbc priority: pixel cookie (_fbc) → construct from fbclid
  const finalFbc = fbc || (fbclid ? `fb.1.${timestamp * 1000}.${fbclid}` : undefined);

  // Hash only PII fields (Meta requirement)
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

    // ✅ Raw (NOT hashed) — Meta spec
    ...(clientIp  && { client_ip_address: clientIp }),   // plain IP
    ...(userAgent && { client_user_agent: userAgent }),  // plain UA string
    ...(finalFbc  && { fbc: finalFbc }),                 // plain fbc
    ...(fbp       && { fbp }),                           // plain fbp
  };

  const event = {
    event_name:    "CompleteRegistration",
    event_time:    eventTime,
    event_id:      eventId,        // deduplication key
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

// ─── Send to Facebook CAPI ────────────────────────────────────────────────
async function sendToFacebook(params) {
  const PIXEL_ID     = process.env.FACEBOOK_PIXEL_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const TEST_CODE    = process.env.FACEBOOK_TEST_EVENT_CODE;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.log("[CAPI] Skipped — FACEBOOK_PIXEL_ID or FACEBOOK_ACCESS_TOKEN not set");
    return;
  }

  const { eventId, eventTime, event, finalFbc } = await buildPayload(params);

  const body = {
    data: [event],
    ...(TEST_CODE && { test_event_code: TEST_CODE }),
  };

  // Log full payload
  console.log("[CAPI] Sending payload:");
  console.log(JSON.stringify(body, null, 2));

  const res  = await fetch(
    `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const json = await res.json();

  if (json.error) {
    console.error(`[CAPI] Error ${json.error.code}: ${json.error.message}`);
  } else {
    console.log(`[CAPI] Success — events_received: ${json.events_received} | fbtrace_id: ${json.fbtrace_id}`);
    console.log(`[CAPI] Signals — fbclid: ${params.fbclid ? "yes" : "no"} | fbp: ${params.fbp ? "yes" : "no"} | fbc: ${finalFbc ? "yes" : "no"} | ip: ${params.clientIp ? "yes" : "no"} | ua: ${params.userAgent ? "yes" : "no"}`);
  }

  return json;
}

// ─── Verify Telegram webhook secret ───────────────────────────────────────
function isValidSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

// ─── Main webhook handler ─────────────────────────────────────────────────
export async function POST(request) {
  if (!isValidSecret(request)) {
    console.warn("[Webhook] Rejected — invalid secret");
    return Response.json({ ok: false }, { status: 403 });
  }

  let update;
  try { update = await request.json(); }
  catch { return Response.json({ ok: false }, { status: 400 }); }

  const joinReq = update.chat_join_request;
  if (!joinReq) return Response.json({ ok: true });

  const userId    = joinReq.from?.id;
  const chatId    = joinReq.chat?.id;
  const username  = joinReq.from?.username   || null;
  const firstName = joinReq.from?.first_name || null;
  const invName   = joinReq.invite_link?.name ?? "";

  console.log(`[Webhook] Join request — user: ${userId} (@${username || "?"}) | chat: ${chatId}`);

  if (!userId || !chatId) return Response.json({ ok: true });

  // Deduplication — one event per user per chat (30 days)
  const dedupeKey = `processed:${chatId}:${userId}`;
  try {
    const already = await kv.get(dedupeKey);
    if (already) {
      console.log(`[Webhook] Duplicate — user ${userId} already tracked, skipping`);
      return Response.json({ ok: true });
    }
  } catch (e) {
    console.error("[Webhook] KV dedup read error:", e.message);
  }

  // Extract uniqueId from invite link name: "start=<uniqueId>"
  let uniqueId = null;
  if (invName.startsWith("start=")) uniqueId = invName.slice(6).trim();

  // Retrieve session signals from KV
  let session = {
    fbclid: "", fbp: "", fbc: "", userAgent: "",
    clientIp: "", timestamp: Math.floor(Date.now() / 1000),
  };

  if (uniqueId) {
    try {
      const raw = await kv.get(`join:${uniqueId}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        session = { ...session, ...parsed };
        console.log(`[KV] Session found — fbclid: ${session.fbclid || "none"} | fbp: ${session.fbp ? "yes" : "no"} | fbc: ${session.fbc ? "yes" : "no"} | ip: ${session.clientIp || "none"}`);
      } else {
        console.warn(`[KV] No session found for uniqueId: ${uniqueId}`);
      }
    } catch (e) {
      console.error("[KV] Read error:", e.message);
    }
  }

  // Send to Facebook CAPI
  try {
    await sendToFacebook({ ...session, userId, chatId, username, firstName });
  } catch (e) {
    console.error("[CAPI] Unhandled error:", e.message);
  }

  // Mark as processed
  try {
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 30 });
  } catch (e) {
    console.error("[KV] Write error:", e.message);
  }

  return Response.json({ ok: true });
}
