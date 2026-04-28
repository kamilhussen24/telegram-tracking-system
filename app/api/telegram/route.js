import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const update = await request.json();

    // chat_join_request আসলে প্রসেস করব
    if (update.chat_join_request) {
      const req = update.chat_join_request;
      const inviteName = req.invite_link?.name || '';

      if (!inviteName.startsWith('start=')) {
        return NextResponse.json({ ok: true });
      }

      const uniqueId = inviteName.replace('start=', '');
      const fbclid = await kv.get(`join:${uniqueId}`);

      if (!fbclid) {
        return NextResponse.json({ ok: true });
      }

      const userId = req.from.id;
      const channelId = req.chat.id;

      // Duplicate check
      const processedKey = `processed:${channelId}:${userId}`;
      if (await kv.get(processedKey)) {
        return NextResponse.json({ ok: true });
      }

      // Facebook CAPI Call
      const pixelId = process.env.FB_PIXEL_ID;
      const accessToken = process.env.FB_ACCESS_TOKEN;

      const eventTime = Math.floor(Date.now() / 1000);

      await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            {
              event_name: 'CompleteRegistration',
              event_time: eventTime,
              action_source: 'system_generated',
              user_data: {
                fbc: `fb.1.${eventTime}.${fbclid}`,
                external_id: userId.toString(), // Telegram user ID
              },
              event_id: `join_${channelId}_${userId}`,
            },
          ],
        }),
      });

      // Mark as processed (24 ঘণ্টা)
      await kv.set(processedKey, '1', { ex: 86400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: true });
  }
}