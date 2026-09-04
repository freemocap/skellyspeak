// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createStore, useStore } from './store'

describe('the shared observable value', () => {
  it('hands back what was put in', () => {
    const store = createStore(3)
    expect(store.get()).toBe(3)
    store.set(7)
    expect(store.get()).toBe(7)
  })

  it('tells every listener, not just the first', () => {
    const store = createStore('a')
    const one = vi.fn()
    const two = vi.fn()
    store.subscribe(one)
    store.subscribe(two)
    store.set('b')
    expect(one).toHaveBeenCalledTimes(1)
    expect(two).toHaveBeenCalledTimes(1)
  })

  it('stops telling a listener that unsubscribed', () => {
    const store = createStore(0)
    const seen = vi.fn()
    const off = store.subscribe(seen)
    store.set(1)
    off()
    store.set(2)
    expect(seen).toHaveBeenCalledTimes(1)
    expect(store.get()).toBe(2)
  })

  it('says nothing when the value did not actually change', () => {
    // `useSyncExternalStore` re-reads the snapshot on every notification, so
    // notifying without a change is wasted renders at best.
    const store = createStore('same')
    const seen = vi.fn()
    store.subscribe(seen)
    store.set('same')
    expect(seen).not.toHaveBeenCalled()
  })

  it('treats an equal-looking but distinct object as a change', () => {
    // Identity, not deep equality: the store cannot know whether a new object
    // with the same fields is meaningful, and guessing would drop real updates.
    const store = createStore({ n: 1 })
    const seen = vi.fn()
    store.subscribe(seen)
    store.set({ n: 1 })
    expect(seen).toHaveBeenCalledTimes(1)
  })
})

describe('reading a store from a component', () => {
  it('renders the current value and follows changes', () => {
    const store = createStore(1)
    const { result } = renderHook(() => useStore(store))
    expect(result.current).toBe(1)
    act(() => store.set(2))
    expect(result.current).toBe(2)
  })

  it('does not re-render when an identical value is set', () => {
    const store = createStore('x')
    const renders = vi.fn()
    const { result } = renderHook(() => {
      renders()
      return useStore(store)
    })
    const before = renders.mock.calls.length
    act(() => store.set('x'))
    expect(renders.mock.calls.length).toBe(before)
    expect(result.current).toBe('x')
  })

  it('survives a snapshot read on every notification without looping', () => {
    // The classic useSyncExternalStore trap: a getSnapshot that builds a fresh
    // object each call re-renders forever. This store returns the stored
    // reference, so a burst of sets settles instead of spinning.
    const store = createStore<{ items: number[] }>({ items: [] })
    const renders = vi.fn()
    renderHook(() => {
      renders()
      return useStore(store)
    })
    act(() => {
      for (let i = 0; i < 5; i++) store.set({ items: [i] })
    })
    // Batched into one commit, not five, and emphatically not unbounded.
    expect(renders.mock.calls.length).toBeLessThan(5)
  })

  it('lets two components read one value', () => {
    // The whole reason this exists: the gate controls and the paused banner
    // must never hold two different answers to "is the pipeline paused".
    const store = createStore(false)
    const a = renderHook(() => useStore(store))
    const b = renderHook(() => useStore(store))
    act(() => store.set(true))
    expect(a.result.current).toBe(true)
    expect(b.result.current).toBe(true)
  })
})
