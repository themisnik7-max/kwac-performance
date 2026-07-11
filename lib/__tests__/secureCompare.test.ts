import { secureCompare } from '../secureCompare'

describe('secureCompare', () => {
  test('identical strings match', () => {
    expect(secureCompare('my-secret-token', 'my-secret-token')).toBe(true)
  })

  test('different strings of the same length do not match', () => {
    expect(secureCompare('my-secret-token1', 'my-secret-token2')).toBe(false)
  })

  test('different-length strings do not match (and do not throw)', () => {
    expect(() => secureCompare('short', 'a-much-longer-secret-value')).not.toThrow()
    expect(secureCompare('short', 'a-much-longer-secret-value')).toBe(false)
  })

  test('empty strings match each other but not a real secret', () => {
    expect(secureCompare('', '')).toBe(true)
    expect(secureCompare('', 'real-secret')).toBe(false)
  })
})
