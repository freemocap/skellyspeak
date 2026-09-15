import { spawn } from 'node:child_process'
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'

function privateDirectory(path: string): void {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Log directory cannot be a symbolic link.')
  mkdirSync(path, { recursive: true, mode: 0o700 })
  chmodSync(path, 0o700)
}

export function redactLog(text: string, secrets: string[]): string {
  let result = text
  for (const secret of secrets) if (secret.length >= 8) result = result.split(secret).join('[REDACTED]')
  return result.replace(/\bBearer\s+[^\s"',}]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, '[REDACTED]')
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
  constructor(path: string, source: string, secrets: string[]) {
    this.source = source; this.secrets = secrets
    this.fd = openSync(path, 'wx', 0o600)
  }
  private line(message: string): void {
    const bytes = Buffer.from(JSON.stringify({ timestamp: new Date().toISOString(), sequence: ++this.sequence, source: this.source, message: redactLog(message, this.secrets) }) + '\n')
    let offset = 0
    while (offset < bytes.length) offset += writeSync(this.fd, bytes, offset, bytes.length - offset)
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
  const out = new LineLog(resolve(directory, 'stdout.jsonl'), 'process.stdout', secrets)
  const err = new LineLog(resolve(directory, 'stderr.jsonl'), 'process.stderr', secrets)
  const manifest = new LineLog(resolve(directory, 'launcher.jsonl'), 'launcher', secrets)
  let failure = false
  const note = (message: string) => {
    try { manifest.write(Buffer.from(message + '\n')) }
    catch { failure = true; console.error('Launcher log write failed.') }
  }
  console.log(`Run logs: ${directory}`)
  note(`starting pid=${process.pid}; stdout/stderr are line records with credential redaction; no automatic retention deletion`)
  if (failure) {
    for (const sink of [out, err, manifest]) { try { sink.close() } catch { /* Failure already reported. */ } }
    return 1
  }
  const child = spawn(command, args, { cwd: root, env: { ...process.env, SKELLYSPEAK_LOG_RUN_DIR: directory }, stdio: ['inherit', 'pipe', 'pipe'] })
  const sinkFailure = () => { failure = true; console.error('Log file write failed; stopping development process.'); child.kill('SIGTERM') }
  child.stdout.on('data', (chunk: Buffer) => { try { out.write(chunk); process.stdout.write(chunk) } catch { sinkFailure() } })
  child.stderr.on('data', (chunk: Buffer) => { try { err.write(chunk); process.stderr.write(chunk) } catch { sinkFailure() } })
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
      try { sink.close() } catch { failure = true; console.error('Log finalization failed.') }
    }
  }
  return failure ? 1 : status
}
