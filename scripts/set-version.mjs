#!/usr/bin/env node
// Sets the app version. `src-tauri/Cargo.toml` is the single source of truth:
// tauri.conf.json omits `version` so Tauri reads it from there, package.json is
// private and carries no version, and the Android versionCode/versionName are
// derived from it by `tauri android build`.
//
//   node scripts/set-version.mjs 0.2.0 --git-tag
//
// `--git-tag` also creates the matching `v0.2.0` git tag. The flag is NOT
// called `--tag`: npm claims that name for its own dist-tag option and
// silently swallows it instead of forwarding it to the script.

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const args = process.argv.slice(2)
const version = args.find((a) => !a.startsWith('-'))
const shouldTag = args.includes('--git-tag')

if (!version) {
  console.error('usage: node scripts/set-version.mjs <version> [--git-tag]')
  process.exit(1)
}
// Catch the old spelling rather than silently not tagging.
if (args.includes('--tag')) {
  throw new Error('use --git-tag, not --tag: npm swallows --tag as its own option')
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
const bumped = cargo.replace(
  /^version = ".*"(\r?)$/m,
  (_line, cr) => `version = "${version}"${cr}`,
)
if (bumped === cargo) throw new Error(`no [package] version line found in ${cargoPath}`)
writeFileSync(cargoPath, bumped)

// Keep Cargo.lock in step so the next build does not dirty the tree.
execFileSync('cargo', ['update', '--offline', '--package', 'skellyspeak'], {
  cwd: 'src-tauri',
  stdio: 'inherit',
})

console.log(`version -> ${version}`)

if (shouldTag) {
  execFileSync('git', ['tag', `v${version}`], { stdio: 'inherit' })
  console.log(`tagged v${version} — push it to trigger the release build:`)
  console.log(`  git push origin v${version}`)
}
