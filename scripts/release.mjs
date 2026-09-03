#!/usr/bin/env node
// Cut a release in one command.
//
//   node scripts/release.mjs patch          0.3.0 -> 0.3.1
//   node scripts/release.mjs minor          0.3.0 -> 0.4.0
//   node scripts/release.mjs major          0.3.0 -> 1.0.0
//   node scripts/release.mjs 1.0.0-rc.1     an explicit version
//   node scripts/release.mjs minor --dry-run    say what would happen, change nothing
//   node scripts/release.mjs patch --no-push    bump, commit and tag; push by hand
//
// It bumps `src-tauri/Cargo.toml` (the single source of truth for the version),
// updates `Cargo.lock`, commits, tags, and pushes both — in that order, because
// the release workflow reads the version from the Cargo.toml **of the tagged
// commit** and refuses to build when it disagrees with the tag.
//
// Most of this file is refusals rather than actions. Cutting a release is rare,
// unattended once it starts, and expensive to get wrong: a bad tag has to be
// deleted from the remote before it can be replaced. So every condition that
// would produce a broken release is checked BEFORE anything is written, and
// each refusal says exactly how to fix it.

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { BUMPS, CARGO, bump, compare, parse, versionIn, withVersion } from './version.mjs'

const RELEASE_BRANCH = 'main'

const USAGE = `usage: node scripts/release.mjs <${BUMPS.join('|')}|x.y.z> [--dry-run] [--no-push]`

// ── Small helpers ───────────────────────────────────────────────────────────

/// Read-only git. Returns trimmed stdout.
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

/// Git that changes something. Skipped entirely on a dry run.
function gitDo(dryRun, ...args) {
  if (dryRun) {
    console.log(`  [dry run] git ${args.join(' ')}`)
    return
  }
  console.log(`  git ${args.join(' ')}`)
  execFileSync('git', args, { stdio: 'inherit' })
}

function die(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}
// ── Arguments ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE)
  process.exit(0)
}

const dryRun = args.includes('--dry-run')
const noPush = args.includes('--no-push')
const unknown = args.filter((a) => a.startsWith('-') && !['--dry-run', '--no-push'].includes(a))
if (unknown.length > 0) die(`unknown option${unknown.length > 1 ? 's' : ''}: ${unknown.join(' ')}\n${USAGE}`)

const target = args.find((a) => !a.startsWith('-'))
if (!target) die(USAGE)

// ── Everything that must be true before anything is written ─────────────────

console.log('Checking…')

try {
  git('rev-parse', '--git-dir')
} catch {
  die('not inside a git repository.')
}

// Cheapest first, and the argument before the network: a typo'd version should
// say so immediately rather than after a fetch.
const currentVersion = versionIn(readFileSync(CARGO, 'utf8'))
if (!currentVersion) die(`no [package] version line found in ${CARGO}`)
const current = parse(currentVersion)
if (!current) die(`the version in ${CARGO} is not valid semver: "${currentVersion}"`)

const nextVersion = BUMPS.includes(target) ? bump(current, target) : target
const next = parse(nextVersion)
if (!next) die(`not a ${BUMPS.join('/')} bump and not a semver version: "${target}"\n${USAGE}`)
if (compare(next, current) <= 0) {
  die(
    `${nextVersion} is not newer than the current ${currentVersion}.\n` +
      '  Versions only go up: the updater compares them to decide what to offer.',
  )
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== RELEASE_BRANCH) {
  die(
    `on branch "${branch}", but releases are cut from "${RELEASE_BRANCH}".\n` +
      `  Switch with:  git switch ${RELEASE_BRANCH}`,
  )
}

// The release commit should contain the version bump and nothing else. Sweeping
// unrelated work into a commit named "v1.2.3" hides it from anyone reading the
// history later.
const dirty = git('status', '--porcelain')
if (dirty) {
  die(
    'the working tree has uncommitted changes. Commit or stash them first —\n' +
      '  the release commit should carry the version bump and nothing else.\n\n' +
      dirty
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n'),
  )
}

