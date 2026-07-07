'use client'
// app/login/page.tsx — Login + Self-Registration (corporate email only)
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tab = 'login' | 'register'

export default function LoginPage() {
  const [tab, setTab]           = useState<Tab>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone]       = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [loading, setLoading]   = useState(false)

  // ── Login ─────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Λάθος email ή κωδικός.'); setLoading(false); return }
    window.location.href = '/dashboard'
  }

  // ── Register ──────────────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (password !== confirm) { setError('Οι κωδικοί δεν ταιριάζουν.'); return }
    if (password.length < 8)  { setError('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.'); return }
    setLoading(true)

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, phone }),
    })
    const data = await res.json()
    setLoading(false)

    if (!data.ok) { setError(data.error || 'Σφάλμα εγγραφής.'); return }
    setSuccess(data.message)
    // Auto-switch to login after 2s
    setTimeout(() => { setTab('login'); setSuccess('') }, 2500)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 8,
    border: '1px solid #E0E0E0', fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F5' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 380, boxShadow: '0 2px 20px rgba(0,0,0,0.08)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>KW<span style={{ color: '#CC2229' }}>AC</span></div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>Performance OS</div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: '#F5F5F5', borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {(['login', 'register'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#1a1a1a' : '#888',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all .15s',
              }}>
              {t === 'login' ? 'Σύνδεση' : 'Εγγραφή'}
            </button>
          ))}
        </div>

        {/* Login form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value.trim())} required
                style={inputStyle} placeholder="name@kwgreece.gr" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Κωδικός</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={inputStyle} placeholder="••••••••" />
            </div>
            {error && <div style={{ color: '#CC2229', fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', background: '#CC2229', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Σύνδεση...' : 'Σύνδεση →'}
            </button>
          </form>
        )}

        {/* Register form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Ονοματεπώνυμο *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
                style={inputStyle} placeholder="Γιάννης Παπαδόπουλος" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Εταιρικό Email *
                <span style={{ color: '#888', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>μόνο @kwgreece.gr</span>
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value.trim())} required
                style={inputStyle} placeholder="name@kwgreece.gr" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Τηλέφωνο</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                style={inputStyle} placeholder="+30 69..." />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Κωδικός * <span style={{ color: '#888', fontWeight: 400, fontSize: 11 }}>(min 8 χαρακτήρες)</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                style={inputStyle} placeholder="••••••••" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 6 }}>Επιβεβαίωση κωδικού *</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                style={inputStyle} placeholder="••••••••" />
            </div>

            {error   && <div style={{ color: '#CC2229', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: '#FFF5F5', borderRadius: 8 }}>{error}</div>}
            {success && <div style={{ color: '#3B6D11', fontSize: 13, marginBottom: 14, padding: '8px 12px', background: '#EAF3DE', borderRadius: 8 }}>{success}</div>}

            <button type="submit" disabled={loading}
              style={{ width: '100%', background: '#CC2229', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Δημιουργία...' : 'Δημιουργία Λογαριασμού →'}
            </button>

            <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              Μόνο εταιρικά emails επιτρέπονται.<br />
              Επικοινώνησε με τον διαχειριστή αν δεν μπορείς να εγγραφείς.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
