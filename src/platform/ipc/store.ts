import { useSyncExternalStore } from 'react'

/// A minimal observable value, shared across components.
///
/// This is the shape `faults.ts` grew by hand. A second hand-rolled copy is how
/// two components end up holding two copies of one truth. One implementation.
///
/// Read with `useStore`, which is built on React's `useSyncExternalStore` —
/// the primitive that exists for exactly this. A `useEffect` + `useState`
/// subscription per component works, but every consumer then opens its own
/// subscription and does its own initial fetch, which is what went wrong here.
///
/// No Zustand or Redux, deliberately: at this size a dependency would buy an
/// API rather than a capability. The threshold for revisiting that — a third
/// store, or a store that needs selectors — is recorded in
/// `workflow/state-migration-plan.md`.
export interface Store<T> {
  get: () => T
  set: (next: T) => void
  /// Returns an unsubscribe function.
  subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()

  return {
    get: () => value,
    set: (next: T) => {
      // Reference equality is the contract `useSyncExternalStore` relies on:
      // a snapshot that returns a fresh object every read re-renders forever.
      // So the value is replaced, never mutated, and an identical reference
      // is treated as no change at all.
      if (Object.is(next, value)) return
      value = next
      listeners.forEach((fn) => fn())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/// Subscribe a component to a store.
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}
