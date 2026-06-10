import { NextRequest, NextResponse } from 'next/server'

const CONTEXT = `Είσαι AI αναλυτής για το μεσιτικό γραφείο KWAC (KW Greece Athens).
Real data portfolio (213 ενεργά ακίνητα, export i-list Ιούνιος 2026):
- Σύνολο αξίας: 68.7M ευρώ | Πωλήσεις: 164 (avg 418.895€, median 220.000€) | Ενοικιάσεις: 49 (avg 6.612€/μήνα)
- Agents: Xenofon Zades 161 ακίνητα (75.6%, portfolio 42.7M€), Katerina Karpouzopoulou 25 (19M€), Themis Nikolaou 15 (4.8M€), Alexandra Georgaki 12 (2M€)
- Top περιοχές: Εξάρχεια-Νεάπολη 12, Καλλιθέα 10, Κυψέλη 9, Κέντρο 8, Νέα Σμύρνη 7, Νέος Κόσμος 7, Παγκράτι 7
- Premium €/τμ: Γλυφάδα 5.613, Κέντρο 4.648, Ιστορικό Κέντρο 4.383, Κηφισιά 2.432, Εξάρχεια 2.549
- Property mix: 59% διαμερίσματα, 9.4% καταστήματα, 8% μονοκατοικίες, 6.1% οικόπεδα, 5.6% γραφεία, 4.7% μεζονέτες
- Key risk: 75.6% εξάρτηση από τον Xenofon Zades
- Commission model: 4% αμοιβή γραφείου, 70% split στον agent
- Potential gross commission αν κλείσουν όλα: 2.75M€

Αναλύεις και απαντάς ΜΟΝΟ βάσει αυτών των δεδομένων. Στα ελληνικά, με αριθμούς, σύντομα και actionable.`

export async function POST(req: NextRequest) {
  const { message } = await req.json()
  
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
      system: CONTEXT,
      messages: [{ role: 'user', content: message }]
    })
  })

  const data = await res.json()
  const reply = data.content?.[0]?.text || 'Σφάλμα επικοινωνίας με AI'
  return NextResponse.json({ reply })
}