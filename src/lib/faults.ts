/// The app's single destination for anything that went wrong.
///
/// A log line is not a user-facing surface. Every failure that is not a
/// 100%-expected part of normal operation goes through `reportFault`, which
/// both logs it and puts it on the screen at the top of the app. There is no
/// other acceptable way to handle an error: no swallowing, no degrading to a
/// lesser code path, no `catch { log }`.

import { logError } from './log'

export interface Fault {
  id: number
  /// Where it happened, in the user's terms — "Speech", "Microphone".
  context: string
  message: string
}

let nextId = 1
let faults: Fault[] = []
const listeners = new Set<(f: Fault[]) => void>()

function emit(): void {
  const snapshot = faults
  listeners.forEach((fn) => fn(snapshot))
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e.replace(/^Error:\s*/, '')
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

/// Record a failure and show it. Always call this in a `catch` — the only
/// permitted alternative is rethrowing so a caller reports it instead.
export function reportFault(context: string, e: unknown): void {
  const message = describe(e)
  logError(`[fault] ${context}: ${message}`)
  faults = [...faults, { id: nextId++, context, message }]
  emit()
}

export function subscribeFaults(fn: (f: Fault[]) => void): () => void {
  listeners.add(fn)
  fn(faults)
  return () => {
    listeners.delete(fn)
  }
}

export function dismissFault(id: number): void {
  faults = faults.filter((f) => f.id !== id)
  emit()
}

export function dismissAllFaults(): void {
  faults = []
  emit()
}
