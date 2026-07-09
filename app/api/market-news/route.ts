// app/api/market-news/route.ts
// Server-side RSS aggregator — runs every 30 min via Next.js cache
// No external library needed: simple regex XML parsing

import { NextResponse } from 'next/server'

const FEEDS = [
  { name: 'Real Estate Magazine', url: 'https://www.realestatemagazine.gr/feed/' },
  { name: 'Property Club',        url: 'https://www.propertyclub.gr/feed/' },
  { name: 'Geoaxis News',         url: 'https://www.geoaxis.gr/feed/' },
  { name: 'Spitogatos News',      url: 'https://www.spitogatos.gr/news/feed/' },
]

function extractText(xml: string, tag: string): string {
  return (
    xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1] ||
    xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`))?.[1] ||
    ''
  ).trim()
}

function extractLink(xml: string): string {
  // Try <link> (not self-closing), then <guid isPermaLink="true">, then any guid with http
  return (
    xml.match(/<link>([^<]+)<\/link>/)?.[1] ||
    xml.match(/<guid[^>]*isPermaLink="true"[^>]*>([^<]+)<\/guid>/)?.[1] ||
    xml.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/)?.[1] ||
    ''
  ).trim()
}

export async function GET() {
  const settled = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        next: { revalidate: 1800 }, // 30-min server cache
        headers: { 'User-Agent': 'KWAC-OS-NewsBot/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const xml = await res.text()

      const rawItems = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 6)
      return rawItems.map((m) => ({
        title:   extractText(m[1], 'title'),
        link:    extractLink(m[1]),
        pubDate: extractText(m[1], 'pubDate'),
        source:  feed.name,
      }))
    })
  )

  const articles = settled
    .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((a) => a.title && a.link)
    .sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0
      return db - da
    })
    .slice(0, 18)

  return NextResponse.json({ articles }, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' }
  })
}
