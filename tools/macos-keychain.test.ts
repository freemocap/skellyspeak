import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { ensureDevelopmentSignature, signingIdentity, signatureDetails } from './macos-signing.ts'

test('rebuilt Apple-signed app reads its disposable Keychain item with interaction disabled', {
  skip: process.platform !== 'darwin' || process.env.SKELLYSPEAK_TEST_SIGNING !== '1',
}, () => {
  const directory = mkdtempSync(join(tmpdir(), 'skellyspeak-keychain-'))
  const service = `skellyspeak-signing-test-${randomUUID()}`
  const source = fileURLToPath(new URL('./fixtures/keychain-reload.c', import.meta.url))
  const first = join(directory, 'first')
  const second = join(directory, 'second')
  let created = false
  const run = (command: string, args: string[]) => {
    const result = spawnSync(command, args, { encoding: 'utf8' })
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`)
    return result.stdout
  }
  try {
    const certificate = signingIdentity()
    for (const [index, binary] of [first, second].entries()) {
      run('/usr/bin/clang', ['-Wno-deprecated-declarations', '-framework', 'Security', '-framework', 'CoreFoundation', `-DBUILD_MARKER=${index + 1}`, source, '-o', binary])
      ensureDevelopmentSignature(binary, certificate)
    }
    const before = signatureDetails(first)
    const after = signatureDetails(second)
    assert.equal(before.teamId, after.teamId)
    assert.equal(before.requirement, after.requirement)
    assert.notEqual(before.codeHash, after.codeHash)
    run(first, ['create', service]); created = true
    assert.match(run(first, ['read', service]), /status=0/)
    assert.match(run(second, ['read', service]), /status=0/)
    assert.match(run(second, ['read', service]), /status=0/)
  } finally {
    // Retain the signed cleanup executable if deletion fails, so cleanup stays possible.
    if (created) run(first, ['delete', service])
    rmSync(directory, { recursive: true, force: true })
  }
})
