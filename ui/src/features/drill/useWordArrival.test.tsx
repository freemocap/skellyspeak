// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useWordArrival } from './useWordArrival'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('waits for playback analysis, then lets alignment settle before publishing history', () => {
  vi.useFakeTimers()
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
  const view = renderHook(({ ready }) => useWordArrival('take', ready, 'target'), { initialProps: { ready: false } })
  act(() => vi.advanceTimersByTime(2000))
  expect(view.result.current).toBe('take')
  view.rerender({ ready: true })
  act(() => vi.advanceTimersByTime(449))
  expect(view.result.current).toBe('take')
  act(() => vi.advanceTimersByTime(1))
  expect(view.result.current).toBeNull()
  view.unmount()
})

it('cancels a pending arrival when the target changes', () => {
  vi.useFakeTimers()
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
  const view = renderHook(({ id, scope }) => useWordArrival(id, true, scope), { initialProps: { id: 'take', scope: 'first' } })
  view.rerender({ id: '', scope: 'second' })
  act(() => vi.advanceTimersByTime(2000))
  expect(view.result.current).toBeNull()
  view.unmount()
})
