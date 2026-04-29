import { kv } from "@vercel/kv";

export const runtime = "nodejs";

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

async function sendToFacebook({ fbclid, fbp, fbc, userAgent, clientIp, timestamp, userId, chatId, username, firstName }) {
  const PIXEL_ID     = process.env.FACEBOOK_PIXEL_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const TEST_CODE    = process.env.FACEBOOK_TEST_EVENT_CODE;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.log("[CAPI] Skipped — env vars not set");
    return;
  }

  const finalFbc = fbc || (fbclid ? `fb.1.${timestamp * 1000}.${fbclid}` : undefined);

  const [h_userId, h_ip, h_firstName, h_username] = await Promise.all([
    sha256(userId),
    sha256(clientIp),
    sha256(firstName),
    sha256(username),
  ]);

  const eventId   = `tg_joinreq_${chatId}_${userId}`;
  const eventTime = Math.floor(Date.now() / 1000);

  const user_data = {
    external_id: h_userId,
    ...(h_ip        && { client_ip_address: h_ip }),
    ...(h_firstName && { fn: h_firstName }),
    ...(h_username  && { ln: h_username }),
    ...(finalFbc    && { fbc: finalFbc }),
    ...(fbp         && { fbp }),
    ...(userAgent   && { client_user_agent: userAgent }),
  };

  const payload = {
    data: [{
      event_name:    "CompleteRegistration",
      event_time:    eventTime,
      event_id:      eventId,
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
    }],
    ...(TEST_CODE && { test_event_code: TEST_CODE }),
  };

  // Log the payload cleanly
  console.log("[CAPI] Sending payload:");
  console.log(JSON.stringify(payload, null, 2));

  const res  = await fetch(
    `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
  );
  const json = await res.json();

  if (json.error) {
    console.error("[CAPI] Error:", json.error.code, json.error.message);
  } else {
    console.log("[CAPI] Success — events_received:", json.events_received, "| fbtrace_id:", json.fbtrace_id);
    console.log("[CAPI] Signals — fbclid:", fbclid ? "yes" : "no", "| fbp:", fbp ? "yes" : "no", "| fbc:", finalFbc ? "yes" : "no", "| ip:", clientIp ? "yes" : "no", "| ua:", userAgent ? "yes" : "no");
  }

  return json;
}

function isValidSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

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

  // Deduplication
  const dedupeKey = `processed:${chatId}:${userId}`;
  try {
    const already = await kv.get(dedupeKey);
    if (already) {
      console.log(`[Webhook] Duplicate — user ${userId} already tracked`);
      return Response.json({ ok: true });
    }
  } catch (e) {
    console.error("[Webhook] KV dedup read error:", e.message);
  }

  // Extract uniqueId
  let uniqueId = null;
  if (invName.startsWith("start=")) uniqueId = invName.slice(6).trim();

  // Retrieve session from KV
  let session = { fbclid: "", fbp: "", fbc: "", userAgent: "", clientIp: "", timestamp: Math.floor(Date.now() / 1000) };
  if (uniqueId) {
    try {
      const raw = await kv.get(`join:${uniqueId}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        session = { ...session, ...parsed };
        console.log(`[KV] Session found — fbclid: ${session.fbclid || "none"} | fbp: ${session.fbp ? "yes" : "no"} | ip: ${session.clientIp || "none"}`);
      } else {
        console.warn(`[KV] No session for uniqueId: ${uniqueId}`);
      }
    } catch (e) {
      console.error("[KV] Read error:", e.message);
    }
  }

  // Send to Facebook
  try {
    await sendToFacebook({ ...session, userId, chatId, username, firstName });
  } catch (e) {
    console.error("[CAPI] Unhandled error:", e.message);
  }

  // Mark processed
  try {
    await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 30 });
  } catch (e) {
    console.error("[KV] Write error:", e.message);
  }

  return Response.json({ ok: true });
}
