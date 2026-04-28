import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const log = (level, msg, data) => {
  const time = new Date().toISOString()
  console.log(`[${time}] [${level}] [CREATE-LINK] ${msg}`, data? JSON.stringify(data) : '')
}

export async function POST(request) {
  log('INFO', 'Request received')

  try {
    const { fbclid } = await request.json()
    log('INFO', 'fbclid param', fbclid || 'none')

    const channelId = process.env.TELEGRAM_CHANNEL_ID
    const botToken = process.env.BOT_TOKEN

    if (!channelId ||!botToken) {
      log('ERROR', 'TELEGRAM_CHANNEL_ID or BOT_TOKEN missing')
      return NextResponse.json({ error: 'Server config error' }, { status: 500 })
    }

    const uniqueId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    log('INFO', 'Generated uniqueId', uniqueId)

    if (fbclid) {
      await kv.set(`join:${uniqueId}`, fbclid, { ex: 604800 })
      log('SUCCESS', 'fbclid saved to KV', { uniqueId, fbclid })
    }

    // Telegram Bot API দিয়ে Invite Link বানাও
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/createChatInviteLink`

    const linkResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        name: `start=${uniqueId}`, // এটাই webhook এ পাবো
        creates_join_request: true, // প্রাইভেট চ্যানেলের জন্য মাস্ট
        member_limit: 1 // একবার ইউজ হবে, সিকিউর
      })
    })

    const linkData = await linkResponse.json()

    if (!linkData.ok) {
      log('ERROR', 'Telegram API failed to create link', linkData)
      return NextResponse.json({ error: 'Failed to create invite link' }, { status: 500 })
    }

    const telegramLink = linkData.result.invite_link
    log('SUCCESS', 'Telegram invite link created', telegramLink)

    return NextResponse.json({ link: telegramLink })

  } catch (error) {
    log('ERROR', 'Failed to create link', error.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}