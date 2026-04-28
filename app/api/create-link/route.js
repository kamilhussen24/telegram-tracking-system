import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const { fbclid } = await request.json();

  const uniqueId = crypto.randomUUID().replace(/-/g, '').slice(0, 12); // 082c12070cdd
  const key = `join:${uniqueId}`;

  await kv.set(key, fbclid || 'no_fbclid', { ex: 3600 }); // 1 ঘণ্টা

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      name: `start=${uniqueId}`,
      creates_join_request: true,
      // member_limit: 1,  // ঐচ্ছিক
    }),
  });

  const data = await res.json();

  return NextResponse.json({ invite_link: data.result.invite_link });
}