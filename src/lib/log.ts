import { isTauri } from './tauri'

type Level = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: number
  level: Level
  message: string
}

// In-memory ring buffer feeding the in-app logs overlay.
const LOG_BUFFER: LogEntry[] = []
const MAX_LOGS = 400
const listeners = new Set<(entries: LogEntry[]) => void>()

function record(level: Level, args: unknown[]) {
  const message = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')
  LOG_BUFFER.push({ ts: Date.now(), level, message })
  if (LOG_BUFFER.length > MAX_LOGS) LOG_BUFFER.shift()
  listeners.forEach((fn) => fn(LOG_BUFFER))
}

export function getLogs(): LogEntry[] {
  return LOG_BUFFER
}

export function subscribeLogs(fn: (entries: LogEntry[]) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function clearLogs(): void {
  LOG_BUFFER.length = 0
  listeners.forEach((fn) => fn(LOG_BUFFER))
}

async function toPlugin(level: Level, message: string) {
  if (!isTauri) return
  try {
    const plugin = await import('@tauri-apps/plugin-log')
    const fn =
      level === 'debug'
        ? plugin.debug
        : level === 'warn'
          ? plugin.warn
          : level === 'error'
            ? plugin.error
            : plugin.info
    await fn(message)
  } catch {
    /* logging must never break the app */
  }
}

export function logDebug(...args: unknown[]) {
  record('debug', args)
  console.debug(...args)
  void toPlugin('debug', args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
}

export function logInfo(...args: unknown[]) {
  record('info', args)
  console.log(...args)
  void toPlugin('info', args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
}

export function logWarn(...args: unknown[]) {
  record('warn', args)
  console.warn(...args)
  void toPlugin('warn', args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
}

export function logError(...args: unknown[]) {
  record('error', args)
  console.error(...args)
  void toPlugin('error', args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
}
