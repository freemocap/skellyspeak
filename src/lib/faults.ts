/// The app's single destination for anything that went wrong.
///
/// A log line is not a user-facing surface. Every failure that is not a
/// 100%-expected part of normal operation goes through `reportFault`, which
/// both logs it and puts it on the screen at the top of the app. There is no
/// other acceptable way to handle an error: no swallowing, no degrading to a
/// lesser code path, no `catch { log }`.

import { logError } from './log'
import { createStore, useStore } from './store'

export interface Fault {
  id: number
  /// Where it happened, in the user's terms — "Speech", "Microphone".
  context: string
  message: string
}

let nextId = 1
// The same observable primitive the pipeline gate uses. This module grew its
// own by hand first; a second copy for the gate is what made it worth sharing.
const store = createStore<Fault[]>([])

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
  store.set([...store.get(), { id: nextId++, context, message }])
}

/// Subscribe a component to the fault list.
export function useFaults(): Fault[] {
  return useStore(store)
}

/// For callers outside React. Fires immediately with the current list, as it
/// always has.
export function subscribeFaults(fn: (f: Fault[]) => void): () => void {
  const unsubscribe = store.subscribe(() => fn(store.get()))
  fn(store.get())
  return unsubscribe
}

export function dismissFault(id: number): void {
  store.set(store.get().filter((f) => f.id !== id))
}

export function dismissAllFaults(): void {
  store.set([])
}
