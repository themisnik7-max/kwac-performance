import { isCeoOrAdmin, type AuthedAgent } from '../auth'

function agent(role: string): AuthedAgent {
  return { id: 'a1', email: 'a@kwac.gr', role, agency_id: 'agency-1', full_name: null, gpi_access: false }
}

describe('isCeoOrAdmin', () => {
  test('ceo — true', () => { expect(isCeoOrAdmin(agent('ceo'))).toBe(true) })
  test('admin — true', () => { expect(isCeoOrAdmin(agent('admin'))).toBe(true) })
  test('agent — false', () => { expect(isCeoOrAdmin(agent('agent'))).toBe(false) })
  test('unknown/empty role — false, not a default-allow', () => { expect(isCeoOrAdmin(agent(''))).toBe(false) })
})
