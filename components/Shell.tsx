'use client'
import { ReactNode, useEffect } from 'react'
import { useApp } from '@/lib/AppContext'
import { useRouter } from 'next/navigation'

// No Sidebar here on purpose — app/layout.tsx already renders one globally
// for every page. Rendering a second one here used to double it up on every
// page that uses Shell (meeting, sprint, board, gps, etc).
export default function Shell({ children, requireAuth = true }: { children: ReactNode; requireAuth?: boolean }) {
  const { loading, agent } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!loading && requireAuth && !agent) {
      const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
      if (!key) router.push('/login')
    }
  }, [loading, agent])

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f7' }}>
      {loading ? (
        <div style={{ padding: '2rem', color: '#888', fontSize: 14 }}>Φόρτωση...</div>
      ) : children}
    </div>
  )
}
