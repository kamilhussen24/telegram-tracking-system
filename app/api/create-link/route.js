import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    if (!process.env.KV_REST_API_URL) {
      return NextResponse.json({ 
        error: 'Step 1 Failed: Upstash Redis not connected. Go to Storage → Create Database → Upstash Redis' 
      }, { status: 500 })
    }
    if (!process.env.BOT_TOKEN) {
      return NextResponse.json({ error: 'Step 2 Failed: BOT_TOKEN missing in Environment Variables' }, { status: 500 })
    }
    if (!process.env.TELEGRAM_CHANNEL_ID) {
      return NextResponse.json({ error: 'Step 3 Failed: TELEGRAM_CHANNEL_ID missing' }, { status: 500 })
    }

    return NextResponse.json({ error: 'All config OK. Now check Bot Permission in Telegram Channel' }, { status: 500 })

  } catch (e) {
    return NextResponse.json({ error: `Crashed: ${e.message}` }, { status: 500 })
  }
}