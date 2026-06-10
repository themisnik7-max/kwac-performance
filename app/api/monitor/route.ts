import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// The search URLs to monitor
const MONITOR_URLS = [
  {
    label: 'Πωλήσεις - Υπόλοιπη Ελλάδα',
    url: 'https://www.zadeshome.com/search-results/?status[]=agora-akinitou&states[]=ypoloipi-ellada&location[]=',
    tag: 'sale-rest'
  },
  {
    label: 'Ενοικιάσεις - Αττική',
    url: 'https://www.zadeshome.com/search-results/?status[]=enoikiasi-akinitou&states[]=attiki&location[]=',
    tag: 'rent-attica'
  }
]

async function scrapeListings(monitorUrl: typeof MONITOR_URLS[0]) {
  try {
    const res = await fetch(monitorUrl.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KWACBot/1.0)' },
      next: { revalidate: 0 }
    })
    const html = await res.text()

    // Extract property listings from Houzez WordPress HTML
    const listings: any[] = []
    
    // Match property card links — Houzez uses .listing-item or article.property-listing
    const linkPattern = /href="(https://www.zadeshome.com/(?:property|akinito)/[^"]+)"/g
    const titlePattern = /<h2[^>]*class="[^"]*listing-title[^"]*"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g
    const pricePattern = /class="[^"]*listing-price[^"]*"[^>]*>([^<]+)</g
    const idPattern = /Κωδικός[^:]*:\s*(\d+)/g

    let match
    const urls = new Set<string>()
    
    while ((match = linkPattern.exec(html)) !== null) {
      urls.add(match[1])
    }

    // Extract property IDs from URLs (Houzez adds listing ID in URL)
    for (const url of urls) {
      // Get title from URL slug
      const slug = url.split('/').filter(Boolean).pop() || ''
      const title = slug.replace(/-/g, ' ')
      listings.push({ url, title, tag: monitorUrl.tag, source_label: monitorUrl.label })
    }

    return listings
  } catch(e) {
    console.error('Scrape error:', e)
    return []
  }
}

export async function GET(req: NextRequest) {
  const isManual = req.nextUrl.searchParams.get('manual') === '1'
  
  let totalNew = 0
  const allNew: any[] = []

  for (const monitor of MONITOR_URLS) {
    const listings = await scrapeListings(monitor)
    
    for (const listing of listings) {
      // Check if we've seen this URL before
      const { data: existing } = await supabase
        .from('monitored_listings')
        .select('id')
        .eq('url', listing.url)
        .single()
      
      if (!existing) {
        // New listing! Save it
        await supabase.from('monitored_listings').insert({
          url: listing.url,
          title: listing.title,
          tag: listing.tag,
          source_label: listing.source_label,
          is_new: true,
          seen_at: new Date().toISOString()
        })
        totalNew++
        allNew.push(listing)
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    new_count: totalNew, 
    new_listings: allNew,
    checked_at: new Date().toISOString()
  })
}

// Cron endpoint — called by Vercel cron
export async function POST(req: NextRequest) {
  return GET(req)
}