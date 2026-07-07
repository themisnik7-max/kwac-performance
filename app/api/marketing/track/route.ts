import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FALLBACK_URL = 'https://kwac.gr'

// GET ?r=<recipient_id> — public, unauthenticated: this is the link a lead
// clicks from an email or SMS, not something an agent calls. destination_url
// is never taken from the request, only looked up by recipient id, so there's
// no open-redirect surface here regardless of who calls it.
export async function GET(req: NextRequest) {
  const recipientId = req.nextUrl.searchParams.get('r')
  if (!recipientId) return NextResponse.redirect(FALLBACK_URL)

  const { data: recipient } = await sb
    .from('marketing_campaign_recipients')
    .select('id, destination_url, clicked_at, click_count')
    .eq('id', recipientId)
    .single()

  if (!recipient) return NextResponse.redirect(FALLBACK_URL)

  await sb.from('marketing_campaign_recipients').update({
    clicked_at: recipient.clicked_at ?? new Date().toISOString(),
    click_count: recipient.click_count + 1,
  }).eq('id', recipientId)

  return NextResponse.redirect(recipient.destination_url || FALLBACK_URL)
}
