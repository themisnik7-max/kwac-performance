import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WP_BASE = 'https://www.zadeshome.com/wp-json/wp/v2'

async function wpFetch(endpoint: string) {
  const user = process.env.ZADESHOME_WP_USER
  const pass = process.env.ZADESHOME_WP_APP_PASSWORD
  const headers: Record<string,string> = {
    'User-Agent': 'KWACBot/1.0',
    'Accept': 'application/json'
  }
  if (user && pass) {
    const creds = user + ':' + pass
    const encoded = typeof window !== 'undefined'
      ? window.btoa(creds)
      : Buffer.from(creds).toString('base64')
    headers['Authorization'] = 'Basic ' + encoded
  }
  const res = await fetch(WP_BASE + endpoint, { headers, cache: 'no-store' })
  if (!res.ok) throw new Error('WP API ' + res.status)
  return res.json()
}

export async function GET(req: NextRequest) {
  let synced = 0
  let newProps = 0
  const errors: string[] = []

  if (!process.env.ZADESHOME_WP_USER || !process.env.ZADESHOME_WP_APP_PASSWORD) {
    return NextResponse.json({
      success: false,
      errors: ['Χρειάζεται ZADESHOME_WP_USER και ZADESHOME_WP_APP_PASSWORD στο Vercel'],
      synced: 0,
      new_properties: 0,
      synced_at: new Date().toISOString()
    })
  }

  try {
    const props = await wpFetch('/property?per_page=50&status=publish&_fields=id,title,link,date,meta,acf')

    for (const prop of (props as any[])) {
      const wpId = String(prop.id)
      const meta = prop.meta || prop.acf || {}

      const payload = {
        wp_id: wpId,
        title: typeof prop.title === 'object' ? prop.title.rendered : (prop.title || 'Ακίνητο ' + wpId),
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
          ...payload, stage: 'listing', listed_at: prop.date || new Date().toISOString()
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
  } catch(e: any) {
    errors.push(e.message || 'Unknown error')
  }

  return NextResponse.json({ success: true, synced, new_properties: newProps, errors, synced_at: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  return GET(req)
}