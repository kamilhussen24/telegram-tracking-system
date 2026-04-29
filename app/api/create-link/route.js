import { kv } from "@vercel/kv";

export const runtime = "nodejs";

export async function POST(request) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("[create-link] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return Response.json({ error: "Server config missing" }, { status: 500 });
  }

  // ── Parse request body ──────────────────────────────────────
  let fbclid = "", fbp = "", fbc = "", userAgent = "", pageUrl = "";
  try {
    const body = await request.json();
    fbclid    = (body.fbclid    || "").trim().slice(0, 500);
    fbp       = (body.fbp       || "").trim().slice(0, 200);
    fbc       = (body.fbc       || "").trim().slice(0, 300);
    userAgent = (body.userAgent || "").trim().slice(0, 500);
    pageUrl   = (body.pageUrl   || "").trim().slice(0, 500);
  } catch {
    // body parse fail — continue with empty values
  }

  // ── Real client IP (Vercel forwards this header) ────────────
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";

  // ── Build session ────────────────────────────────────────────
  const uniqueId  = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const timestamp = Math.floor(Date.now() / 1000);

  // Construct fbc if pixel cookie not present
  const finalFbc = fbc || (fbclid ? `fb.1.${timestamp * 1000}.${fbclid}` : "");

  const session = {
    fbclid, fbp, fbc: finalFbc,
    userAgent, clientIp, pageUrl,
    timestamp, createdAt: new Date().toISOString(),
  };

  // ── Save to KV (30 day TTL — webhook fires within minutes) ──
  try {
    await kv.set(`join:${uniqueId}`, JSON.stringify(session), {
      ex: 60 * 60 * 24 * 30,
    });
  } catch (kvErr) {
    console.error("[create-link] KV write failed:", kvErr?.message || kvErr);
    return Response.json({ error: "Storage error — try again" }, { status: 500 });
  }

  // ── Create Telegram invite link ──────────────────────────────
  // expire_date = 1 hour from now
  // This prevents Telegram's 100 active link limit from being hit
  // Users click immediately, so 1 hour is always sufficient
  const expireDate = timestamp + 3600;
  let tgData;

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id:              CHAT_ID,
          name:                 `start=${uniqueId}`,
          creates_join_request: true,
          expire_date:          expireDate,
        }),
      }
    );
    tgData = await tgRes.json();
  } catch (netErr) {
    console.error("[create-link] Telegram network error:", netErr?.message || netErr);
    return Response.json({ error: "Could not reach Telegram. Try again." }, { status: 502 });
  }

  if (!tgData.ok) {
    console.error("[create-link] Telegram API error:", JSON.stringify(tgData));

    // Specific error messages for common issues
    const desc = tgData.description || "";
    let userMsg = "Failed to create invite link.";
    if (desc.includes("not enough rights"))  userMsg = "Bot does not have invite permission in the channel.";
    if (desc.includes("chat not found"))     userMsg = "Channel not found. Check TELEGRAM_CHAT_ID.";
    if (desc.includes("bot was kicked"))     userMsg = "Bot was removed from the channel.";

    return Response.json({ error: userMsg }, { status: 502 });
  }

  console.log(
    `[create-link] OK | uniqueId:${uniqueId}` +
    ` | fbclid:${fbclid || "none"}` +
    ` | fbp:${fbp ? "yes" : "no"}` +
    ` | fbc:${finalFbc ? "yes" : "no"}` +
    ` | ip:${clientIp || "none"}` +
    ` | expires:${new Date(expireDate * 1000).toISOString()}`
  );

  return Response.json({ inviteLink: tgData.result.invite_link });
}
