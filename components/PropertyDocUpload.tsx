'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Doc = {
  id: string
  category: string
  label: string
  original_name: string
  size_bytes: number
  notes: string | null
  url: string
  created_at: string
}

const CATEGORIES = [
  { value: 'title_deed',   label: 'Τίτλος Ιδιοκτησίας' },
  { value: 'floor_plan',   label: 'Κατόψεις'           },
  { value: 'constitution', label: 'Σύσταση'             },
  { value: 'regulations',  label: 'Κανονισμός Πολ/κίας' },
  { value: 'topographic',  label: 'Τοπογραφικό'        },
  { value: 'assignment',   label: 'Εντολή Ανάθεσης'    },
  { value: 'viewing',      label: 'Έντυπο Υπόδειξης'   },
  { value: 'offer',        label: 'Έντυπο Προσφοράς'   },
  { value: 'deposit',      label: 'Προκαταβολή'         },
  { value: 'contract',     label: 'Συμβόλαιο'           },
  { value: 'other',        label: 'Άλλο'               },
]

const CAT_ICONS: Record<string, string> = {
  title_deed: '📜', floor_plan: '🗺', constitution: '📑', regulations: '📋',
  topographic: '🗾', assignment: '✍️', viewing: '👁', offer: '💼',
  deposit: '💰', contract: '🤝', other: '📄',
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b/1024).toFixed(0)}KB`
  return `${(b/1048576).toFixed(1)}MB`
}

interface Props { propertyId: string }

export function PropertyDocUpload({ propertyId }: Props) {
  const [docs,         setDocs]         = useState<Doc[]>([])
  const [loading,      setLoading]      = useState(true)
  const [category,     setCategory]     = useState('title_deed')
  const [uploading,    setUploading]    = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ name: string; state: 'uploading'|'done'|'error'; error?: string }[]>([])
  const [deleting,     setDeleting]     = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const res  = await fetch(`/api/property-docs?property_id=${propertyId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const data = await res.json()
    setDocs(data.docs ?? [])
    setLoading(false)
  }, [propertyId])

  useEffect(() => { load() }, [load])

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const arr = Array.from(files)
    setUploading(true)
    setUploadStatus(arr.map(f => ({ name: f.name, state: 'uploading' as const })))

    const form = new FormData()
    form.append('property_id', propertyId)
    form.append('category', category)
    arr.forEach(f => form.append('docs', f))

    try {
      const res  = await fetch('/api/property-docs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body:    form,
      })
      const data = await res.json()

      setUploadStatus(arr.map(f => {
        const ok  = data.uploaded?.find((u: { name: string }) => u.name === f.name)
        const err = data.errors?.find((e: string) => e.startsWith(f.name))
        return { name: f.name, state: ok ? 'done' as const : 'error' as const, error: err?.split(': ')[1] }
      }))

      if (data.uploaded?.length) await load()
    } catch {
      setUploadStatus(arr.map(f => ({ name: f.name, state: 'error' as const, error: 'Σφάλμα δικτύου' })))
    }

    setUploading(false)
    setTimeout(() => setUploadStatus([]), 4000)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDoc(docId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setDeleting(docId)
    await fetch(`/api/property-docs?id=${docId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setDocs(prev => prev.filter(d => d.id !== docId))
    setDeleting(null)
  }

  // Group by category
  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: docs.filter(d => d.category === cat.value),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #1e1e1e', paddingTop: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
        Φάκελος Ακινήτου
      </p>

      {/* Upload row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ flex: '1 1 160px', padding: '8px 10px', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6, color: '#e0e0e0', fontSize: 13 }}
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: '#1a1a1a', border: '1px dashed #2a2a2a', borderRadius: 6,
          cursor: 'pointer', fontSize: 13, color: '#888', userSelect: 'none', WebkitUserSelect: 'none',
          opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? 'none' : 'auto',
        }}>
          <span>📎</span>
          <span>{uploading ? 'Ανέβασμα…' : 'Επιλογή αρχείων'}</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files)}
          />
        </label>
      </div>

      {/* Upload status */}
      {uploadStatus.length > 0 && (
        <div style={{ marginBottom: 10, padding: '8px 10px', background: '#111', borderRadius: 6, border: '1px solid #1e1e1e' }}>
          {uploadStatus.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', fontSize: 12 }}>
              <span>{s.state === 'uploading' ? '⏳' : s.state === 'done' ? '✅' : '❌'}</span>
              <span style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.name}</span>
              {s.error && <span style={{ color: '#f87171', fontSize: 11 }}>{s.error}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Document list grouped by category */}
      {loading && <p style={{ fontSize: 12, color: '#444' }}>Φόρτωση…</p>}

      {!loading && grouped.length === 0 && (
        <p style={{ fontSize: 12, color: '#333', margin: 0 }}>Κανένα έγγραφο ακόμα.</p>
      )}

      {grouped.map(g => (
        <div key={g.value} style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: '#555', margin: '0 0 4px', fontWeight: 600 }}>
            {CAT_ICONS[g.value]} {g.label}
          </p>
          {g.items.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#111', borderRadius: 5, marginBottom: 4 }}>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, fontSize: 12, color: '#94a3b8', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {doc.original_name ?? 'αρχείο'}
              </a>
              <span style={{ fontSize: 10, color: '#444', flexShrink: 0 }}>{fmtBytes(doc.size_bytes)}</span>
              <button
                onClick={() => deleteDoc(doc.id)}
                disabled={deleting === doc.id}
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                title="Διαγραφή"
              >
                {deleting === doc.id ? '…' : '×'}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
