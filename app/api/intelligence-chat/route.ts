import { NextRequest, NextResponse } from 'next/server'
import { getAuthedAgent } from '@/lib/auth'
import { getIntelligenceData } from '@/lib/intelligenceData'

// Was hardcoding one real agency's actual numbers (agent names, revenue,
// concentration risk) directly into source, reachable with no auth at all.
// Now builds the system prompt from a live, agency-scoped query each call.
export async function POST(req: NextRequest) {
  const caller = await getAuthedAgent(req)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { message } = await req.json()
  const d = await getIntelligenceData(caller.agency_id)

  const context = `Είσαι AI αναλυτής για ένα μεσιτικό γραφείο.
Τρέχον portfolio: ${d.totals.totalCount} ακίνητα (${d.totals.salesCount} πωλήσεις, ${d.totals.rentalCount} ενοικιάσεις). Συνολική αξία πωλήσεων €${d.totals.portfolioValue.toLocaleString('el-GR')}, μέση τιμή πώλησης €${d.totals.avgSale.toLocaleString('el-GR')}, μέση ενοικίαση €${d.totals.avgRental.toLocaleString('el-GR')}/μήνα.
Agents: ${d.agents.map(a => `${a.name} (${a.total} ακίνητα, ${a.pct}% του χαρτοφυλακίου)`).join(', ') || 'δεν υπάρχουν καταχωρημένα ακίνητα ακόμα'}.
Περιοχές: ${d.areas.map(a => `${a.area} (${a.count})`).join(', ') || '—'}.
Τύποι ακινήτων: ${d.types.map(t => `${t.type} ${t.pct}%`).join(', ') || '—'}.
Αναλύεις και απαντάς ΜΟΝΟ βάσει αυτών των δεδομένων — μην επικαλεστείς νούμερα που δεν βλέπεις εδώ. Στα ελληνικά, με αριθμούς, σύντομα και actionable.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: context,
      messages: [{ role: 'user', content: message }]
    })
  })

  const data = await res.json()
  const reply = data.content?.[0]?.text || 'Σφάλμα επικοινωνίας με AI'
  return NextResponse.json({ reply })
}
