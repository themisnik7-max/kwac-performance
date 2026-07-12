import { redactPropertyIfNotOwner, redactDemandIfNotOwner } from '../properties'

describe('redactPropertyIfNotOwner', () => {
  const row = {
    id: 'p1', agent_id: 'agent-1',
    owner_name: 'Landlord', owner_phone: '69...', owner_email: 'l@x.gr',
    seller_motivation: 'relocating', owner_contact_id: 'c1', contacts: { full_name: 'Landlord' },
    address: 'Odos 1', status: 'estimated',
  }

  test('owner viewing their own row — untouched', () => {
    expect(redactPropertyIfNotOwner(row, 'agent-1', false)).toEqual(row)
  })

  test('admin/ceo viewing any row — untouched', () => {
    expect(redactPropertyIfNotOwner(row, 'someone-else', true)).toEqual(row)
  })

  test('a different agent — owner PII stripped, everything else kept', () => {
    const out = redactPropertyIfNotOwner(row, 'agent-2', false)
    expect(out.owner_name).toBeNull()
    expect(out.owner_phone).toBeNull()
    expect(out.owner_email).toBeNull()
    expect(out.seller_motivation).toBeNull()
    expect(out.owner_contact_id).toBeNull()
    expect(out.contacts).toBeNull()
    expect(out.address).toBe('Odos 1')
    expect(out.status).toBe('estimated')
    expect(out.id).toBe('p1')
  })
})

describe('redactDemandIfNotOwner', () => {
  const row = {
    id: 'd1', agent_id: 'agent-1',
    client_name: 'Buyer', client_phone: '69...', client_email: 'b@x.gr',
    budget_eur: 200000, status: 'active',
  }

  test('owner viewing their own row — untouched', () => {
    expect(redactDemandIfNotOwner(row, 'agent-1', false)).toEqual(row)
  })

  test('admin/ceo viewing any row — untouched', () => {
    expect(redactDemandIfNotOwner(row, 'someone-else', true)).toEqual(row)
  })

  test('a different agent — client PII stripped, everything else kept', () => {
    const out = redactDemandIfNotOwner(row, 'agent-2', false)
    expect(out.client_name).toBeNull()
    expect(out.client_phone).toBeNull()
    expect(out.client_email).toBeNull()
    expect(out.budget_eur).toBe(200000)
    expect(out.status).toBe('active')
  })
})
