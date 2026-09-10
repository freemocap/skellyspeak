/// Comparing app versions.
///
/// Only what this app produces needs parsing: `MAJOR.MINOR.PATCH` with an
/// optional `-prerelease` tail, exactly what `scripts/set-version.mjs` accepts.
/// Anything else throws — a version string we cannot read must not be silently
/// treated as "not newer", which would leave users stranded on an old build
/// with no indication why.

export interface Version {
  major: number
  minor: number
  patch: number
  /// Dot-separated identifiers after "-", empty for a normal release.
  prerelease: string[]
}

const PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

export function parseVersion(raw: string): Version {
  const text = raw.trim().replace(/^v/, '')
  const m = PATTERN.exec(text)
  if (!m) throw new Error(`unreadable version string: ${raw}`)
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
  }
}

/// -1 if a < b, 0 if equal, 1 if a > b. Precedence follows semver: a
/// prerelease is LOWER than the release it precedes, so 1.0.0-rc.1 < 1.0.0.
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a)
  const y = parseVersion(b)
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (x[key] !== y[key]) return x[key] < y[key] ? -1 : 1
  }
  if (x.prerelease.length === 0 && y.prerelease.length === 0) return 0
  if (x.prerelease.length === 0) return 1
  if (y.prerelease.length === 0) return -1
  for (let i = 0; i < Math.max(x.prerelease.length, y.prerelease.length); i++) {
    const p = x.prerelease[i]
    const q = y.prerelease[i]
    // A shorter prerelease chain precedes a longer one with the same prefix.
    if (p === undefined) return -1
    if (q === undefined) return 1
    if (p === q) continue
    const pNum = /^\d+$/.test(p)
    const qNum = /^\d+$/.test(q)
    // Numeric identifiers compare numerically and rank below alphanumerics.
    if (pNum && qNum) return Number(p) < Number(q) ? -1 : 1
    if (pNum) return -1
    if (qNum) return 1
    return p < q ? -1 : 1
  }
  return 0
}

/// Is `candidate` a version the user should be offered over `current`?
export function isNewer(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0
}
