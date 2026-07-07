// Shared helpers for the contacts table, which has two overlapping name
// schemes in practice: full_name (added for AI Admin/marketing) and the
// original first_name/last_name (from the Google Contacts import). Every
// read/write path needs to handle both instead of assuming one.
export type NameFields = { full_name?: string | null; first_name?: string | null; last_name?: string | null }

export function contactName(c: NameFields): string {
  if (c.full_name) return c.full_name
  const parts = [c.first_name, c.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : ''
}

export function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return { first_name: parts[0] ?? '', last_name: parts.slice(1).join(' ') }
}
