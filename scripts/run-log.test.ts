import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LineLog, runLogged } from './run-log.ts'

test('captures split UTF8 and credentials across chunks, including final unterminated line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    const file = join(dir, 'out.jsonl'); const log = new LineLog(file, 'test', ['private-test-secret'])
    const data = Buffer.from('hola é private-test-secret\nlast line')
    log.write(data.subarray(0, 6)); log.write(data.subarray(6, 17)); log.write(data.subarray(17)); log.close()
    const records = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(records.map(r => r.message).filter(message => !message.startsWith('[partial write:')), ['hola é [REDACTED]', 'last line'])
    assert.equal(statSync(file).mode & 0o777, 0o600)
  } finally { rmSync(dir, { recursive: true }) }
})

test('keeps startup failure output and exit status in a private run directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    const status = await runLogged(dir, process.execPath, ['-e', 'console.log("started"); process.stderr.write("failure without newline"); process.exitCode=7'])
    assert.equal(status, 7)
    const logs = join(dir, '.local/logs'); const run = join(logs, readdirSync(logs)[0])
    assert.equal(statSync(run).mode & 0o777, 0o700)
    assert.match(readFileSync(join(run, 'stdout.jsonl'), 'utf8'), /started/)
    assert.match(readFileSync(join(run, 'stderr.jsonl'), 'utf8'), /failure without newline/)
    assert.match(readFileSync(join(run, 'launcher.jsonl'), 'utf8'), /closed code=7/)
  } finally { rmSync(dir, { recursive: true }) }
})

test('records partial arrival immediately and bounds oversized lines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    const file = join(dir, 'out.jsonl')
    const log = new LineLog(file, 'test', [])
    log.write(Buffer.from('x'.repeat(1024 * 1024)))
    assert.ok(readFileSync(file, 'utf8').length > 0)
    assert.ok(readFileSync(file, 'utf8').length < 1024)
    log.write(Buffer.from('\nnext\n'))
    log.close()
    assert.match(readFileSync(file, 'utf8'), /oversized line/)
    assert.match(readFileSync(file, 'utf8'), /next/)
  } finally { rmSync(dir, { recursive: true }) }
})

test('records a missing executable without leaving the launcher pending', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    assert.equal(await runLogged(dir, join(dir, 'missing'), []), 1)
    const logs = join(dir, '.local/logs')
    const run = join(logs, readdirSync(logs)[0])
    assert.match(readFileSync(join(run, 'launcher.jsonl'), 'utf8'), /spawn failed/)
  } finally { rmSync(dir, { recursive: true }) }
})
