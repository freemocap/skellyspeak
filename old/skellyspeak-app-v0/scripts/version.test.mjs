import { describe, expect, it } from 'vitest'
import { bump, compare, parse, versionIn, withVersion } from './version.mjs'

const next = (from, kind) => bump(parse(from), kind)
const cmp = (a, b) => compare(parse(a), parse(b))

describe('bumping', () => {
  it('moves the part asked for and zeroes the ones below it', () => {
    expect(next('0.3.0', 'patch')).toBe('0.3.1')
    expect(next('0.3.7', 'minor')).toBe('0.4.0')
    expect(next('0.3.7', 'major')).toBe('1.0.0')
    // The zeroing is the part that is easy to get wrong.
    expect(next('1.9.9', 'major')).toBe('2.0.0')
    expect(next('1.9.9', 'minor')).toBe('1.10.0')
  })

  it('releases a prerelease rather than stepping past it', () => {
    // 1.0.0-rc.1 is on its way to 1.0.0. Bumping the number as well would skip
    // the very release the prerelease was preparing.
    expect(next('1.0.0-rc.1', 'patch')).toBe('1.0.0')
    expect(next('1.0.0-rc.2', 'patch')).toBe('1.0.0')
  })

  it('discards a prerelease on a minor or major bump', () => {
    expect(next('1.0.0-rc.1', 'minor')).toBe('1.1.0')
    expect(next('1.0.0-rc.1', 'major')).toBe('2.0.0')
  })
})

describe('ordering', () => {
  it('compares numerically, not as text', () => {
    // The classic: "10" sorts before "9" as a string.
    expect(cmp('1.10.0', '1.9.0')).toBe(1)
    expect(cmp('0.3.0', '0.3.1')).toBe(-1)
    expect(cmp('2.0.0', '1.99.99')).toBe(1)
    expect(cmp('1.2.3', '1.2.3')).toBe(0)
  })

  it('puts a prerelease below the release it leads to', () => {
    // semver §11. Without this a 1.0.0-rc.1 -> 1.0.0 release looks like the
    // version going backwards, and the release script would refuse it.
    expect(cmp('1.0.0-rc.1', '1.0.0')).toBe(-1)
    expect(cmp('1.0.0', '1.0.0-rc.1')).toBe(1)
    expect(cmp('1.0.0-rc.1', '1.0.0-rc.2')).toBe(-1)
  })

  it('every bump produces something strictly newer', () => {
    // The property the release script relies on to refuse going backwards.
    for (const from of ['0.0.1', '0.3.0', '1.9.9', '1.0.0-rc.1']) {
      for (const kind of ['patch', 'minor', 'major']) {
        expect(cmp(next(from, kind), from)).toBe(1)
      }
    }
  })
})

describe('parsing', () => {
  it('rejects what is not a version', () => {
    for (const bad of ['', 'v1.0.0', '1.0', '1.0.0.0', 'latest', '1.0.0-']) {
      expect(parse(bad)).toBeNull()
    }
  })

  it('accepts a plain version and a prerelease', () => {
    expect(parse('0.3.0')).toEqual({ major: 0, minor: 3, patch: 0, pre: null })
    expect(parse('1.0.0-rc.1')).toEqual({ major: 1, minor: 0, patch: 0, pre: 'rc.1' })
  })
})

describe('rewriting Cargo.toml', () => {
  const cargo = '[package]\nname = "skellyspeak"\nversion = "0.3.0"\nedition = "2021"\n'

  it('reads and replaces the package version', () => {
    expect(versionIn(cargo)).toBe('0.3.0')
    expect(versionIn(withVersion(cargo, '0.4.0'))).toBe('0.4.0')
  })

  it('touches only the first version line', () => {
    // Dependency tables carry their own `version =` lines; rewriting one of
    // those would corrupt the manifest.
    const withDep = cargo + '\n[dependencies]\nserde = { version = "1" }\n'
    const out = withVersion(withDep, '9.9.9')
    expect(out).toContain('version = "9.9.9"')
    expect(out).toContain('serde = { version = "1" }')
  })

  it('keeps CRLF line endings', () => {
    // core.autocrlf=true gives a fresh clone CRLF here. Rewriting it as LF
    // would show the whole line as changed in every diff.
    const crlf = '[package]\r\nversion = "0.3.0"\r\n'
    expect(withVersion(crlf, '0.4.0')).toBe('[package]\r\nversion = "0.4.0"\r\n')
  })

  it('reports a manifest with no version line', () => {
    expect(versionIn('[package]\nname = "x"\n')).toBeNull()
  })
})
