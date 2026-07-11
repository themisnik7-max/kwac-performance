'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase'

type Role = 'agent' | 'ceo'
interface AppCtx {
  agent: any
  role: Role
  loading: boolean
}
const Ctx = createContext<AppCtx>({ agent: null, role: 'agent', loading: true })

export function AppProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setLoading(false); return }
      supabase.from('agents').select('*').eq('email', data.user.email).single()
        .then(({ data: a }) => {
          setAgent(a)
          setLoading(false)
        })
    })
  }, [])

  // role always reflects the freshly-fetched DB row for whoever is
  // currently authenticated. A previous version cached this per-browser-tab
  // in sessionStorage and only ever set it once — a CEO login followed by a
  // different agent logging in in the same tab kept showing the CEO role,
  // silently unlocking CEO/admin-only UI (GPI, Intelligence OP, Monitor)
  // for a plain agent. Nothing in the app used the override for its
  // intended purpose (a CEO "preview as agent" toggle) either, so it's gone
  // rather than fixed in place.
  const role: Role = (agent?.role === 'ceo' || agent?.role === 'admin') ? 'ceo' : 'agent'

  return <Ctx.Provider value={{ agent, role, loading }}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)