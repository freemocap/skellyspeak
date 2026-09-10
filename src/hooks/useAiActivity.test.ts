// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiActivity } from './useAiActivity'

const bus = vi.hoisted(() => ({
  starts: [] as ((run: unknown) => void)[],
  ends: [] as ((run: unknown) => void)[],
  unsubscribed: 0,
}))

vi.mock('../lib/tauri', () => ({
  subscribeRunStarts: async (fn: (run: unknown) => void) => {
    bus.starts.push(fn)
    return () => {
      bus.unsubscribed++
    }
  },
  subscribeRuns: async (fn: (run: unknown) => void) => {
    bus.ends.push(fn)
    return () => {
      bus.unsubscribed++
    }
  },
}))

const start = () => act(() => bus.starts.forEach((f) => f({})))
const finish = () => act(() => bus.ends.forEach((f) => f({})))

beforeEach(() => {
  bus.starts = []
  bus.ends = []
  bus.unsubscribed = 0
})

async function mounted() {
  const hook = renderHook(() => useAiActivity())
  // Both subscriptions resolve asynchronously.
  await waitFor(() => expect(bus.starts.length + bus.ends.length).toBe(2))
  return hook
}

describe('knowing when agents are working', () => {
  it('is quiet before anything runs', async () => {
    const { result } = await mounted()
    expect(result.current).toBe(false)
  })

  it('lights up when an operation starts', async () => {
    const { result } = await mounted()
    start()
    expect(result.current).toBe(true)
  })

  it('goes quiet when it finishes', async () => {
    const { result } = await mounted()
    start()
    finish()
    expect(result.current).toBe(false)
  })

  it('stays lit until the LAST of several overlapping runs finishes', async () => {
    // A turn fires eight operations that overlap. Counting, not a flag: the
    // first completion must not switch the light off while the rest are still
    // going, which is precisely what a boolean would have done.
    const { result } = await mounted()
    start()
    start()
    start()
    finish()
    expect(result.current).toBe(true)
    finish()
    expect(result.current).toBe(true)
    finish()
    expect(result.current).toBe(false)
  })

  it('is not latched off by a completion it never saw start', async () => {
    // A run already in flight when this mounts still reports its completion
    // here. A count allowed to go negative would then need extra starts before
    // it lit up again.
    const { result } = await mounted()
    finish()
    finish()
    start()
    expect(result.current).toBe(true)
  })

  it('unsubscribes from both buses on unmount', async () => {
    const { unmount } = await mounted()
    unmount()
    await waitFor(() => expect(bus.unsubscribed).toBe(2))
  })
})
