import { spawn } from 'node:child_process'
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'

function privateDirectory(path: string): void {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Log directory cannot be a symbolic link.')
  mkdirSync(path, { recursive: true, mode: 0o700 })
  chmodSync(path, 0o700)
}

const privacy = JSON.parse(readFileSync(new URL('../content/diagnostics/policy.json', import.meta.url), 'utf8')) as {
  secretTag: string; contentTag: string; rules: { pattern: string; flags: string; kind: string; prefix?: boolean }[]
}
export function redactLog(text: string, secrets: string[]): string {
  let result = text
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) result = result.split(secret).join(privacy.secretTag)
  for (const rule of privacy.rules) result = result.replace(new RegExp(rule.pattern, `${rule.flags}g`), `${rule.prefix ? '$1' : ''}${rule.kind === 'secret' ? privacy.secretTag : privacy.contentTag}`)
  return result
}

/** Sink failures cannot report to their own failed sink. Keep OS identity on stderr. */
function sinkError(stage: string, error: unknown): void {
  const value = error as NodeJS.ErrnoException
  console.error(JSON.stringify({ stage, name: value?.name, code: value?.code, errno: value?.errno, syscall: value?.syscall }))
}

/** Write complete lines synchronously; preserve an unterminated final line at close. */
export class LineLog {
  private decoder = new StringDecoder('utf8')
  private pending = ''
  private sequence = 0
  private oversized = false
  private fd: number
  private source: string
  private secrets: string[]
  private mirror?: (message: string) => void
  constructor(path: string, source: string, secrets: string[], mirror?: (message: string) => void) {
    this.source = source; this.secrets = secrets; this.mirror = mirror
    this.fd = openSync(path, 'wx', 0o600)
  }
  private line(message: string): void {
    const clean = redactLog(message, this.secrets)
    const bytes = Buffer.from(JSON.stringify({ timestamp: new Date().toISOString(), sequence: ++this.sequence, source: this.source, message: clean }) + '\n')
    let offset = 0
    while (offset < bytes.length) offset += writeSync(this.fd, bytes, offset, bytes.length - offset)
    if (!message.startsWith('[partial write:')) this.mirror?.(clean)
  }
  write(chunk: Buffer): void {
    const parts = this.decoder.write(chunk).split('\n')
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]
      if (this.pending.length + part.length > 65536) {
        this.oversized = true
        this.pending = ''
      }
      if (!this.oversized) this.pending += part
      if (index < parts.length - 1) {
        this.line(this.oversized ? '[REDACTED oversized line: exceeded 65536 characters]' : this.pending)
        this.pending = ''
        this.oversized = false
      } else if (part.length) {
        // Record arrival immediately, without exposing a credential split across
        // writes. The completed line follows separately when its newline arrives.
        this.line(`[partial write: ${part.length} characters; body withheld until line completion]`)
      }
    }
  }
  close(): void {
    this.pending += this.decoder.end()
    try {
      if (this.oversized) this.line('[REDACTED oversized final line]')
      else if (this.pending) this.line(this.pending)
    } finally { closeSync(this.fd) }
  }
}

export async function runLogged(root: string, command: string, args: string[], kind: 'app' | 'server' | 'process' = 'app'): Promise<number> {
  const local = resolve(root, '.local'); privateDirectory(local)
  const logs = resolve(local, 'logs'); privateDirectory(logs)
  const runId = `${kind}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
  const directory = resolve(logs, runId); privateDirectory(directory)
  const secrets = Object.entries(process.env).filter(([name]) => /(?:KEY|TOKEN|SECRET|PASSWORD)/i.test(name)).map(([, value]) => value ?? '')
  const out = new LineLog(resolve(directory, 'stdout.jsonl'), 'process.stdout', secrets, message => process.stdout.write(message + '\n'))
  const err = new LineLog(resolve(directory, 'stderr.jsonl'), 'process.stderr', secrets, message => process.stderr.write(message + '\n'))
  const manifest = new LineLog(resolve(directory, 'launcher.jsonl'), 'launcher', secrets)
  let failure = false
  const note = (message: string) => {
    try { manifest.write(Buffer.from(message + '\n')) }
    catch (error) { failure = true; sinkError('launcher_write', error) }
  }
  console.log(`Run logs: ${directory}`)
  note(`starting pid=${process.pid}; stdout/stderr are line records with credential redaction; no automatic retention deletion`)
  if (failure) {
    for (const sink of [out, err, manifest]) { try { sink.close() } catch { /* Failure already reported. */ } }
    return 1
  }
  const child = spawn(command, args, { cwd: root, env: { ...process.env, SKELLYSPEAK_LOG_RUN_DIR: directory }, stdio: ['inherit', 'pipe', 'pipe'] })
  const sinkFailure = (error: unknown) => { failure = true; sinkError('process_log_write', error); child.kill('SIGTERM') }
  child.stdout.on('data', (chunk: Buffer) => { try { out.write(chunk) } catch (error) { sinkFailure(error) } })
  child.stderr.on('data', (chunk: Buffer) => { try { err.write(chunk) } catch (error) { sinkFailure(error) } })
  const interrupt = () => child.kill('SIGINT')
  const terminate = () => child.kill('SIGTERM')
  process.once('SIGINT', interrupt); process.once('SIGTERM', terminate)
  let status = 1
  try {
    await new Promise<void>(resolveExit => {
      child.once('error', error => { failure = true; note(`spawn failed: ${error.message}`) })
      child.once('close', (code, signal) => {
        note(`closed code=${code} signal=${signal}; childPid=${child.pid ?? 'unavailable'}`)
        status = code ?? 1
        resolveExit()
      })
    })
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate)
    for (const sink of [out, err, manifest]) {
      try { sink.close() } catch (error) { failure = true; sinkError('log_finalize', error) }
    }
  }
  return failure ? 1 : status
}
