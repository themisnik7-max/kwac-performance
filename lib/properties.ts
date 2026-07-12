// Shared helpers for redacting owner/client PII on agency-wide property and
// demand-profile reads. meeting_properties/demand_profiles rows are visible
// agency-wide by RLS once past 'pending' (intentional — agents need to see
// what colleagues are working on to avoid duplicate outreach), but RLS
// can't hide individual columns within a visible row. The owner's/client's
// name, phone, and email are exactly the fields a competing agent could use
// to poach a lead, so those get stripped here, server-side, for anyone who
// isn't the uploading agent or admin/ceo — mirrors redactGpiClient's role
// in lib/gpi.ts for the same class of problem.

export type PropertyPII = {
  owner_name: unknown
  owner_phone: unknown
  owner_email: unknown
  seller_motivation: unknown
  owner_contact_id: unknown
  contacts: unknown
}

export function redactPropertyIfNotOwner<T extends { agent_id: string | null } & Partial<PropertyPII>>(
  row: T, callerId: string, isPrivileged: boolean
): T {
  if (row.agent_id === callerId || isPrivileged) return row
  return {
    ...row,
    owner_name: null, owner_phone: null, owner_email: null,
    seller_motivation: null, owner_contact_id: null, contacts: null,
  }
}

export type DemandPII = {
  client_name: unknown
  client_phone: unknown
  client_email: unknown
}

export function redactDemandIfNotOwner<T extends { agent_id: string | null } & Partial<DemandPII>>(
  row: T, callerId: string, isPrivileged: boolean
): T {
  if (row.agent_id === callerId || isPrivileged) return row
  return { ...row, client_name: null, client_phone: null, client_email: null }
}
