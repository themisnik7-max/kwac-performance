import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(req) {
  const body = await req.json()
  const { agent_id, week_number, year, data } = body

  // XP calculation
  const XP_MAP = {cold_calls:1,follow_up:1,leads_cold:3,leads_cultivation:3,leads_mail:3,leads_social:3,leads_database:3,meet1_seller_live:15,meet1_seller_phone:10,meet2_seller:25,meet1_buyer_live:15,meet1_buyer_phone:10,meet1_tenant_live:10,meet1_tenant_phone:7,excl_listing_sale:80,simple_listing_sale:40,excl_rental_high:60,excl_rental_low:40,simple_rental:20,contract_seller:150,contract_buyer:150,collab_internal:30,collab_external:30,offer_buyer:10,offer_tenant:10,photo_professional:5,open_house:20,matterport:15,new_partner:25,referral_sent:10,referral_received:10,training_meeting:5,admin_1on1:5}
  const xp = Object.keys(XP_MAP).reduce((s,k) => s + (data[k]||0)*XP_MAP[k], 0)

  // Deadline check: editable until Sunday 23:59
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun
  const isEditable = dayOfWeek !== 1 || now.getHours() < 2 // Monday after 2am = locked

  // Upsert (insert or update if exists)
  const { data: result, error } = await supabase
    .from('weekly_submissions')
    .upsert({
      agent_id,
      week_number,
      year,
      ...data,
      xp_earned: xp,
      is_editable: isEditable,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'agent_id,week_number,year',
      ignoreDuplicates: false
    })
    .select()

  if(error) return NextResponse.json({error: error.message}, {status:400})
  return NextResponse.json({success: true, xp, data: result})
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const agent_id = searchParams.get('agent_id')
  const week = searchParams.get('week')
  const year = searchParams.get('year')

  const { data, error } = await supabase
    .from('weekly_submissions')
    .select('*')
    .eq('agent_id', agent_id)
    .eq('week_number', week)
    .eq('year', year)
    .single()

  if(error) return NextResponse.json({data: null})
  return NextResponse.json({data})
}