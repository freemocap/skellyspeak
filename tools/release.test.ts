import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

const script = fileURLToPath(new URL('./release.ts', import.meta.url))

test('release preflight rejects unsupported versions before fetching or writing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'skelly-release-'))
  try {
    execFileSync('git', ['init', '--initial-branch=main', directory], { stdio: 'pipe' })
    mkdirSync(join(directory, 'native'))
    writeFileSync(join(directory, 'native/Cargo.toml'), '[package]\nversion = "1.21.4"\n')
    for (const [args, message] of [
      [['1.22.0-rc.1', '--dry-run'], 'stable x.y.z'],
      [['01.22.0', '--dry-run'], 'stable x.y.z'],
      [['1.1000.0', '--dry-run'], 'Android versionCode'],
      [['2101.0.0', '--dry-run'], 'Android versionCode'],
      [['patch', 'minor'], 'usage:'],
      [['patch', '--unknown'], 'unknown option'],
      [['1.21.4'], 'not newer'],
    ] as const) {
      const result = spawnSync(process.execPath, [script, ...args], { cwd: directory, encoding: 'utf8' })
      assert.equal(result.status, 1, result.stderr)
      assert.ok(result.stderr.includes(message), result.stderr)
      assert.ok(!result.stdout.includes('fetching'))
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
