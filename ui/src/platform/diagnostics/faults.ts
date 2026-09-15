/// The app's single destination for anything that went wrong.
///
/// A log line is not a user-facing surface. Every failure that is not a
/// 100%-expected part of normal operation goes through `reportFault`, which
/// both logs it and puts it on the screen at the top of the app. There is no
/// other acceptable way to handle an error: no swallowing, no degrading to a
/// lesser code path, no `catch { log }`.

import { create } from 'zustand'
import { logDiagnostic } from './log'

export interface Fault {
  id: number
  /// Where it happened, in the user's terms — "Speech", "Microphone".
  context: string
  message: string
}

interface FaultState {
  faults: Fault[]
  publish: (fault: Fault) => void
  dismiss: (id: number) => void
  dismissAll: () => void
}

/// This store stays here, beside the logger it writes through, rather than in
/// `state/`. It is the sink every layer reports into — eleven modules across
/// `app/`, `features/` and `platform/` — and one of them,
/// `platform/audio/reward-sounds.ts`, is itself in the platform layer. A home
/// above that layer would force it to import upward.
export const useFaultStore = create<FaultState>((set) => ({
  faults: [],
  publish: (fault) => set((state) => ({ faults: [...state.faults, fault] })),
  dismiss: (id) => set((state) => ({ faults: state.faults.filter((fault) => fault.id !== id) })),
  dismissAll: () => set({ faults: [] }),
}))

let nextId = 1

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
///
/// The fault is published first and written to the durable log after: the log is
/// a report, not a gate. A rejected log becomes its own fault rather than taking
/// the original one down with it.
export function reportFault(context: string, e: unknown): void {
  const message = describe(e)
  const id = nextId++
  useFaultStore.getState().publish({ id, context, message })
  void Promise.resolve(logDiagnostic(context, e, id)).catch(() => {
    // The sink cannot report its own failure through the sink.
    reportDiagnosticBridgeFailure()
  })
}

/** Unhandled errors from diagnostic capture, which has already logged them. An
 * identical fault that is still on screen is not stacked again. */
export function reportUnhandledError(event: Event): void {
  if (!(event instanceof CustomEvent)) throw new Error('Unhandled UI errors arrive as CustomEvent.')
  const message = describe(event.detail)
  const { faults, publish } = useFaultStore.getState()
  if (faults.some(fault => fault.context === 'Unexpected error' && fault.message === message)) return
  publish({ id: nextId++, context: 'Unexpected error', message })
}

/** Sink failures cannot be sent through the failing sink again. */
export function reportDiagnosticBridgeFailure(): void {
  useFaultStore.getState().publish({ id: nextId++, context: 'Diagnostics', message: 'Durable frontend logging failed. Some events were not persisted.' })
}
