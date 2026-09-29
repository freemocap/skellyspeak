import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { parseDocument } from 'yaml'
import { fastChecks, repositoryRoot, type Check } from './check-fast.ts'

// Run the aggregate in a child so expected fixture errors stay out of passing logs.
// Assert on its actual exit status, not only a function's return value.
function invokeChecks(root: string, checks: Check[]) {
  const script = `import { runChecks } from ${JSON.stringify(new URL('./check-fast.ts', import.meta.url).href)};
process.exitCode = runChecks(JSON.parse(process.argv[1]), process.argv[2]);`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify(checks), root], {
    cwd: root, encoding: 'utf8', timeout: 30_000,
  })
  assert.ifError(result.error)
  assert.equal(result.signal, null)
  return result
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'skellyspeak-validation-'))
  function write(file: string, text: string) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  for (const directory of ['ui/tools', 'native/src', 'content']) mkdirSync(join(root, directory), { recursive: true })
  write('ui/src/generated/skill-catalogs/catalog.json', '[]')
  write('ui/src/View.tsx', "tr('Active {count}', { count: 1 })")
  const dictionary = JSON.stringify({ 'Active {count}': 'Active {count}' })
  write('ui/src/domain/localization/locales/english.json', dictionary)
  write('ui/src/domain/localization/locales/french.json', dictionary)
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

test('the real fast localization commands reject a removed UI reference even when catalogs still agree', () => {
  const f = fixture()
  try {
    const checks = fastChecks(f.root).filter(check => check.name.startsWith('Localization '))
    assert.equal(checks.length, 2)
    const valid = invokeChecks(f.root, checks)
    assert.equal(valid.status, 0, valid.stdout + valid.stderr)
    // Catalog parity still passes, but a removed feature must not leave its key behind.
    f.write('ui/src/View.tsx', 'export const view = null')
    // Tests and dictionaries cannot keep a retired key alive in the usage audit.
    f.write('ui/src/View.test.tsx', "tr('Active {count}')")
    const removed = invokeChecks(f.root, checks)
    assert.equal(removed.status, 1, removed.stdout + removed.stderr)
    assert.match(removed.stdout, /FAILED: Localization usage/)
    assert.doesNotMatch(removed.stdout, /FAILED: Localization sources/)
  } finally { f.cleanup() }
})

test('the fast command reports catalog defects as well as unused keys in the same invocation', () => {
  const f = fixture()
  try {
    f.write('ui/src/domain/localization/locales/french.json', JSON.stringify({ 'Active {count}': 'Actif {other}' }))
    f.write('ui/src/View.tsx', 'export const view = null')
    const checks = fastChecks(f.root).filter(check => check.name.startsWith('Localization '))
    const invalid = invokeChecks(f.root, checks)
    assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr)
    assert.match(invalid.stderr, /UI placeholder mismatch/)
    assert.match(invalid.stdout, /FAILED: Localization sources/)
    assert.match(invalid.stdout, /FAILED: Localization usage/)
  } finally { f.cleanup() }
})

test('failed and unavailable subprocesses remain failures while later checks still execute', () => {
  const f = fixture()
  try {
    const sentinel = join(f.root, 'later-check-ran')
    const failed = invokeChecks(f.root, [
      { name: 'formatter failure', command: process.execPath, args: ['-e', 'process.exit(2)'] },
      { name: 'missing tool', command: join(f.root, 'missing-executable'), args: [] },
      { name: 'later check', command: process.execPath, args: ['-e', 'require("node:fs").writeFileSync(process.argv[1], "ran")', sentinel] },
    ])
    assert.equal(failed.status, 1, failed.stdout + failed.stderr)
    assert.equal(readFileSync(sentinel, 'utf8'), 'ran')
    assert.match(failed.stdout, /Fast validation failed: formatter failure, missing tool/)
    assert.doesNotMatch(failed.stdout, /FAILED: later check/)
  } finally { f.cleanup() }
})

test('the real formatter gate rejects unformatted Rust without compiling or modifying it', () => {
  const f = fixture()
  try {
    f.write('native/Cargo.toml', '[package]\nname = "validation-fixture"\nversion = "0.0.0"\nedition = "2021"\n')
    const source = 'pub fn value()->u32{1}\n'
    f.write('native/src/lib.rs', source)
    const checks = fastChecks(f.root).filter(check => check.name === 'Rust formatting')
    assert.equal(checks.length, 1)
    const invalid = invokeChecks(f.root, checks)
    assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr)
    assert.match(invalid.stdout, /Diff in/)
    assert.equal(readFileSync(join(f.root, 'native/src/lib.rs'), 'utf8'), source)
    f.write('native/src/lib.rs', 'pub fn value() -> u32 {\n    1\n}\n')
    const valid = invokeChecks(f.root, checks)
    assert.equal(valid.status, 0, valid.stdout + valid.stderr)
  } finally { f.cleanup() }
})

interface Job {
  needs?: string | string[]
  if?: string
  uses?: string
  with?: Record<string, unknown>
  steps?: { run?: string; uses?: string; with?: Record<string, unknown> }[]
}
function workflow(file: string): { jobs: Record<string, Job> } {
  const document = parseDocument(readFileSync(join(repositoryRoot, '.github/workflows', file), 'utf8'))
  assert.deepEqual(document.errors, [], file)
  return document.toJS()
}

test('ordinary tests and every expensive CI job retain the fast validation gate', () => {
  const { scripts } = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'))
  assert.equal(scripts.pretest, 'npm run check:fast')
  assert.equal(scripts['check:fast'], 'node tools/check-fast.ts')
  const checks = fastChecks()
  assert.ok(checks.some(check => check.command === 'cargo' && check.args.includes('fmt') && check.args.includes('--check')))
  assert.ok(checks.some(check => check.name === 'Validation regression tests' && check.args.includes(join(repositoryRoot, 'tools/check-fast.test.ts'))))

  const { jobs } = workflow('ci.yml')
  const gate = jobs['fast-validation']
  assert.ok(gate.steps?.some(step => step.run === 'npm run check:fast'))
  assert.ok(gate.steps?.some(step => step.with?.components === 'rustfmt'))
  assert.ok(!gate.needs, 'The fast checks must not wait for compilation')
  const cheapJobs = new Set(['validation-mode', 'fast-validation', 'android-resources'])
  for (const [name, job] of Object.entries(jobs)) {
    if (cheapJobs.has(name)) continue
    const needs = [job.needs].flat()
    assert.ok(needs.includes('fast-validation'), `${name} must wait for fast validation`)
    // No always()/failure() escape: normal success dependency semantics must apply.
    assert.equal(job.if, '${{ inputs.skip_validation != true }}', name)
  }
  assert.ok([jobs['android-build'].needs].flat().includes('android-resources'))
  assert.equal(gate.if, '${{ inputs.skip_validation != true }}')
  const release = workflow('release.yml')
  assert.equal(release.jobs.checks.uses, './.github/workflows/ci.yml')
  assert.equal(release.jobs.checks.with?.skip_validation, "${{ needs.version.outputs.skip_checks == 'true' }}")
  assert.ok([release.jobs['release-draft'].needs].flat().includes('checks'))
})
