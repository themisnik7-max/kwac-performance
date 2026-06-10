'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase'

type Role = 'agent' | 'ceo'
interface AppCtx {
  agent: any
  role: Role
  setDemoRole: (r: Role) => void
  loading: boolean
}
const Ctx = createContext<AppCtx>({ agent: null, role: 'agent', setDemoRole: () => {}, loading: true })

export function AppProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<any>(null)
  const [demoRole, setDemoRoleState] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Restore persisted demo role
    const saved = sessionStorage.getItem('kwac_demo_role') as Role | null
    if (saved) setDemoRoleState(saved)

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setLoading(false); return }
      supabase.from('agents').select('*').eq('email', data.user.email).single()
        .then(({ data: a }) => {
          setAgent(a)
          setLoading(false)
          // Set default demo role from DB if not saved
          if (!saved && a?.role) {
            const r: Role = (a.role === 'ceo' || a.role === 'admin') ? 'ceo' : 'agent'
            setDemoRoleState(r)
            sessionStorage.setItem('kwac_demo_role', r)
          }
        })
    })
  }, [])

  const dbRole: Role = (agent?.role === 'ceo' || agent?.role === 'admin') ? 'ceo' : 'agent'
  const role: Role = demoRole || dbRole

  function setDemoRole(r: Role) {
    setDemoRoleState(r)
    sessionStorage.setItem('kwac_demo_role', r)
  }

  return <Ctx.Provider value={{ agent, role, setDemoRole, loading }}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)