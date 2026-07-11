import { canAccessGpiClient, hasGpiFeatureAccess, redactGpiClient, generateShareToken, type GpiClientRow } from '../gpi'
import type { AuthedAgent } from '../auth'

// GPI access is intentionally tighter than the rest of the app (assigned
// agent + admin/ceo only, not agency-wide) — canAccessGpiClient is the one
// function standing between an agent and another agent's landlord's
// taxisnet credentials, so it's worth pinning down directly rather than
// only exercising it indirectly through a live route.

function agent(overrides: Partial<AuthedAgent> = {}): AuthedAgent {
  return { id: 'agent-1', email: 'a@kwac.gr', role: 'agent', agency_id: 'agency-1', full_name: 'Agent One', gpi_access: false, ...overrides }
}

describe('canAccessGpiClient', () => {
  test('different agency — always denied, even for admin/ceo', () => {
    const caller = agent({ role: 'ceo', agency_id: 'agency-1' })
    const client = { agency_id: 'agency-2', agent_id: null }
    expect(canAccessGpiClient(caller, client)).toBe(false)
  })

  test('same agency, admin — allowed regardless of assignment', () => {
    const caller = agent({ id: 'admin-1', role: 'admin', agency_id: 'agency-1' })
    const client = { agency_id: 'agency-1', agent_id: 'someone-else' }
    expect(canAccessGpiClient(caller, client)).toBe(true)
  })

  test('same agency, ceo — allowed regardless of assignment', () => {
    const caller = agent({ id: 'ceo-1', role: 'ceo', agency_id: 'agency-1' })
    const client = { agency_id: 'agency-1', agent_id: 'someone-else' }
    expect(canAccessGpiClient(caller, client)).toBe(true)
  })

  test('same agency, regular agent, is the assigned agent — allowed', () => {
    const caller = agent({ id: 'agent-1', role: 'agent', agency_id: 'agency-1' })
    const client = { agency_id: 'agency-1', agent_id: 'agent-1' }
    expect(canAccessGpiClient(caller, client)).toBe(true)
  })

  test('same agency, regular agent, NOT the assigned agent — denied', () => {
    const caller = agent({ id: 'agent-1', role: 'agent', agency_id: 'agency-1' })
    const client = { agency_id: 'agency-1', agent_id: 'agent-2' }
    expect(canAccessGpiClient(caller, client)).toBe(false)
  })

  test('same agency, regular agent, unassigned client (agent_id null) — denied', () => {
    const caller = agent({ id: 'agent-1', role: 'agent', agency_id: 'agency-1' })
    const client = { agency_id: 'agency-1', agent_id: null }
    expect(canAccessGpiClient(caller, client)).toBe(false)
  })
})

describe('hasGpiFeatureAccess', () => {
  test('regular agent, no flag — denied', () => {
    expect(hasGpiFeatureAccess(agent({ role: 'agent', gpi_access: false }))).toBe(false)
  })

  test('regular agent, gpi_access flag set — allowed', () => {
    expect(hasGpiFeatureAccess(agent({ role: 'agent', gpi_access: true }))).toBe(true)
  })

  test('ceo, no flag — allowed via the usual admin/ceo override', () => {
    expect(hasGpiFeatureAccess(agent({ role: 'ceo', gpi_access: false }))).toBe(true)
  })

  test('admin, no flag — allowed via the usual admin/ceo override', () => {
    expect(hasGpiFeatureAccess(agent({ role: 'admin', gpi_access: false }))).toBe(true)
  })
})

function client(overrides: Partial<GpiClientRow> = {}): GpiClientRow {
  return {
    id: 'client-1', agency_id: 'agency-1', agent_id: 'agent-1', full_name: 'Landlord',
    father_name: null, tin_number: '090000000', id_passport_number: 'AB123456',
    id_passport_photo_path: null, address: null, bank_account: null,
    taxisnet_username_encrypted: 'ct-user', taxisnet_password_encrypted: 'ct-pass', taxisnet_auth_key_encrypted: null,
    created_at: '2026-01-01', updated_at: '2026-01-01',
    ...overrides,
  }
}

describe('redactGpiClient', () => {
  test('strips all three ciphertext fields from the returned object', () => {
    const redacted = redactGpiClient(client())
    expect(redacted).not.toHaveProperty('taxisnet_username_encrypted')
    expect(redacted).not.toHaveProperty('taxisnet_password_encrypted')
    expect(redacted).not.toHaveProperty('taxisnet_auth_key_encrypted')
  })

  test('has_* flags reflect presence/absence, not the ciphertext itself', () => {
    const redacted = redactGpiClient(client())
    expect(redacted.has_taxisnet_username).toBe(true)
    expect(redacted.has_taxisnet_password).toBe(true)
    expect(redacted.has_taxisnet_auth_key).toBe(false) // null in the fixture
  })

  test('non-sensitive fields pass through unchanged', () => {
    const redacted = redactGpiClient(client())
    expect(redacted.full_name).toBe('Landlord')
    expect(redacted.tin_number).toBe('090000000')
  })
})

describe('generateShareToken', () => {
  test('produces a long, URL-safe token (32 random bytes, base64url)', () => {
    const token = generateShareToken()
    expect(token.length).toBeGreaterThanOrEqual(40)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test('two calls never collide', () => {
    expect(generateShareToken()).not.toBe(generateShareToken())
  })
})
