import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// WordPress API endpoint for Houzez properties
// Requires admin access: set ZADESHOME_WP_USER and ZADESHOME_WP_APP_PASSWORD in Vercel env vars
const WP_BASE = 'https://www.zadeshome.com/wp-json/wp/v2'

async function wpFetch(endpoint: string) {
  const user = process.env.ZADESHOME_WP_USER
  const pass = process.env.ZADESHOME_WP_APP_PASSWORD
  const headers: Record<string,string> = {
    'User-Agent': 'KWACBot/1.0',
    'Content-Type': 'application/json'
  }
  if (user && pass) {
    headers['Authorization'] = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64')
  }
  const res = await fetch(WP_BASE + endpoint, { headers, next: { revalidate: 0 } })
  if (!res.ok) throw new Error('WP API error: ' + res.status + ' ' + endpoint)
  return res.json()
}

function mapStage(wpStatus: string): string {
  const map: Record<string,string> = {
    'publish': 'listing', 'draft': 'listing', 'pending': 'listing',
    'sold': 'closed', 'rented': 'closed', 'withdrawn': 'withdrawn'
  }
  return map[wpStatus] || 'listing'
}

export async function GET(req: NextRequest) {
  const manual = req.nextUrl.searchParams.get('manual') === '1'
  let synced = 0, newProps = 0, errors: string[] = []

  try {
    // Fetch all published properties — Houzez uses 'property' post type
    let page = 1
    let hasMore = true
    
    while (hasMore) {
      let props: any[]
      try {
        props = await wpFetch('/property?per_page=100&page=' + page + '&status=publish&_fields=id,title,link,status,meta,date,modified,featured_media,acf')
      } catch(e: any) {
        // If /property doesn't work, try houzez-property
        try {
          props = await wpFetch('/houzez-property?per_page=100&page=' + page + '&_fields=id,title,link,status,meta,date,modified,acf')
        } catch {
          errors.push('WP API unreachable — add ZADESHOME_WP_USER and ZADESHOME_WP_APP_PASSWORD in Vercel env vars')
          break
        }
      }

      if (!props || props.length === 0) { hasMore = false; break }

      for (const prop of props) {
        const wpId = String(prop.id)
        const meta = prop.meta || prop.acf || {}
        
        const payload = {
          wp_id: wpId,
          title: prop.title?.rendered || prop.title || 'Ακίνητο ' + wpId,
          wp_url: prop.link,
          address: meta.fave_property_address || meta.property_address || null,
          area: meta.fave_property_city || meta.property_city || null,
          price: parseFloat(meta.fave_property_price || meta.property_price || '0') || null,
          sqm: parseFloat(meta.fave_property_size || meta.property_size || '0') || null,
          property_type: meta.fave_property_type || null,
          deal_type: (meta.fave_property_status || '').includes('rent') ? 'rent' : 'sale',
          synced_at: new Date().toISOString()
        }

        const { data: existing } = await supabase.from('pipeline_properties').select('id,stage').eq('wp_id', wpId).single()
        
        if (!existing) {
          // New property — insert and create listing event
          const { data: inserted } = await supabase.from('pipeline_properties').insert({
            ...payload, stage: 'listing', listed_at: prop.date || new Date().toISOString()
          }).select().single()
          
          if (inserted) {
            await supabase.from('pipeline_events').insert({
              property_id: inserted.id,
              event_type: 'listing',
              title: 'Νέα Ανάθεση',
              description: 'Ακίνητο εισήχθη αυτόματα από zadeshome.com',
              event_date: new Date().toISOString().split('T')[0]
            })
            newProps++
          }
        } else {
          // Update existing (price, title etc)
          await supabase.from('pipeline_properties').update(payload).eq('wp_id', wpId)
        }
        synced++
      }

      if (props.length < 100) { hasMore = false } else { page++ }
    }
  } catch(e: any) {
    errors.push(e.message)
  }

  return NextResponse.json({ success: true, synced, new_properties: newProps, errors, synced_at: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  return GET(req)
}