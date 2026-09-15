import { describe, expect, it } from 'vitest'
import { compareVersions, isNewer, parseVersion } from './semver'

describe('isNewer', () => {
  it('offers a higher version', () => {
    expect(isNewer('0.2.0', '0.1.0')).toBe(true)
    expect(isNewer('1.0.0', '0.9.9')).toBe(true)
    expect(isNewer('0.1.1', '0.1.0')).toBe(true)
  })

  it('does not offer the same or an older version', () => {
    expect(isNewer('0.1.0', '0.1.0')).toBe(false)
    expect(isNewer('0.1.0', '0.2.0')).toBe(false)
    expect(isNewer('0.9.9', '1.0.0')).toBe(false)
  })

  it('compares numerically, not as text — 0.10.0 beats 0.9.0', () => {
    expect(isNewer('0.10.0', '0.9.0')).toBe(true)
    expect(isNewer('0.9.0', '0.10.0')).toBe(false)
  })

  it('tolerates a leading v, since GitHub tags carry one', () => {
    expect(isNewer('v0.2.0', '0.1.0')).toBe(true)
  })
})

describe('prerelease precedence', () => {
  it('ranks a prerelease below its release', () => {
    expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBe(-1)
    expect(isNewer('1.0.0', '1.0.0-rc.1')).toBe(true)
    expect(isNewer('1.0.0-rc.1', '1.0.0')).toBe(false)
  })

  it('orders prerelease identifiers', () => {
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.1')).toBe(1)
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
    // A shorter chain precedes a longer one with the same prefix.
    expect(compareVersions('1.0.0-rc', '1.0.0-rc.1')).toBe(-1)
  })
})

describe('parseVersion', () => {
  it('throws on anything unreadable rather than guessing', () => {
    // Silently treating these as "not newer" would strand users on an old
    // build with no indication why.
    for (const bad of ['', 'latest', '1.2', '1.2.3.4', 'v', 'main']) {
      expect(() => parseVersion(bad)).toThrow()
    }
  })
})
