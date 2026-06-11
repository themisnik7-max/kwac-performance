import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  if (!process.env.ZADESHOME_WP_USER || !process.env.ZADESHOME_WP_APP_PASSWORD) {
    return NextResponse.json({
      success: false,
      synced: 0,
      new_properties: 0,
      errors: ['Χρειάζεται ZADESHOME_WP_USER και ZADESHOME_WP_APP_PASSWORD στο Vercel → Environment Variables'],
      synced_at: new Date().toISOString()
    })
  }

  const user = process.env.ZADESHOME_WP_USER
  const pass = process.env.ZADESHOME_WP_APP_PASSWORD
  const creds = Buffer.from(user + ':' + pass).toString('base64')

  let synced = 0, newProps = 0
  const errors: string[] = []

  try {
    const res = await fetch('https://www.zadeshome.com/wp-json/wp/v2/property?per_page=50&status=publish&_fields=id,title,link,date,meta,acf', {
      headers: {
        'Authorization': 'Basic ' + creds,
        'User-Agent': 'KWACBot/1.0'
      }
    })

    if (!res.ok) throw new Error('WordPress API: ' + res.status + ' - Έλεγξε credentials')

    const props = await res.json() as any[]

    for (const prop of props) {
      const wpId = String(prop.id)
      const meta = prop.meta || prop.acf || {}
      const title = typeof prop.title === 'object' ? (prop.title.rendered || 'Ακίνητο') : (prop.title || 'Ακίνητο')

      const payload = {
        wp_id: wpId,
        title: title.replace(/<[^>]*>/g, ''),
        wp_url: prop.link || null,
        address: meta.fave_property_address || null,
        area: meta.fave_property_city || null,
        price: parseFloat(meta.fave_property_price || '0') || null,
        sqm: parseFloat(meta.fave_property_size || '0') || null,
        property_type: meta.fave_property_type || null,
        deal_type: String(meta.fave_property_status || '').includes('rent') ? 'rent' : 'sale',
        synced_at: new Date().toISOString()
      }

      const { data: existing } = await supabase.from('pipeline_properties').select('id').eq('wp_id', wpId).single()

      if (!existing) {
        const { data: inserted } = await supabase.from('pipeline_properties').insert({
          ...payload,
          stage: 'listing',
          listed_at: prop.date || new Date().toISOString()
        }).select().single()

        if (inserted) {
          await supabase.from('pipeline_events').insert({
            property_id: inserted.id,
            event_type: 'listing',
            title: 'Νέα Ανάθεση',
            description: 'Συγχρονίστηκε από zadeshome.com',
            event_date: new Date().toISOString().split('T')[0]
          })
          newProps++
        }
      } else {
        await supabase.from('pipeline_properties').update(payload).eq('wp_id', wpId)
      }
      synced++
    }
  } catch (e: any) {
    errors.push(e.message || 'Άγνωστο σφάλμα')
  }

  return NextResponse.json({ success: true, synced, new_properties: newProps, errors, synced_at: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  return GET(req)
}