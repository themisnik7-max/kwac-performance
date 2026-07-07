import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedAgent } from '@/lib/auth'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET ?campaign_id=... — reports only what's mechanically tracked (sent,
// clicked via the redirect in /api/marketing/track). No "opened" and no
// invented "conversion" figure — see skills/listing-marketing-kit/SKILL.md.
export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  if (!campaignId) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

  const { data: campaign } = await sb.from('marketing_campaigns')
    .select('id, channel, subject, content, status, sent_at, property_ids')
    .eq('id', campaignId).eq('agency_id', caller.agency_id).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data: recipients } = await sb.from('marketing_campaign_recipients')
    .select('sent_at, clicked_at, click_count').eq('campaign_id', campaignId)

  const total = recipients?.length ?? 0
  const sent = (recipients || []).filter(r => r.sent_at).length
  const clicked = (recipients || []).filter(r => r.clicked_at).length
  const totalClicks = (recipients || []).reduce((s, r) => s + (r.click_count || 0), 0)

  return NextResponse.json({
    ok: true,
    campaign: { id: campaign.id, channel: campaign.channel, subject: campaign.subject, status: campaign.status, sent_at: campaign.sent_at },
    total_recipients: total,
    sent,
    clicked,
    total_clicks: totalClicks,
    click_through_rate: sent > 0 ? Math.round((clicked / sent) * 1000) / 10 : 0,
  })
}
