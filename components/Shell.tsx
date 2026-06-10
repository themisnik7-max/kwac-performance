'use client'
import { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import { useApp } from '@/lib/AppContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Shell({ children, requireAuth = true }: { children: ReactNode; requireAuth?: boolean }) {
  const { loading, agent } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!loading && requireAuth && !agent) {
      // Check if there's a supabase session
      const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
      if (!key) router.push('/login')
    }
  }, [loading, agent])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f8f7' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', color: '#888', fontSize: 14 }}>Φόρτωση...</div>
        ) : children}
      </main>
    </div>
  )
}