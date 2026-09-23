import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LineLog, redactTerminal, runLogged } from './run-log.ts'

test('captures split UTF8 and credentials across chunks, including final unterminated line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    const file = join(dir, 'out.jsonl'); const log = new LineLog(file, 'test', ['private-test-secret'])
    const data = Buffer.from('hola é private-test-secret\nlast line')
    log.write(data.subarray(0, 6)); log.write(data.subarray(6, 17)); log.write(data.subarray(17)); log.close()
    const records = readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    assert.deepEqual(records.map(r => r.message).filter(message => !message.startsWith('[partial write:')), ['hola é [secret redacted]', 'last line'])
    // POSIX mode bits do not describe Windows ACLs.
    if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600)
  } finally { rmSync(dir, { recursive: true }) }
})

test('keeps startup failure output and exit status in a private run directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    const status = await runLogged(dir, process.execPath, ['-e', 'console.log("started"); process.stderr.write("failure without newline"); process.exitCode=7'])
    assert.equal(status, 7)
    const logs = join(dir, '.local/logs'); const run = join(logs, readdirSync(logs)[0])
    if (process.platform !== 'win32') assert.equal(statSync(run).mode & 0o777, 0o700)
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

test('console mirroring masks credentials after a split secret is complete', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    const messages: string[] = []
    const sink = new LineLog(join(dir, 'out.jsonl'), 'stderr', ['private-canary'], message => messages.push(message))
    sink.write(Buffer.from('Connection refused; private-'))
    assert.equal(messages.length, 0)
    sink.write(Buffer.from('canary; OS error 111\n')); sink.close()
    assert.deepEqual(messages, ['Connection refused; [secret redacted]; OS error 111'])
  } finally { rmSync(dir, { recursive: true }) }
})

test('terminal retains actionable locations, content and hashes while persisted diagnostics omit content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    const messages: string[] = []
    const file = join(dir, 'out.jsonl')
    const sink = new LineLog(file, 'stdout', [], message => messages.push(message))
    const lines = [
      '\u001b[32m➜  Local:   http://localhost:1420/\u001b[0m',
      'Listening at http://127.0.0.1:8765/ and http://[::1]:1420/',
      'source: file:///Users/developer/project/main.ts:42',
      'model=example-model; response body="Hola, ¿cómo estás?"',
      `sha256=${'abcdef0123456789'.repeat(4)}`,
    ]
    sink.write(Buffer.from(lines.join('\n') + '\n')); sink.close()
    assert.deepEqual(messages, lines)
    assert.ok(!readFileSync(file, 'utf8').includes('Hola'))
  } finally { rmSync(dir, { recursive: true }) }
})

test('terminal masks credentials without erasing the endpoint or failure reason', () => {
  const clean = redactTerminal('HTTP 401 https://user:pass@example.test/v1?token=query-canary#fragment-canary api_key="key-canary"; Bearer bearer-canary; sk-provider-canary; known-canary', ['known-canary'])
  assert.ok(clean.includes('HTTP 401'))
  assert.ok(clean.includes('example.test/v1'))
  for (const secret of ['user:pass', 'query-canary', 'fragment-canary', 'key-canary', 'bearer-canary', 'sk-provider-canary', 'known-canary']) assert.ok(!clean.includes(secret), secret)
})

test('multiline private keys remain hidden in terminal and persisted logs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-logs-'))
  try {
    const messages: string[] = []
    const file = join(dir, 'out.jsonl')
    const sink = new LineLog(file, 'stdout', [], message => messages.push(message))
    sink.write(Buffer.from('-----BEGIN PRIVATE KEY-----\nshort-key-'))
    sink.write(Buffer.from('canary\n-----END PRIVATE KEY-----\nready\n')); sink.close()
    assert.ok(!messages.join('\n').includes('short-key-canary'))
    assert.ok(!readFileSync(file, 'utf8').includes('short-key-canary'))
    assert.equal(messages.at(-1), 'ready')
  } finally { rmSync(dir, { recursive: true }) }
})
