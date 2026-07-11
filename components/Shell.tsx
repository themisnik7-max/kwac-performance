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

  // agent.is_active === false means either pending admin approval
  // (register/route.ts, agencies.require_approval) or a deactivated
  // account. getAuthedAgent (lib/auth.ts) already rejects these on every
  // API route regardless of this check — this is UX only, so a pending
  // agent sees an explanation instead of a shell full of silent 401s.
  const pendingApproval = !loading && agent && agent.is_active === false

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f7' }}>
      {loading ? (
        <div style={{ padding: '2rem', color: '#888', fontSize: 14 }}>Φόρτωση...</div>
      ) : pendingApproval ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 16, color: '#1a1a1a', fontWeight: 500, marginBottom: 6 }}>Ο λογαριασμός σου εκκρεμεί έγκριση</div>
          <div style={{ fontSize: 14, color: '#888' }}>Ένας διαχειριστής πρέπει να εγκρίνει την εγγραφή σου πριν αποκτήσεις πρόσβαση.</div>
        </div>
      ) : children}
    </div>
  )
}
