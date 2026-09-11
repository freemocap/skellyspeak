// Version arithmetic, kept apart from the release script so it can be tested
// without touching git. `src-tauri/Cargo.toml` is the single source of truth
// for the app version; this module only knows how to read, compare and
// increment the string.

export const CARGO = 'src-tauri/Cargo.toml'
export const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/
export const BUMPS = ['major', 'minor', 'patch']
/// The `[package]` version — the first `version = "..."` in the file.
///
/// `\r?$` matters: core.autocrlf=true means a fresh clone has CRLF here, and a
/// bare `$` would sit after the \r and never match.
export const VERSION_LINE = /^version = ".*"(\r?)$/m

export function parse(version) {
  const m = SEMVER.exec(version)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ?? null,
  }
}

/// The version string inside a Cargo.toml's text, or null.
export function versionIn(cargoText) {
  const line = VERSION_LINE.exec(cargoText)
  return line ? line[0].match(/"(.*)"/)[1] : null
}

/// Replace the version, preserving the file's own line ending.
export function withVersion(cargoText, version) {
  return cargoText.replace(VERSION_LINE, (_line, cr) => `version = "${version}"${cr}`)
}

/// -1, 0 or 1. A prerelease sorts below the release it leads to (semver §11),
/// which is what makes "1.0.0-rc.1 then 1.0.0" a legal sequence rather than a
/// version that appears to go backwards.
export function compare(a, b) {
  for (const part of ['major', 'minor', 'patch']) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1
  }
  if (a.pre === b.pre) return 0
  if (a.pre === null) return 1
  if (b.pre === null) return -1
  return a.pre < b.pre ? -1 : 1
}

/// The next version for a `major`/`minor`/`patch` bump.
export function bump(current, kind) {
  const { major, minor, patch, pre } = current
  if (kind === 'patch') {
    // A prerelease already sits AT its core version, so releasing it drops the
    // suffix rather than moving the number again: 1.0.0-rc.1 patches to 1.0.0,
    // not 1.0.1. Bumping the number too would skip the release being prepared.
    return pre ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`
  }
  // A prerelease is discarded by minor and major bumps: 1.0.0-rc.1 is on its
  // way to 1.0.0, and the next minor after that is 1.1.0.
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major + 1}.0.0`
}
