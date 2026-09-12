/// The app's single destination for anything that went wrong.
///
/// A log line is not a user-facing surface. Every failure that is not a
/// 100%-expected part of normal operation goes through `reportFault`, which
/// both logs it and puts it on the screen at the top of the app. There is no
/// other acceptable way to handle an error: no swallowing, no degrading to a
/// lesser code path, no `catch { log }`.

import { logDiagnostic } from './log'
import { createStore, useStore } from '../ipc/store'

export interface Fault {
  id: number
  /// Where it happened, in the user's terms — "Speech", "Microphone".
  context: string
  message: string
}

let nextId = 1
// One observable value: React reads it through `useFaults`, and non-React
// callers through `subscribeFaults`.
const store = createStore<Fault[]>([])

function describe(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string') return e.message
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
  const id = nextId++
  void Promise.resolve(logDiagnostic(context, e, id)).then(() => {
    store.set([...store.get(), { id, context, message }])
  })
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

/** Unhandled errors from diagnostic capture, which has already logged them. An
 * identical fault that is still on screen is not stacked again. */
export function reportUnhandledError(event: Event): void {
  if (!(event instanceof CustomEvent)) throw new Error('Unhandled UI errors arrive as CustomEvent.')
  const message = describe(event.detail)
  if (store.get().some(fault => fault.context === 'Unexpected error' && fault.message === message)) return
  store.set([...store.get(), { id: nextId++, context: 'Unexpected error', message }])
}

/** Sink failures cannot be sent through the failing sink again. */
export function reportDiagnosticBridgeFailure(): void {
  store.set([...store.get(), { id: nextId++, context: 'Diagnostics', message: 'Durable frontend logging failed. Some events were not persisted.' }])
}
