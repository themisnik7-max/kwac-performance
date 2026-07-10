// Shared helpers for the GPI (long-term rental / property-management
// client) feature — app/api/gpi/**, app/gpi/**. Kept separate from the
// sales/valuation domain on purpose (see supabase/migrations/044_gpi.sql).
import { encryptSecret, decryptSecret } from './crypto'
import { isCeoOrAdmin, type AuthedAgent } from './auth'

export type GpiClientRow = {
  id: string
  agency_id: string
  agent_id: string | null
  full_name: string
  father_name: string | null
  tin_number: string | null
  id_passport_number: string | null
  id_passport_photo_path: string | null
  address: string | null
  bank_account: string | null
  taxisnet_username_encrypted: string | null
  taxisnet_password_encrypted: string | null
  taxisnet_auth_key_encrypted: string | null
  created_at: string
  updated_at: string
}

// Never send ciphertext to the browser, even encrypted — there's no reason
// to, and it's one less thing that can leak. List/detail views only ever
// see whether each credential is on file; plaintext only leaves the server
// via the separate, logged /reveal route.
export function redactGpiClient(row: GpiClientRow) {
  const { taxisnet_username_encrypted, taxisnet_password_encrypted, taxisnet_auth_key_encrypted, ...rest } = row
  return {
    ...rest,
    has_taxisnet_username: !!taxisnet_username_encrypted,
    has_taxisnet_password: !!taxisnet_password_encrypted,
    has_taxisnet_auth_key: !!taxisnet_auth_key_encrypted,
  }
}

type CredentialInput = { taxisnet_username?: string; taxisnet_password?: string; taxisnet_auth_key?: string }

// Only includes a key in the returned object for fields actually present in
// input, so a partial PATCH doesn't clobber credentials the caller didn't
// mean to touch. An explicit empty string clears that credential.
export function encryptGpiCredentials(input: CredentialInput): Record<string, string> {
  const out: Record<string, string> = {}
  if (input.taxisnet_username !== undefined) out.taxisnet_username_encrypted = input.taxisnet_username ? encryptSecret(input.taxisnet_username) : ''
  if (input.taxisnet_password !== undefined) out.taxisnet_password_encrypted = input.taxisnet_password ? encryptSecret(input.taxisnet_password) : ''
  if (input.taxisnet_auth_key !== undefined) out.taxisnet_auth_key_encrypted = input.taxisnet_auth_key ? encryptSecret(input.taxisnet_auth_key) : ''
  return out
}

export function decryptGpiCredentials(row: GpiClientRow) {
  return {
    taxisnet_username: row.taxisnet_username_encrypted ? decryptSecret(row.taxisnet_username_encrypted) : '',
    taxisnet_password: row.taxisnet_password_encrypted ? decryptSecret(row.taxisnet_password_encrypted) : '',
    taxisnet_auth_key: row.taxisnet_auth_key_encrypted ? decryptSecret(row.taxisnet_auth_key_encrypted) : '',
  }
}

// Restricted access rule (tighter than the rest of the app): the assigned
// agent, or admin/ceo in the same agency. Not "any agent in the agency."
export function canAccessGpiClient(caller: AuthedAgent, client: { agency_id: string; agent_id: string | null }): boolean {
  if (client.agency_id !== caller.agency_id) return false
  return isCeoOrAdmin(caller) || client.agent_id === caller.id
}
