import { describe, expect, it } from 'vitest'
import { displaySecret, isMasked, maskKey } from './secrets'

// These assertions are duplicated in settings.rs (`mask_matches_the_typescript_mask`).
// Both sides must agree or save_settings cannot tell "unchanged" from "replaced".
describe('maskKey', () => {
  it('shows six head and six tail characters and nothing between', () => {
    const key = 'sk-or-v1-0123456789abcdef'
    const m = maskKey(key)
    expect(m).toBe('sk-or-••••••••abcdef')
    expect(m).not.toContain('v1-0123')
  })

  it('never leaks a short key — it becomes bullets end to end', () => {
    expect(maskKey('')).toBe('')
    expect(maskKey('short')).toBe('•••••')
    expect(maskKey('elevenchars')).toBe('•••••••••••')
    // 12 is the first length that reveals head/tail.
    expect(maskKey('abcdefghijkl')).toBe('abcdef••••••••ghijkl')
  })

  it('counts code points, not UTF-16 units, so it matches Rust chars()', () => {
    const key = '🔑🔑🔑🔑🔑🔑middle🔑🔑🔑🔑🔑🔑'
    expect(Array.from(maskKey(key)).slice(0, 6).join('')).toBe('🔑🔑🔑🔑🔑🔑')
    expect(Array.from(maskKey(key)).slice(-6).join('')).toBe('🔑🔑🔑🔑🔑🔑')
  })
})

describe('displaySecret', () => {
  it('masks raw key material on its way to the screen', () => {
    expect(displaySecret('sk-or-v1-0123456789abcdef')).toBe('sk-or-••••••••abcdef')
  })

  it('passes an already-masked backend value through untouched', () => {
    const fromBackend = 'sk-or-••••••••abcdef'
    expect(displaySecret(fromBackend)).toBe(fromBackend)
  })

  it('renders nothing for an unset key so the placeholder shows', () => {
    expect(displaySecret('')).toBe('')
  })
})

describe('isMasked', () => {
  it('distinguishes a backend mask from raw key material', () => {
    expect(isMasked('sk-or-••••••••abcdef')).toBe(true)
    expect(isMasked('sk-or-v1-0123456789abcdef')).toBe(false)
    expect(isMasked('')).toBe(false)
  })
})
