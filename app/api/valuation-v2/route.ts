import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export async function POST(req: NextRequest) {
  const { area, sqm, floor, year_built, year_renovated, condition } = await req.json()
  const { data: lastDeal } = await supabase.from('properties').select('*, agents(full_name)')
    .eq('area', area).eq('status', 'sold').order('sold_at', { ascending: false }).limit(1).single()
  const { data: comparables } = await supabase.from('properties')
    .select('price_final, sqm, floor, year_built, condition, sold_at')
    .eq('area', area).eq('status', 'sold').order('sold_at', { ascending: false }).limit(10)
  const { data: topProducers } = await supabase.from('agents').select('id, full_name')
    .eq('area', area).limit(3)
  if (!comparables || comparables.length === 0) {
    return NextResponse.json({ min: 0, max: 0, reasoning: 'Δεν υπάρχουν συγκρίσιμες πράξεις ακόμα στην περιοχή.', last_deal: null, top_producers: [], comparables_count: 0 })
  }
  const avgPricePerSqm = comparables.reduce((s, c) => s + (c.price_final / c.sqm), 0) / comparables.length
  const min = Math.round(avgPricePerSqm * sqm * 0.9)
  const max = Math.round(avgPricePerSqm * sqm * 1.1)
  return NextResponse.json({ min, max, price_per_sqm_min: Math.round(avgPricePerSqm * 0.9), price_per_sqm_max: Math.round(avgPricePerSqm * 1.1), confidence: comparables.length >= 5 ? 'υψηλή' : 'μέτρια', reasoning: 'Βάσει ' + comparables.length + ' συγκρίσιμων πράξεων στην περιοχή ' + area + '.', comparables_count: comparables.length, last_deal: lastDeal, top_producers: topProducers || [] })
}