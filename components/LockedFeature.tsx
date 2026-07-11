'use client'

// Shared "this feature isn't available to you" placeholder — used by pages
// gated to specific roles/accounts (Intelligence OP for admin/ceo only, GPI
// for its designated account) instead of each page inventing its own locked
// state. The actual access boundary is always enforced server-side (RLS /
// getAuthedAgent + a feature-gate check in the API route) — this component
// is UX only, same relationship Shell.tsx's pendingApproval message has to
// getAuthedAgent's real enforcement.
export default function LockedFeature({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#888', maxWidth: 380, lineHeight: 1.6 }}>{message}</div>
    </div>
  )
}
