'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

interface Photo { id: string; url: string; original_name: string; size_bytes: number; created_at: string }
interface Props  { propertyId: string; initialPhotos?: Photo[] }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function FileStatus({ name, state, error }: { name: string; state: 'uploading' | 'done' | 'error'; error?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
      <span style={{ fontSize: 16 }}>
        {state === 'uploading' ? '⏳' : state === 'done' ? '✅' : '❌'}
      </span>
      <span style={{ color: state === 'error' ? '#f87171' : '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      {error && <span style={{ color: '#f87171', fontSize: 11 }}>{error}</span>}
    </div>
  )
}

export function PropertyPhotoUpload({ propertyId, initialPhotos = [] }: Props) {
  const [photos,     setPhotos]    = useState<Photo[]>(initialPhotos)
  const [statuses,   setStatuses]  = useState<{ name: string; state: 'uploading' | 'done' | 'error'; error?: string }[]>([])
  const [deleting,   setDeleting]  = useState<string | null>(null)
  const [lightbox,   setLightbox]  = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const arr = Array.from(files)

    // Show uploading status for all files immediately
    setStatuses(arr.map(f => ({ name: f.name, state: 'uploading' as const })))

    // Upload in batches of 3 (mobile-friendly, avoids memory pressure from many large photos)
    for (let i = 0; i < arr.length; i += 3) {
      const batch = arr.slice(i, i + 3)
      const form  = new FormData()
      form.append('property_id', propertyId)
      batch.forEach(f => form.append('photos', f))

      try {
        const res  = await fetch('/api/property-photos', {
          method:  'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body:    form,
        })
        const data = await res.json()

        // Update status per file
        setStatuses(prev => {
          const next = [...prev]
          batch.forEach((f, bi) => {
            const idx   = i + bi
            const match = data.uploaded?.find((u: { name: string }) => u.name === f.name)
            const err   = data.errors?.find((e: string) => e.startsWith(f.name))
            next[idx] = { name: f.name, state: match ? 'done' : 'error', error: err?.split(': ')[1] }
          })
          return next
        })

        if (data.uploaded?.length) {
          // Refresh photo list
          const r2 = await fetch(`/api/property-photos?property_id=${propertyId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          const d2 = await r2.json()
          setPhotos(d2.photos ?? [])
        }
      } catch (err) {
        setStatuses(prev => {
          const next = [...prev]
          batch.forEach((_, bi) => { next[i + bi] = { ...next[i + bi], state: 'error', error: 'Σφάλμα δικτύου' } })
          return next
        })
      }
    }

    // Clear status after 4s
    setTimeout(() => setStatuses([]), 4000)
    if (fileRef.current) fileRef.current.value = ''
  }, [propertyId])

  async function deletePhoto(photoId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setDeleting(photoId)
    await fetch(`/api/property-photos?id=${photoId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setPhotos(prev => prev.filter(p => p.id !== photoId))
    setDeleting(null)
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Upload button — large touch target for mobile */}
      <label
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            8,
          padding:        '12px 0',
          background:     '#1a1a1a',
          border:         '1.5px dashed #2a2a2a',
          borderRadius:   8,
          cursor:         'pointer',
          fontSize:       13,
          color:          '#666',
          userSelect:     'none',
          WebkitUserSelect: 'none',
        }}
      >
        <span style={{ fontSize: 20 }}>📷</span>
        <span>Προσθήκη φωτογραφιών</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => upload(e.target.files)}
          capture={undefined}
        />
      </label>

      {/* Upload progress */}
      {statuses.length > 0 && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: '#111', borderRadius: 6, border: '1px solid #1e1e1e' }}>
          {statuses.map((s, i) => <FileStatus key={i} {...s} />)}
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, marginTop: 10 }}>
          {photos.map(p => (
            <div
              key={p.id}
              style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#1a1a1a', cursor: 'pointer' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.original_name ?? 'photo'}
                onClick={() => setLightbox(p.url)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="lazy"
              />
              <button
                onClick={() => deletePhoto(p.id)}
                disabled={deleting === p.id}
                style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff',
                  fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Διαγραφή"
              >
                {deleting === p.id ? '…' : '×'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="photo"
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}
