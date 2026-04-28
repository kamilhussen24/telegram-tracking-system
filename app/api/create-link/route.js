import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { fbclid } = await request.json()

    // 1. Env Var চেক
    if (!process.env.BOT_TOKEN) {
      return NextResponse.json({ error: 'BOT_TOKEN missing in Vercel Env Vars' }, { status: 500 })
    }
    if (!process.env.TELEGRAM_CHANNEL_ID) {
      return NextResponse.json({ error: 'TELEGRAM_CHANNEL_ID missing in Vercel Env Vars' }, { status: 500 })
    }

    // 2. KV চেক
    try {
      await kv.set('test', '1', { ex: 10 })
    } catch (e) {
      return NextResponse.json({ error: 'KV Database not connected. Connect Upstash Redis in Storage tab' }, { status: 500 })
    }

    const uniqueId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    
    if (fbclid) {
      await kv.set(`join:${uniqueId}`, fbclid, { ex: 604800 })
    }

    // 3. Telegram API কল
    const telegramApiUrl = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/createChatInviteLink`
    
    const linkResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHANNEL_ID,
        name: `start=${uniqueId}`,
        creates_join_request: true,
        member_limit: 1
      })
    })

    const linkData = await linkResponse.json()

    if (!linkData.ok) {
      return NextResponse.json({ 
        error: `Telegram Error: ${linkData.description}`,
        hint: 'Bot কে চ্যানেলে Admin বানাইছো? Invite via Link permission দিছো?'
      }, { status: 500 })
    }

    return NextResponse.json({ link: linkData.result.invite_link })

  } catch (error) {
    return NextResponse.json({ error: `Server Error: ${error.message}` }, { status: 500 })
  }
}