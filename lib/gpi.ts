// Shared helpers for the GPI (long-term rental / property-management
// client) feature — app/api/gpi/**, app/gpi/**. Kept separate from the
// sales/valuation domain on purpose (see supabase/migrations/044_gpi.sql).
import crypto from 'crypto'
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

// Feature-level gate, separate from canAccessGpiClient's per-row ownership
// check above: is this agent allowed to use GPI AT ALL. Locked to a
// per-agency-designated account (agents.gpi_access) for now, plus the usual
// admin/ceo override every other gated feature in this app already has.
export function hasGpiFeatureAccess(caller: AuthedAgent): boolean {
  return isCeoOrAdmin(caller) || caller.gpi_access === true
}

export type GpiUnitRow = {
  id: string
  agency_id: string
  client_id: string
  expected_rent: number | null
  address: string | null
  project: string | null
  unit_name: string | null
  description: string | null
  notices: string | null
  exclusive_agreement_date: string | null
  exclusive_agreement_duration_months: number | null
}

// Shape consumed by components/GpiAgreementDocument.tsx — built once here so
// the agent's authenticated preview route and the public token-based route
// can't drift into filling the document differently.
export function buildAgreementData(client: GpiClientRow, unit: GpiUnitRow, agentFullName: string | null) {
  return {
    full_name: client.full_name,
    father_name: client.father_name,
    address: client.address,
    tin_number: client.tin_number,
    id_passport_number: client.id_passport_number,
    agent_full_name: agentFullName,
    unit: {
      expected_rent: unit.expected_rent,
      address: unit.address,
      project: unit.project,
      unit_name: unit.unit_name,
      description: unit.description,
      notices: unit.notices,
      exclusive_agreement_date: unit.exclusive_agreement_date,
      exclusive_agreement_duration_months: unit.exclusive_agreement_duration_months,
    },
  }
}

// 32 random bytes, base64url — used as the magic-link token in
// gpi_agreement_shares. Not a JWT and not guessable from the client/unit ids.
export function generateShareToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

// Lives here rather than in app/api/gpi/units/route.ts because Next.js's
// generated route types reject a route.ts file exporting anything besides
// the recognized handler names (GET/POST/etc.) and route config.
export const GPI_UNIT_FIELDS = [
  'sqm', 'floor', 'project', 'address', 'unit_name', 'expected_rent',
  'brochure_sent', 'exclusive_agreement_sent', 'exclusive_agreement_date', 'exclusive_agreement_duration_months',
  'rented', 'energy_certificate', 'advertisement', 'ad_link', 'project_delivered', 'keys_received',
  'description', 'notices',
] as const
