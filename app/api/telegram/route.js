import { kv } from "@vercel/kv";

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 hash (Web Crypto — works in Next.js Edge & Node runtime)
// ─────────────────────────────────────────────────────────────────────────────
async function sha256(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(text).toLowerCase().trim())
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Facebook CAPI — CompleteRegistration event পাঠাও
// ─────────────────────────────────────────────────────────────────────────────
async function sendToFacebook({ fbclid, timestamp, userId, chatId }) {
  const PIXEL_ID     = process.env.FACEBOOK_PIXEL_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("[FB] CAPI env vars missing — skipped");
    return null;
  }

  // fbc cookie format: fb.{subdomain}.{timestamp_ms}.{fbclid}
  const fbc          = fbclid ? `fb.1.${timestamp * 1000}.${fbclid}` : undefined;
  const hashedUserId = await sha256(userId);

  // event_id দিয়ে duplicate prevent করা হয়
  const eventId = `joinreq_${chatId}_${userId}`;

  const payload = {
    data: [
      {
        event_name:    "CompleteRegistration",
        event_time:    Math.floor(Date.now() / 1000),
        event_id:      eventId,
        action_source: "website",
        user_data: {
          external_id: hashedUserId,
          ...(fbc ? { fbc } : {}),
        },
        custom_data: {
          status: "telegram_join_requested",
        },
      },
    ],
    // ↓ Test Events এর সময় uncomment করো, তারপর আবার comment করো
    // test_event_code: "TEST12345",
  };

  const res  = await fetch(
    `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    }
  );

  const json = await res.json();
  console.log("[FB] CAPI response:", JSON.stringify(json));
  return json;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook secret verify
// ─────────────────────────────────────────────────────────────────────────────
function isValidSecret(req) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // env set না থাকলে skip
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === secret;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main webhook handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request) {

  // 1. Secret check
  if (!isValidSecret(request)) {
    console.warn("[Webhook] Invalid secret — rejected");
    return Response.json({ ok: false }, { status: 403 });
  }

  // 2. Body parse
  let update;
  try {
    update = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  console.log("[Webhook] Update received:", JSON.stringify(update));

  // 3. শুধু chat_join_request handle করবো
  //    (member_updated, message, etc. সব ignore)
  const joinReq = update.chat_join_request;
  if (!joinReq) {
    return Response.json({ ok: true });
  }

  const userId     = joinReq.from?.id;          // Telegram user ID
  const chatId     = joinReq.chat?.id;          // Channel/Group ID
  const inviteName = joinReq.invite_link?.name ?? ""; // "start=<uniqueId>"

  if (!userId || !chatId) {
    console.error("[Webhook] Missing userId or chatId");
    return Response.json({ ok: true });
  }

  // 4. Duplicate check — একই user এর জন্য দুইবার event যাবে না
  const dedupeKey = `processed:${chatId}:${userId}`;
  const alreadyDone = await kv.get(dedupeKey);
  if (alreadyDone) {
    console.log(`[Webhook] Duplicate — user ${userId} already processed`);
    return Response.json({ ok: true });
  }

  // 5. Invite link name থেকে uniqueId বের করো
  //    Format: "start=082c12070cdd4a1e"
  let uniqueId = null;
  if (inviteName.startsWith("start=")) {
    uniqueId = inviteName.slice(6).trim();
  }

  // 6. KV থেকে fbclid ও timestamp আনো
  let fbclid    = "";
  let timestamp = Math.floor(Date.now() / 1000);

  if (uniqueId) {
    try {
      const raw = await kv.get(`join:${uniqueId}`);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        fbclid    = parsed.fbclid    || "";
        timestamp = parsed.timestamp || timestamp;
        console.log(`[KV] Found — uniqueId:${uniqueId} fbclid:${fbclid}`);
      } else {
        console.warn(`[KV] No data for uniqueId: ${uniqueId}`);
      }
    } catch (e) {
      console.error("[KV] Parse error:", e);
    }
  } else {
    // invite link আমাদের তৈরি না (admin manually share করেছে)
    // event পাঠাবো তবে fbclid ছাড়া
    console.warn("[Webhook] inviteName has no uniqueId — no fbclid");
  }

  // 7. ✅ Facebook CAPI তে event পাঠাও
  //    Auto-approve নেই — admin manually approve করবে Telegram এ
  try {
    await sendToFacebook({ fbclid, timestamp, userId, chatId });
  } catch (err) {
    console.error("[FB] CAPI send error:", err);
    // Telegram কে 200 দিতেই হবে, তাই error throw করি না
  }

  // 8. Processed mark করো (30 দিন)
  await kv.set(dedupeKey, "1", { ex: 60 * 60 * 24 * 30 });

  // 9. Telegram কে 200 OK দাও (required)
  return Response.json({ ok: true });
}
