'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { authedFetch } from '@/lib/authedFetch'

const SKIP_ROUTES = new Set(['/login', '/locked'])

export default function PageTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (SKIP_ROUTES.has(pathname)) return
    authedFetch('/api/log-pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: pathname }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])
  return null
}