import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bump, compare, parse, versionIn, withVersion } from './version.ts'

const next = (from, kind) => bump(parse(from), kind)
const cmp = (a, b) => compare(parse(a), parse(b))

describe('bumping', () => {
  it('moves the part asked for and zeroes the ones below it', () => {
    assert.equal(next('0.3.0', 'patch'), '0.3.1')
    assert.equal(next('0.3.7', 'minor'), '0.4.0')
    assert.equal(next('0.3.7', 'major'), '1.0.0')
    // The zeroing is the part that is easy to get wrong.
    assert.equal(next('1.9.9', 'major'), '2.0.0')
    assert.equal(next('1.9.9', 'minor'), '1.10.0')
  })

  it('releases a prerelease rather than stepping past it', () => {
    // 1.0.0-rc.1 is on its way to 1.0.0. Bumping the number as well would skip
    // the very release the prerelease was preparing.
    assert.equal(next('1.0.0-rc.1', 'patch'), '1.0.0')
    assert.equal(next('1.0.0-rc.2', 'patch'), '1.0.0')
  })

  it('discards a prerelease on a minor or major bump', () => {
    assert.equal(next('1.0.0-rc.1', 'minor'), '1.1.0')
    assert.equal(next('1.0.0-rc.1', 'major'), '2.0.0')
  })
})

describe('ordering', () => {
  it('compares numerically, not as text', () => {
    // The classic: "10" sorts before "9" as a string.
    assert.equal(cmp('1.10.0', '1.9.0'), 1)
    assert.equal(cmp('0.3.0', '0.3.1'), -1)
    assert.equal(cmp('2.0.0', '1.99.99'), 1)
    assert.equal(cmp('1.2.3', '1.2.3'), 0)
  })

  it('puts a prerelease below the release it leads to', () => {
    // semver §11. Without this a 1.0.0-rc.1 -> 1.0.0 release looks like the
    // version going backwards, and the release script would refuse it.
    assert.equal(cmp('1.0.0-rc.1', '1.0.0'), -1)
    assert.equal(cmp('1.0.0', '1.0.0-rc.1'), 1)
    assert.equal(cmp('1.0.0-rc.1', '1.0.0-rc.2'), -1)
  })

  it('every bump produces something strictly newer', () => {
    // The property the release script relies on to refuse going backwards.
    for (const from of ['0.0.1', '0.3.0', '1.9.9', '1.0.0-rc.1']) {
      for (const kind of ['patch', 'minor', 'major']) {
        assert.equal(cmp(next(from, kind), from), 1)
      }
    }
  })
})

describe('parsing', () => {
  it('rejects what is not a version', () => {
    for (const bad of ['', 'v1.0.0', '1.0', '1.0.0.0', 'latest', '1.0.0-']) {
      assert.equal(parse(bad), null)
    }
  })

  it('accepts a plain version and a prerelease', () => {
    assert.deepEqual(parse('0.3.0'), { major: 0, minor: 3, patch: 0, pre: null })
    assert.deepEqual(parse('1.0.0-rc.1'), { major: 1, minor: 0, patch: 0, pre: 'rc.1' })
  })
})

describe('rewriting Cargo.toml', () => {
  const cargo = '[package]\nname = "skellyspeak"\nversion = "0.3.0"\nedition = "2021"\n'

  it('reads and replaces the package version', () => {
    assert.equal(versionIn(cargo), '0.3.0')
    assert.equal(versionIn(withVersion(cargo, '0.4.0')), '0.4.0')
  })

  it('touches only the first version line', () => {
    // Dependency tables carry their own `version =` lines; rewriting one of
    // those would corrupt the manifest.
    const withDep = cargo + '\n[dependencies]\nserde = { version = "1" }\n'
    const out = withVersion(withDep, '9.9.9')
    assert.ok(out.includes('version = "9.9.9"'))
    assert.ok(out.includes('serde = { version = "1" }'))
  })

  it('keeps CRLF line endings', () => {
    // core.autocrlf=true gives a fresh clone CRLF here. Rewriting it as LF
    // would show the whole line as changed in every diff.
    const crlf = '[package]\r\nversion = "0.3.0"\r\n'
    assert.equal(withVersion(crlf, '0.4.0'), '[package]\r\nversion = "0.4.0"\r\n')
  })

  it('reports a manifest with no version line', () => {
    assert.equal(versionIn('[package]\nname = "x"\n'), null)
  })
})
