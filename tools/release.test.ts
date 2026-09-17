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

// Exercise actual Git tag metadata so a lightweight tag cannot accidentally
// inherit the opt-out marker from its commit message.
test('only explicit development tags or manual opt-in bypass the CI suite', async () => {
  const { DEVELOPMENT_RELEASE_MESSAGE } = await import('./release-mode.ts')
  const { readFileSync } = await import('node:fs')
  const directory = mkdtempSync(join(tmpdir(), 'skelly-release-mode-'))
  const modeScript = fileURLToPath(new URL('./release-mode.ts', import.meta.url))
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Release Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Release Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, env, stdio: 'pipe' })
  try {
    git('init', '--initial-branch=main')
    git('-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', DEVELOPMENT_RELEASE_MESSAGE)
    git('-c', 'tag.gpgsign=false', 'tag', 'v1.0.0')
    git('-c', 'tag.gpgsign=false', 'tag', '-a', 'v1.0.1', '-m', 'Ordinary release')
    git('-c', 'tag.gpgsign=false', 'tag', '-a', 'v1.0.2', '-m', DEVELOPMENT_RELEASE_MESSAGE)
    for (const [event, ref, manual, expected] of [
      ['push', 'refs/tags/v1.0.0', 'true', false],
      ['push', 'refs/tags/v1.0.1', '', false],
      ['push', 'refs/tags/v1.0.2', '', true],
      ['workflow_dispatch', 'refs/tags/v1.0.0', 'true', true],
      ['workflow_dispatch', 'refs/tags/v1.0.2', 'false', false],
    ] as const) {
      const output = join(directory, 'output')
      writeFileSync(output, '')
      const result = spawnSync(process.execPath, [modeScript], { cwd: directory, encoding: 'utf8', env: {
        ...env, GITHUB_EVENT_NAME: event, GITHUB_REF: ref, SKIP_TESTS: manual, GITHUB_OUTPUT: output,
      } })
      assert.equal(result.status, 0, result.stderr)
      assert.equal(readFileSync(output, 'utf8'), `skip_checks=${expected}\n`)
    }
    const { skipReleaseChecks } = await import('./release-mode.ts')
    assert.throws(() => skipReleaseChecks('workflow_dispatch', 'refs/heads/main', '', 'true'), /existing version tag/)
    assert.throws(() => skipReleaseChecks('pull_request', 'refs/tags/v1.0.0', '', 'true'), /Unsupported/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('development release dry-run writes nothing and no-push retains the opt-in locally', async () => {
  const { DEVELOPMENT_RELEASE_MESSAGE } = await import('./release-mode.ts')
  const directory = mkdtempSync(join(tmpdir(), 'skelly-release-local-'))
  const checkout = join(directory, 'checkout')
  const remote = join(directory, 'remote.git')
  const env = { ...process.env, GIT_AUTHOR_NAME: 'Release Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Release Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: checkout, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    execFileSync('git', ['init', '--bare', '--initial-branch=main', remote], { stdio: 'pipe' })
    execFileSync('git', ['clone', remote, checkout], { stdio: 'pipe' })
    mkdirSync(join(checkout, 'native'))
    writeFileSync(join(checkout, 'native/Cargo.toml'), '[package]\nversion = "2.0.2"\n')
    git('add', '.')
    git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Prepared version')
    git('push', 'origin', 'main')
    const head = git('rev-parse', 'HEAD')
    for (const option of ['--dry-run', '--no-push']) {
      const result = spawnSync(process.execPath, [script, 'current', '--skip-tests', option], { cwd: checkout, env, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stdout + result.stderr)
      assert.match(result.stdout, /DEVELOPMENT RELEASE/)
      assert.equal(git('rev-parse', 'HEAD'), head)
      assert.equal(git('status', '--porcelain'), '')
      assert.equal(git('ls-remote', '--tags', 'origin'), '')
      if (option === '--dry-run') assert.equal(git('tag', '--list'), '')
    }
    assert.equal(git('cat-file', '-t', 'v2.0.2'), 'tag')
    assert.equal(git('for-each-ref', '--format=%(contents)', 'refs/tags/v2.0.2'), DEVELOPMENT_RELEASE_MESSAGE)
    assert.equal(git('rev-parse', 'v2.0.2^{commit}'), head)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
