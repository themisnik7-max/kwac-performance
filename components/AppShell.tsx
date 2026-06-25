'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from './Sidebar'
import PageTracker from './PageTracker'

const PUBLIC_ROUTES = ['/login']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const isPublic = PUBLIC_ROUTES.includes(path)

  useEffect(() => {
    if (isPublic) { setAuthChecked(true); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
      else setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [isPublic, router])

  if (!authChecked) return <div style={{ flex: 1, minHeight: '100vh', background: '#0d0d0d' }} />

  return (
    <>
      {!isPublic && <Sidebar />}
      {!isPublic && <PageTracker />}
      <main style={{ flex: 1, marginLeft: isPublic ? 0 : 220, minHeight: '100vh', background: '#0d0d0d' }}>
        {children}
      </main>
    </>
  )
}