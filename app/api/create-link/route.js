import { kv } from "@vercel/kv";

export async function POST(request) {
  try {
    const { fbclid } = await request.json();

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      return Response.json({ error: "Server config missing" }, { status: 500 });
    }

    // 1. Unique ID তৈরি করো
    const uniqueId  = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const timestamp = Math.floor(Date.now() / 1000);

    // 2. KV তে save করো — uniqueId → { fbclid, timestamp }
    await kv.set(
      `join:${uniqueId}`,
      JSON.stringify({ fbclid: fbclid || "", timestamp }),
      { ex: 60 * 60 * 24 * 30 } // 30 দিন
    );

    // 3. Telegram invite link তৈরি করো
    //    creates_join_request: true → user কে request করতে হবে, auto-join না
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createChatInviteLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          name: `start=${uniqueId}`,  // webhook এ এটা দিয়ে fbclid খুঁজবো
          creates_join_request: true,  // ← join request mode ON
        }),
      }
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      console.error("Telegram error:", tgData);
      return Response.json(
        { error: `Telegram: ${tgData.description}` },
        { status: 502 }
      );
    }

    return Response.json({ inviteLink: tgData.result.invite_link });

  } catch (err) {
    console.error("create-link error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
