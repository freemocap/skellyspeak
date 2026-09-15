// Reset every store between tests.
//
// A Zustand store is a module-level singleton, so state written by one test is
// visible to the next. This wraps `create`/`createStore` to remember each store's
// initial state and restore it in `afterEach` — the pattern Zustand's own
// testing guide documents. Vitest loads this automatically for the `zustand`
// package because `__mocks__` sits beside `node_modules`, so no store has to
// carry a reset hook, export an initial-state constant, or know it is tested.
import { afterEach, vi } from 'vitest'
import type * as ZustandTypes from 'zustand'

export * from 'zustand'

const { create: actualCreate, createStore: actualCreateStore } =
  await vi.importActual<typeof ZustandTypes>('zustand')

interface Resettable {
  getInitialState: () => unknown
  setState: (state: never, replace: true) => void
}

const resets = new Set<() => void>()

function remember(store: Resettable): void {
  const initial = store.getInitialState()
  // Replace rather than merge: a merged reset would leave behind any key a store
  // gained during the test.
  resets.add(() => store.setState(initial as never, true))
}

export const create = ((stateCreator: unknown) =>
  typeof stateCreator === 'function'
    ? (() => { const store = (actualCreate as unknown as (creator: unknown) => Resettable)(stateCreator); remember(store); return store })()
    : (stateCreator: unknown) => { const store = (actualCreate as unknown as (creator: unknown) => Resettable)(stateCreator); remember(store); return store }
) as unknown as typeof ZustandTypes.create

export const createStore = ((stateCreator: unknown) => {
  const store = (actualCreateStore as unknown as (creator: unknown) => Resettable)(stateCreator)
  remember(store)
  return store
}) as unknown as typeof ZustandTypes.createStore

afterEach(() => { resets.forEach(reset => reset()) })
