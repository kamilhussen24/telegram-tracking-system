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

    // Env Var চেক
    if (!channelId) {
      log('ERROR', 'TELEGRAM_CHANNEL_ID missing in environment')
      return NextResponse.json({ error: 'Server config: Channel ID missing' }, { status: 500 })
    }
    if (!botToken) {
      log('ERROR', 'BOT_TOKEN missing in environment')
      return NextResponse.json({ error: 'Server config: Bot Token missing' }, { status: 500 })
    }

    const uniqueId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    log('INFO', 'Generated uniqueId', uniqueId)

    // KV চেক + সেভ
    try {
      if (fbclid) {
        await kv.set(`join:${uniqueId}`, fbclid, { ex: 604800 })
        log('SUCCESS', 'fbclid saved to KV', { uniqueId, fbclid })
      }
    } catch (kvError) {
      log('ERROR', 'KV Database error', kvError.message)
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Telegram API কল
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/createChatInviteLink`
    
    const linkResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        name: `start=${uniqueId}`,
        creates_join_request: true,
        member_limit: 1
      })
    })

    const linkData = await linkResponse.json()

    if (!linkData.ok) {
      log('ERROR', 'Telegram API failed', linkData)
      // Telegram এর আসল Error মেসেজ দাও
      const errorMsg = linkData.description || 'Failed to create invite link'
      return NextResponse.json({ error: `Telegram: ${errorMsg}` }, { status: 500 })
    }

    const telegramLink = linkData.result.invite_link
    log('SUCCESS', 'Telegram invite link created', telegramLink)

    return NextResponse.json({ link: telegramLink })

  } catch (error) {
    log('ERROR', 'Unhandled exception', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}