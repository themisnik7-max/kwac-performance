'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Shell from '@/components/Shell'
import { useApp } from '@/lib/AppContext'

const SECTIONS = [
  { key: 'lead_gen', label: 'Lead Generation', color: '#378ADD', fields: [
    { key: 'cold_calls', label: 'Cold Calls' },
    { key: 'social_media_leads', label: 'Social Media Leads' },
    { key: 'mail_leads', label: 'Mail Leads' },
  ]},
  { key: 'followup', label: 'Follow Up', color: '#BA7517', fields: [
    { key: 'follow_up_calls', label: 'Follow Up Calls' },
  ]},
  { key: 'appointments', label: 'Ραντεβού', color: '#534AB7', fields: [
    { key: 'first_appointments', label: '1ο Ραντεβού' },
    { key: 'second_appointments', label: '2ο Ραντεβού' },
    { key: 'buyer_appointments', label: 'Με Αγοραστή' },
    { key: 'tenant_appointments', label: 'Με Μισθωτή' },
  ]},
  { key: 'listings', label: 'Αναθέσεις', color: '#0F6E56', fields: [
    { key: 'exclusive_listings', label: 'Αποκλειστικές' },
    { key: 'simple_listings', label: 'Απλές' },
    { key: 'listings_taken', label: 'Σύνολο' },
  ]},
  { key: 'contracts', label: 'Συμβόλαια', color: '#3B6D11', fields: [
    { key: 'contracts_signed', label: 'Συμβόλαια' },
    { key: 'presales', label: 'Προσύμφωνα' },
    { key: 'rentals_signed', label: 'Ενοικιάσεις' },
  ]},
  { key: 'marketing', label: 'Marketing', color: '#CC2229', fields: [
    { key: 'photos_taken', label: 'Φωτογραφίσεις' },
    { key: 'open_houses', label: 'Open Houses' },
    { key: 'matterport', label: 'Matterport' },
  ]},
  { key: 'networking', label: 'Networking', color: '#993556', fields: [
    { key: 'new_partners', label: 'Νέοι Συνεργάτες' },
    { key: 'referrals', label: 'Συστάσεις' },
  ]},
  { key: 'training', label: 'Training & Admin', color: '#888', fields: [
    { key: 'meetings', label: 'Meetings' },
    { key: 'training_hours', label: 'Εκπαίδευση (ώρες)' },
    { key: 'conferences', label: 'Συνέδρια' },
  ]},
]

function getWeekStart() {
  const d = new Date(); const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0,0,0,0)
  return d.toISOString().split('T')[0]
}

export default function SubmitPage() {
  const { agent } = useApp()
  const [values, setValues] = useState<Record<string,number>>({})
  const [saved, setSaved] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [activeSection, setActiveSection] = useState('lead_gen')
  const supabase = createClient()
  const weekStart = getWeekStart()

  useEffect(() => {
    if (agent) loadExisting(agent.id)
  }, [agent])

  async function loadExisting(agentId: string) {
    const { data } = await supabase.from('weekly_submissions')
      .select('*').eq('agent_id', agentId).eq('week_start', weekStart).single()
    if (data) {
      const v: Record<string,number> = {}
      SECTIONS.forEach(s => s.fields.forEach(f => { v[f.key] = data[f.key] || 0 }))
      setValues(v); setSaved(data.updated_at)
    }
  }

  function update(key: string, delta: number) {
    setValues(prev => ({ ...prev, [key]: Math.max(0, (prev[key]||0) + delta) }))
  }

  async function save() {
    if (!agent) return
    setSaving(true)
    const payload = { agent_id: agent.id, week_start: weekStart, ...values, updated_at: new Date().toISOString() }
    await supabase.from('weekly_submissions').upsert(payload, { onConflict: 'agent_id,week_start' })
    setSaved(new Date().toISOString()); setToast('✅ Αποθηκεύτηκε!')
    setSaving(false); setTimeout(() => setToast(''), 2500)
  }

  const totalXP = Object.values(values).reduce((s,v) => s+v, 0) * 10
  const activeS = SECTIONS.find(s => s.key === activeSection)!

  return (
    <Shell>
      <div style={{ padding: '2rem', maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', margin: 0 }}>Μετρησιμότητα</h1>
            <p style={{ color: '#888', fontSize: 14, margin: '4px 0 0' }}>
              Εβδομάδα {weekStart}
              {saved && <span style={{ color: '#3B6D11' }}> · Αποθηκεύτηκε {new Date(saved).toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})}</span>}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#FAEEDA', color: '#854F0B', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 500 }}>{totalXP} XP</div>
            <button onClick={save} disabled={saving}
              style={{ padding: '8px 20px', background: '#CC2229', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </div>

        {toast && <div style={{ background: '#EAF3DE', color: '#3B6D11', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{toast}</div>}

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 160, flexShrink: 0 }}>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                  background: activeSection===s.key ? s.color : 'transparent',
                  color: activeSection===s.key ? '#fff' : '#666',
                  border: 'none', fontWeight: activeSection===s.key ? 500 : 400 }}>
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, background: '#fff', border: '0.5px solid #e8e8e8', borderRadius: 12, padding: '1.5rem' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: activeS.color, marginBottom: '1rem' }}>{activeS.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeS.fields.map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #f5f5f5' }}>
                  <span style={{ fontSize: 14, color: '#1a1a1a' }}>{f.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => update(f.key,-1)} style={{ width:32,height:32,borderRadius:8,border:'0.5px solid #ddd',background:'#f5f5f5',fontSize:16,cursor:'pointer' }}>-</button>
                    <span style={{ fontSize: 20, fontWeight: 500, minWidth: 40, textAlign: 'center' }}>{values[f.key]||0}</span>
                    <button onClick={() => update(f.key,1)} style={{ width:32,height:32,borderRadius:8,border:'0.5px solid #CC2229',background:'#fff5f5',color:'#CC2229',fontSize:16,cursor:'pointer' }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}