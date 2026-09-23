import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signedDevArgs } from './macos-dev-runner.ts'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { developmentRequirement, ensureDevelopmentSignature, signingIdentity, selectSigningIdentity, signatureDetails } from './macos-signing.ts'

test('normal Tauri dev retains its watcher and receives a Cargo executable runner', () => {
  const args = signedDevArgs(['dev'], '/node path/node', '/repo path/runner.ts')
  assert.deepEqual(args.slice(0, 3), ['dev', '--', '--config'])
  const value = args[3]!.split('runner=')[1]!
  assert.deepEqual(JSON.parse(value), ['/node path/node', '/repo path/runner.ts'])
  assert.ok(args[3]!.startsWith('target.aarch64-apple-darwin.runner='))
  assert.ok(args[5]!.startsWith('target.x86_64-apple-darwin.runner='))
  assert.ok(!args.includes('--no-watch'))
})
test('Tauri, Cargo and app options remain in their respective argument groups', () => {
  const args = signedDevArgs(['dev', '--release', '--', '--features', 'example', '--', '--app-option'], '/node', '/runner.ts')
  assert.deepEqual(args.slice(0, 5), ['dev', '--release', '--', '--features', 'example'])
  assert.deepEqual(args.slice(-2), ['--', '--app-option'])
  assert.equal(args.indexOf('--config'), 5)
})
test('designated identity depends only on app identity and certificate, never build bytes', () => {
  assert.equal(developmentRequirement('A'.repeat(40)), `identifier "com.freemocap.skellyspeak" and certificate leaf = H"${'a'.repeat(40)}"`)
  assert.throws(() => developmentRequirement('-'), /Invalid/)
  assert.throws(() => developmentRequirement('certificate" or true'), /Invalid/)
})

// Opt-in: uses the existing local signing key, never reads app credentials.
test('real Cargo rebuilds retain the same designated identity and reuse unchanged signatures', {
  skip: process.platform !== 'darwin' || process.env.SKELLYSPEAK_TEST_SIGNING !== '1',
}, () => {
  const directory = mkdtempSync(join(tmpdir(), 'skellyspeak-signing-'))
  const runner = fileURLToPath(new URL('./macos-dev-runner.ts', import.meta.url))
  const cargoArgs = signedDevArgs(['dev'], process.execPath, runner).slice(2)
  const run = (command: string, args: string[]) => {
    const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8' })
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`)
    return `${result.stdout}\n${result.stderr}`
  }
  try {
    mkdirSync(join(directory, 'src'))
    writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "signing-fixture"\nversion = "0.1.0"\nedition = "2024"\n')
    const source = join(directory, 'src/main.rs')
    const binary = join(directory, 'target/debug/signing-fixture')
    writeFileSync(source, 'fn main() { println!("first-build"); }')
    assert.match(run('cargo', ['run', '--offline', ...cargoArgs]), /first-build/)
    const before = run('/usr/bin/codesign', ['-d', '-r-', '-vvvv', binary])
    const firstIdentity = signatureDetails(binary)
    assert.equal(ensureDevelopmentSignature(binary, signingIdentity()), 'reused')
    // Cargo can restore its cached ad-hoc artifact even without recompiling.
    assert.match(run('cargo', ['run', '--offline', ...cargoArgs]), /first-build/)
    writeFileSync(source, 'fn main() { println!("second-build"); }')
    assert.match(run('cargo', ['run', '--offline', ...cargoArgs]), /second-build/)
    const after = run('/usr/bin/codesign', ['-d', '-r-', '-vvvv', binary])
    const requirement = (value: string) => value.match(/designated => (.+)/)![1]!
    assert.equal(requirement(before), requirement(after))
    assert.equal(signatureDetails(binary).teamId, firstIdentity.teamId)
    assert.match(firstIdentity.teamId, /^[A-Z0-9]{10}$/)
    assert.notEqual(before.match(/CDHash=(.+)/)![1], after.match(/CDHash=(.+)/)![1])
    run('/usr/bin/codesign', ['--verify', '--strict', '-R', `=${requirement(before)}`, binary])
  } finally { rmSync(directory, { recursive: true, force: true }) }
})


test('selects the project Apple team and rejects the old local self-signed identity', () => {
  const identities = [
    { fingerprint: 'A'.repeat(40), name: 'Apple Development: Personal', team: 'OTHERTEAM1' },
    { fingerprint: 'B'.repeat(40), name: 'Apple Development: Project', team: 'U8LBJLBYPR' },
  ]
  assert.equal(selectSigningIdentity(identities), 'B'.repeat(40))
  assert.equal(selectSigningIdentity(identities, 'A'.repeat(40)), 'A'.repeat(40))
  assert.throws(() => selectSigningIdentity(identities, 'SkellySpeak Local Development'), /Self-signed/)
  assert.throws(() => selectSigningIdentity(identities, '-'), /Self-signed/)
  assert.throws(() => selectSigningIdentity([...identities, { ...identities[1]!, fingerprint: 'C'.repeat(40) }]), /found 2/)
})
