import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const log = (level, msg, data) => {
  const time = new Date().toISOString()
  console.log(`[${time}] [${level}] [WEBHOOK] ${msg}`, data? JSON.stringify(data) : '')
}

export async function POST(request) {
  log('INFO', '=== Webhook Triggered ===')

  try {
    const data = await request.json()

    // শুধু chat_join_request হলেই কাজ করবো। Message আসলে ইগনোর
    if (!data.chat_join_request) {
      log('INFO', 'Not a join request. Type:', Object.keys(data)[0])
      return NextResponse.json({ ok: true })
    }

    const joinRequest = data.chat_join_request
    const userId = joinRequest.from.id
    const username = joinRequest.from.username || 'no_username'
    const firstName = joinRequest.from.first_name || 'Unknown'
    const channelId = joinRequest.chat.id
    const channelTitle = joinRequest.chat.title

    log('INFO', 'Join Request Details', {
      user: `${firstName} (@${username})`,
      userId,
      channel: channelTitle,
      channelId
    })

    // ডুপ্লিকেট চেক: এই ইউজার আগেই রিকোয়েস্ট করছে কিনা
    const duplicateKey = `processed:${channelId}:${userId}`
    const alreadyProcessed = await kv.get(duplicateKey)

    if (alreadyProcessed) {
      log('WARN', 'Duplicate join request detected. Skipping FB event.', { userId, channelId })
      return NextResponse.json({ ok: true })
    }

    // 30 দিনের জন্য মার্ক করে রাখো যে এই ইউজারের ইভেন্ট পাঠানো হইছে
    await kv.set(duplicateKey, Date.now(), { ex: 2592000 })

    const startParam = joinRequest.invite_link?.name || ''
    const uniqueId = startParam.replace('start=', '').trim()
    log('INFO', 'Extracted uniqueId from start param', uniqueId || 'none')

    // fbclid বের করো
    const fbclid = uniqueId? await kv.get(`join:${uniqueId}`) : null
    log('INFO', 'fbclid lookup result', fbclid || 'not_found')

    const eventTime = Math.floor(Date.now() / 1000)
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     '0.0.0.0'
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    // Facebook CAPI Payload - FB এর সব নিয়ম মেনে
    const payload = {
      data: [{
        event_name: 'Join',
        event_time: eventTime,
        event_id: `join_${channelId}_${userId}_${eventTime}`, // Deduplication ID
        action_source: 'website',
        user_data: {
          external_id: String(userId),
          client_ip_address: clientIP,
          client_user_agent: userAgent
        },
        custom_data: {
          content_name: 'Community Access'
        }
      }],
      access_token: process.env.FB_ACCESS_TOKEN
    }

    // fbc শুধু থাকলেই অ্যাড করো
    if (fbclid) {
      payload.data[0].user_data.fbc = `fb.1.${eventTime}.${fbclid}`
    }

    log('INFO', 'Sending to Facebook CAPI', {
      event: 'Join',
      has_fbc:!!fbclid,
      external_id: userId
    })

    // Facebook এ পাঠাও
    const fbRes = await fetch(`https://graph.facebook.com/v19.0/${process.env.FB_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const fbData = await fbRes.json()

    if (fbRes.ok) {
      log('SUCCESS', 'Facebook CAPI Success', fbData)
      await kv.incr('stats:joins_total')
    } else {
      log('ERROR', 'Facebook CAPI Failed', fbData)
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    log('ERROR', 'Webhook handler crashed', error.message)
    // Telegram কে সবসময় ok দিবা নাহলে বারবার retry করবে
    return NextResponse.json({ ok: true })
  }
}