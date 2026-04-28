import { kv } from "@vercel/kv";

export const runtime = "nodejs";

export async function POST(request) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("[create-link] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return Response.json({ error: "Server config missing" }, { status: 500 });
  }

  let fbclid = "";
  try {
    const body = await request.json();
    fbclid = (body.fbclid || "").trim().slice(0, 500); // sanitize
  } catch {
    // no body — that's fine, fbclid stays empty
  }

  // 1. Unique session ID
  const uniqueId  = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const timestamp = Math.floor(Date.now() / 1000);

  // 2. Persist to KV — expires in 30 days
  try {
    await kv.set(
      `join:${uniqueId}`,
      JSON.stringify({ fbclid, timestamp, createdAt: new Date().toISOString() }),
      { ex: 60 * 60 * 24 * 30 }
    );
  } catch (kvErr) {
    console.error("[create-link] KV write failed:", kvErr);
    return Response.json({ error: "Storage error" }, { status: 500 });
  }

  // 3. Create invite link — creates_join_request: true (user must request)
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
  } catch (netErr) {
    console.error("[create-link] Telegram network error:", netErr);
    return Response.json({ error: "Telegram unreachable" }, { status: 502 });
  }

  if (!tgData.ok) {
    console.error("[create-link] Telegram API error:", JSON.stringify(tgData));
    return Response.json(
      { error: `Telegram: ${tgData.description}` },
      { status: 502 }
    );
  }

  console.log(`[create-link] OK — uniqueId:${uniqueId} fbclid:${fbclid || "(none)"}`);
  return Response.json({ inviteLink: tgData.result.invite_link });
}
