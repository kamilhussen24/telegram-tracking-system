import { kv } from "@vercel/kv";

export const runtime = "nodejs";

export async function POST(request) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("[create-link] ❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return Response.json({ error: "Server config missing" }, { status: 500 });
  }

  // ── Parse body ───────────────────────────────────────────────
  let fbclid = "", fbp = "", userAgent = "", pageUrl = "";
  try {
    const body = await request.json();
    fbclid    = (body.fbclid    || "").trim().slice(0, 500);
    fbp       = (body.fbp       || "").trim().slice(0, 200);
    userAgent = (body.userAgent || "").trim().slice(0, 500);
    pageUrl   = (body.pageUrl   || "").trim().slice(0, 500);
  } catch { /* no body */ }

  // ── Real client IP (Vercel forwards this) ────────────────────
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";

  // ── Unique session ID ─────────────────────────────────────────
  const uniqueId  = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const timestamp = Math.floor(Date.now() / 1000);

  // ── Store all signals in KV (30 days TTL) ────────────────────
  const payload = {
    fbclid,
    fbp,
    userAgent,
    clientIp,
    pageUrl,
    timestamp,
    createdAt: new Date().toISOString(),
  };

  try {
    await kv.set(`join:${uniqueId}`, JSON.stringify(payload), {
      ex: 60 * 60 * 24 * 30,
    });
  } catch (e) {
    console.error("[create-link] ❌ KV write failed:", e);
    return Response.json({ error: "Storage error" }, { status: 500 });
  }

  console.log(
    `[create-link] ✅ Session saved` +
    ` | uniqueId:${uniqueId}` +
    ` | fbclid:${fbclid || "(none)"}` +
    ` | fbp:${fbp || "(none)"}` +
    ` | ip:${clientIp || "(none)"}` +
    ` | ua:${userAgent.slice(0, 60) || "(none)"}`
  );

  // ── Create Telegram invite link ───────────────────────────────
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
        }),
      }
    );
    tgData = await tgRes.json();
  } catch (e) {
    console.error("[create-link] ❌ Telegram network error:", e);
    return Response.json({ error: "Telegram unreachable" }, { status: 502 });
  }

  if (!tgData.ok) {
    console.error("[create-link] ❌ Telegram API error:", JSON.stringify(tgData));
    return Response.json({ error: `Telegram: ${tgData.description}` }, { status: 502 });
  }

  return Response.json({ inviteLink: tgData.result.invite_link });
}