// Know about tags and commits that exist only on the remote.
console.log('  fetching…')
try {
  execFileSync('git', ['fetch', '--tags', '--quiet'], { stdio: 'inherit' })
} catch {
  die('could not reach the remote. A release has to be pushed, so this must work first.')
}

const behind = Number(git('rev-list', '--count', `HEAD..@{upstream}`))
if (behind > 0) {
  die(
    `${behind} commit${behind === 1 ? '' : 's'} on the remote ${behind === 1 ? 'is' : 'are'} not here yet.\n` +
      '  Pull first:  git pull --ff-only',
  )
}

const tag = `v${nextVersion}`
const tagExistsLocally = git('tag', '--list', tag) === tag
const tagOnRemote = git('ls-remote', '--tags', 'origin', tag) !== ''
if (tagExistsLocally || tagOnRemote) {
  die(
    `${tag} already exists ${tagExistsLocally && tagOnRemote ? 'locally and on the remote' : tagExistsLocally ? 'locally' : 'on the remote'}.\n` +
      '  A tag cannot be moved once pushed — delete it, then run this again:\n' +
      (tagExistsLocally ? `    git tag -d ${tag}\n` : '') +
      (tagOnRemote ? `    git push origin :refs/tags/${tag}\n` : '') +
      '  Then check for a leftover draft release on GitHub.',
  )
}

// ── The plan ────────────────────────────────────────────────────────────────

console.log('')
console.log(`  ${currentVersion} → ${nextVersion}   (${BUMPS.includes(target) ? target : 'explicit'})`)
console.log('')
console.log(`  1. write ${nextVersion} to ${CARGO} and update Cargo.lock`)
console.log(`  2. commit "${tag}"`)
console.log(`  3. tag ${tag}`)
console.log(noPush ? '  4. (skipping push — --no-push)' : `  4. push ${RELEASE_BRANCH} and ${tag}`)
console.log('')

if (dryRun) {
  console.log('Dry run — nothing was changed.')
  process.exit(0)
}

// ── Do it ───────────────────────────────────────────────────────────────────

writeFileSync(CARGO, withVersion(readFileSync(CARGO, 'utf8'), nextVersion))
console.log(`  wrote ${CARGO}`)

execFileSync('cargo', ['update', '--offline', '--package', 'skellyspeak'], {
  cwd: 'src-tauri',
  stdio: 'inherit',
})

gitDo(false, 'add', CARGO, 'src-tauri/Cargo.lock')
gitDo(false, 'commit', '-m', tag)
gitDo(false, 'tag', tag)

// The exact failure this whole script exists to prevent: a tag naming a commit
// whose Cargo.toml still holds the old version. Checked here, locally, in
// milliseconds — rather than by the release workflow after a push that then has
// to be undone on the remote.
const taggedVersion = versionIn(git('show', `${tag}:${CARGO}`))
if (taggedVersion !== nextVersion) {
  die(
    `${tag} points at a commit whose ${CARGO} says ${taggedVersion}, not ${nextVersion}.\n` +
      '  Nothing has been pushed. Undo with:\n' +
      `    git tag -d ${tag}\n` +
      '    git reset --soft HEAD~1',
  )
}
console.log(`  verified: ${tag} contains version ${nextVersion}`)

if (noPush) {
  console.log('')
  console.log('Not pushed. When you are ready:')
  console.log(`  git push && git push origin ${tag}`)
  process.exit(0)
}

gitDo(false, 'push')
gitDo(false, 'push', 'origin', tag)

console.log('')
console.log(`Released ${tag}. The build is starting:`)
console.log('  https://github.com/freemocap/skellyspeak/actions')
console.log('')
console.log('It attaches everything to a DRAFT release — review the assets, then publish:')
console.log('  https://github.com/freemocap/skellyspeak/releases')
