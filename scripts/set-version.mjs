#!/usr/bin/env node
// Sets the app version. `src-tauri/Cargo.toml` is the single source of truth:
// tauri.conf.json omits `version` so Tauri reads it from there, package.json is
// private and carries no version, and the Android versionCode/versionName are
// derived from it by `tauri android build`.
//
//   node scripts/set-version.mjs 0.3.0
//
// It rewrites files and stops there. Tagging is deliberately NOT done here:
// the tag has to point at the commit that CONTAINS the bump, and at the moment
// this script runs that commit does not exist yet. A tag created here would
// name the previous commit, whose Cargo.toml still holds the old version — and
// the release workflow, which compares the two, would refuse to build it.
//
// The correct order is printed at the end: commit, then tag, then push.

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const args = process.argv.slice(2)
const version = args.find((a) => !a.startsWith('-'))
const flags = args.filter((a) => a.startsWith('-'))

if (!version) {
  console.error('usage: node scripts/set-version.mjs <version>')
  process.exit(1)
}
// This script takes no flags. Anything passed is a misunderstanding of what it
// does, and silently ignoring it is how a release gets tagged wrong.
if (flags.length > 0) {
  throw new Error(
    `unknown option${flags.length > 1 ? 's' : ''}: ${flags.join(' ')}
` +
      'This script only rewrites the version. Commit, then tag — the commands ' +
      'are printed when it finishes.',
  )
}
if (!SEMVER.test(version)) {
  throw new Error(`not a semver version: ${version} (expected e.g. 1.2.3 or 1.2.3-rc.1)`)
}

// Cargo.toml — only the [package] version, which is the first `version =` in the file.
const cargoPath = 'src-tauri/Cargo.toml'
const cargo = readFileSync(cargoPath, 'utf8')
// `\r?$` matters: core.autocrlf=true means a fresh clone has CRLF here, and a
// bare `$` would sit after the \r and never match. Put the \r back so the
// rewritten line keeps the file's own ending.
const VERSION_LINE = /^version = ".*"(\r?)$/m
// Checked separately from whether the text changed: re-running at the version
// already set is a harmless no-op, and reporting that as a missing version
// line sends you looking for a problem that is not there.
if (!VERSION_LINE.test(cargo)) {
  throw new Error(`no [package] version line found in ${cargoPath}`)
}
writeFileSync(
  cargoPath,
  cargo.replace(VERSION_LINE, (_line, cr) => `version = "${version}"${cr}`),
)

// Keep Cargo.lock in step so the next build does not dirty the tree.
execFileSync('cargo', ['update', '--offline', '--package', 'skellyspeak'], {
  cwd: 'src-tauri',
  stdio: 'inherit',
})

console.log(`version -> ${version}`)
console.log('')
console.log('Now, in this order — the tag must contain the bump, or the release')
console.log('workflow will refuse to build it:')
console.log('')
console.log(`  git commit -am "v${version}"`)
console.log(`  git tag v${version}`)
console.log(`  git push && git push origin v${version}`)
