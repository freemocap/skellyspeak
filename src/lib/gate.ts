import {
  gatePause,
  gateResume,
  gateStatus,
  gateStep,
  subscribeGate,
  isTauri,
  type GateStatus,
} from './tauri'
import { reportFault } from './faults'
import { createStore, useStore } from './store'

/// Whether the agent pipeline is paused — one copy, for the whole app.
///
/// Two components need this: the controls in the graph view, and the banner at
/// the top of the app that stops a paused pipeline from reading as a hung one.
/// They each used to fetch the status and open their own event subscription,
/// which is two IPC calls, two listeners, and two versions of one fact that
/// could disagree.
///
/// The core is the authority. Every mutation here returns the new status from
/// Rust and stores THAT, rather than guessing what the state became — the gate
/// holds real work, and a UI that assumed "paused" while the pipeline was
/// running would be lying about whether the model is being called.
///
/// If a third or fourth store appears — or one needs selectors to avoid
/// re-rendering on unrelated fields — that is the point to reach for Zustand.
/// At this size a library would be an API, not a capability.

const EMPTY: GateStatus = { paused: false, budget: 0, waiting: [] }

const store = createStore<GateStatus>(EMPTY)

let started = false

/// Begin tracking the core's gate. Idempotent, so any number of components may
/// call it; only the first opens the subscription.
export function startGateTracking(): void {
  if (started || !isTauri) return
  started = true

  void gateStatus()
    .then(store.set)
    .catch((e: unknown) => reportFault('Reading the pipeline gate', e))

  // Never unsubscribed: the gate is app-wide state and the listener lives as
  // long as the window does. Tearing it down when the last component unmounts
  // would mean the banner missed a pause that happened while the graph view
  // was closed — which is precisely the case it exists for.
  void subscribeGate(store.set).catch((e: unknown) =>
    reportFault('Watching the pipeline gate', e)
  )
}

export function useGate(): GateStatus {
  return useStore(store)
}

/// The three actions. Each stores the status the core reports back, and
/// surfaces its own failure — a Pause that quietly did nothing would be
/// exactly the lie these controls exist not to tell.
export function pausePipeline(): void {
  void gatePause()
    .then(store.set)
    .catch((e: unknown) => reportFault('Pausing the pipeline', e))
}

export function resumePipeline(): void {
  void gateResume()
    .then(store.set)
    .catch((e: unknown) => reportFault('Resuming the pipeline', e))
}

export function stepPipeline(count = 1): void {
  void gateStep(count)
    .then(store.set)
    .catch((e: unknown) => reportFault('Stepping the pipeline', e))
}
