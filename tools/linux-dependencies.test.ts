import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ensureLinuxDependencies, isDebianFamily, needsLinuxSetup } from './linux-dependencies.ts'

test('setup only applies to native Linux development runs', () => {
  assert.equal(needsLinuxSetup('linux', ['dev']), true)
  for (const args of [['build'], ['info'], ['android', 'dev'], ['dev', '--help'],
    ['dev', '--target', 'aarch64-unknown-linux-gnu'], ['dev', '--target=x86_64-pc-windows-gnu']]) {
    assert.equal(needsLinuxSetup('linux', args), false)
  }
  assert.equal(needsLinuxSetup('darwin', ['dev']), false)
  assert.equal(isDebianFamily('ID=pop\nID_LIKE="ubuntu debian"'), true)
  assert.equal(isDebianFamily('ID=fedora'), false)
})

test('an already configured system needs no privileged commands', () => {
  ensureLinuxDependencies('ID=pop', false, command => {
    assert.equal(command, 'pkg-config')
    return true
  })
})

test('missing dependencies never trigger installation in CI/noninteractive mode', () => {
  assert.throws(() => ensureLinuxDependencies('ID=pop', false, command => {
    assert.equal(command, 'pkg-config')
    return false
  }), /interactive terminal/)
})

test('installs only missing packages and verifies after installation', () => {
  let installed = false
  const privileged: string[][] = []
  ensureLinuxDependencies('ID=pop', true, (command, args) => {
    if (command === 'pkg-config') return installed || args[0] === '--version' || args[1].startsWith('alsa')
    assert.equal(command, 'sudo')
    privileged.push(args)
    if (args[1] === 'install') installed = true
    return true
  })
  assert.deepEqual(privileged, [
    ['apt-get', 'update'],
    ['apt-get', 'install', '--no-remove', '-y', 'libgtk-3-dev', 'libwebkit2gtk-4.1-dev'],
  ])
})

test('installation failure and ineffective installation stop startup', () => {
  assert.throws(() => ensureLinuxDependencies('ID=pop', true, () => false), /installation failed/)
  assert.throws(() => ensureLinuxDependencies('ID=pop', true,
    command => command === 'sudo'), /still fail after installation/)
})

test('unsupported distributions get guidance without invoking sudo', () => {
  assert.throws(() => ensureLinuxDependencies('ID=fedora', true, command => {
    assert.equal(command, 'pkg-config')
    return false
  }), /for your distribution/)
})
