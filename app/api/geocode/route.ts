import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'

// Thin authenticated wrapper around lib/geocode.ts — kept server-side because
// browsers can't set a custom User-Agent header (Fetch spec forbids it), and
// Nominatim's usage policy asks for a real one to identify the caller.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { address, area } = await req.json()
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const coords = await geocodeAddress(address, area)
  return NextResponse.json({ coords })
}
