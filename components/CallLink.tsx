'use client'
import { useCallback } from 'react'

interface CallLinkProps {
  phone: string
  contactId?: string
  label?: string
  style?: React.CSSProperties
  className?: string
}

export default function CallLink({ phone, contactId, label, style, className }: CallLinkProps) {
  const normalized = phone?.trim().replace(/\s/g, '')

  const handleClick = useCallback(() => {
    if (!normalized) return
    fetch('/api/log-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ phone: normalized, contact_id: contactId ?? null }),
    }).catch(() => {})
  }, [normalized, contactId])

  if (!normalized) return <span style={{ color: '#555', ...style }}>—</span>

  return (
    <a
      href={`tel:${normalized}`}
      onClick={handleClick}
      className={className}
      style={{ color: '#3B82F6', textDecoration: 'none', fontWeight: 500, cursor: 'pointer', ...style }}
      title={`Κλήση: ${normalized}`}
    >
      📞 {label ?? phone}
    </a>
  )
}