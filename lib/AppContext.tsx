'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase'

type Role = 'agent' | 'ceo' | 'admin'

interface AppCtx {
  agent: any
  role: Role
  demoRole: Role | null
  setDemoRole: (r: Role) => void
  loading: boolean
}

const Ctx = createContext<AppCtx>({ agent: null, role: 'agent', demoRole: null, setDemoRole: () => {}, loading: true })

export function AppProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<any>(null)
  const [demoRole, setDemoRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setLoading(false); return }
      supabase.from('agents').select('*').eq('email', data.user.email).single()
        .then(({ data: a }) => { setAgent(a); setLoading(false) })
    })
  }, [])

  const dbRole: Role = agent?.role === 'ceo' || agent?.role === 'admin' ? agent.role : 'agent'
  const role: Role = demoRole || dbRole

  return <Ctx.Provider value={{ agent, role, demoRole, setDemoRole, loading }}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)