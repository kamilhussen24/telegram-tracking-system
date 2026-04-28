import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    // এই লাইনেই ক্র্যাশ করতেছে যদি KV কানেক্ট না থাকে
    const { fbclid } = await request.json()
    const uniqueId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    
    if (fbclid) {
      await kv.set(`join:${uniqueId}`, fbclid, { ex: 604800 })
    }

    const telegramRes = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/createChatInviteLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHANNEL_ID,
        name: `start=${uniqueId}`,
        creates_join_request: true,
        member_limit: 1
      })
    })

    const data = await telegramRes.json()
    
    if (!data.ok) {
      return NextResponse.json({ error: `Telegram: ${data.description}` }, { status: 500 })
    }

    return NextResponse.json({ link: data.result.invite_link })

  } catch (e) {
    return NextResponse.json({ error: `Crash: ${e.message}` }, { status: 500 })
  }
}