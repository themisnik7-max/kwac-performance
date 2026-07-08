'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [dragOver,   setDragOver]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showPrev = useCallback(() => setLightboxIdx(i => i === null ? null : (i - 1 + photos.length) % photos.length), [photos.length])
  const showNext = useCallback(() => setLightboxIdx(i => i === null ? null : (i + 1) % photos.length), [photos.length])

  // Left/right cycles through the other photos instead of having to close
  // and reopen the lightbox for each one; Escape still closes it.
  useEffect(() => {
    if (lightboxIdx === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') showPrev()
      else if (e.key === 'ArrowRight') showNext()
      else if (e.key === 'Escape') setLightboxIdx(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIdx, showPrev, showNext])

  // Photos already uploaded in a previous visit never showed up here before —
  // this component only ever refreshed its list right after a fresh upload,
  // never on mount, so reopening a property looked like the photos had never
  // saved even when they were sitting in storage the whole time.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/property-photos?property_id=${propertyId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!cancelled) setPhotos(data.photos ?? [])
    })()
    return () => { cancelled = true }
  }, [propertyId])

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
      {/* Upload button — large touch target for mobile — doubles as a real
          drop zone now (it had the dashed-border drop-zone styling before but
          no onDrop/onDragOver handlers at all, so dragging a file onto it
          silently did nothing; only the click-to-pick-a-file path worked). */}
      <label
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files) }}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            8,
          padding:        '12px 0',
          background:     dragOver ? '#2a2a2a' : '#1a1a1a',
          border:         dragOver ? '1.5px dashed #CC2229' : '1.5px dashed #2a2a2a',
          borderRadius:   8,
          cursor:         'pointer',
          fontSize:       13,
          color:          '#666',
          userSelect:     'none',
          WebkitUserSelect: 'none',
          transition:     'background .15s, border-color .15s',
        }}
      >
        <span style={{ fontSize: 20 }}>📷</span>
        <span>Προσθήκη φωτογραφιών (ή σύρε εδώ)</span>
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
          {photos.map((p, i) => (
            <div
              key={p.id}
              style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#1a1a1a', cursor: 'pointer' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.original_name ?? 'photo'}
                onClick={() => setLightboxIdx(i)}
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

      {/* Lightbox — arrows cycle through the other photos instead of having
          to close and reopen for each one */}
      {lightboxIdx !== null && (
        <div
          onClick={() => setLightboxIdx(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, cursor: 'zoom-out', padding: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightboxIdx].url}
            alt="photo"
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }}
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); showPrev() }}
                aria-label="Προηγούμενη"
                style={{
                  position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 44, height: 44, borderRadius: '50%', border: 'none',
                  background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 22,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>‹</button>
              <button
                onClick={e => { e.stopPropagation(); showNext() }}
                aria-label="Επόμενη"
                style={{
                  position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 44, height: 44, borderRadius: '50%', border: 'none',
                  background: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 22,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>›</button>
              <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,.7)', fontSize: 12 }}>
                {lightboxIdx + 1} / {photos.length}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
