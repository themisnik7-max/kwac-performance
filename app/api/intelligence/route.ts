import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent } from '@/lib/auth'
import { getIntelligenceData } from '@/lib/intelligenceData'

export async function GET(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const data = await getIntelligenceData(caller.agency_id)
  return NextResponse.json(data)
}
