import { afterEach, expect, it, vi } from 'vitest'
import { guardDevelopmentMeasures } from './development-measures'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('lists a bounded number of changed props and says how many were left out', () => {
  const recorded = vi.spyOn(performance, 'measure').mockReturnValue(undefined as never)
  const stop = guardDevelopmentMeasures({ rows: 2 })
  try {
    const properties = [['a', '1'], ['b', '2'], ['c', '3'], ['d', '4']]
    const options = { start: 1, end: 2, detail: { devtools: { color: 'primary', properties } } }
    performance.measure('​Spectrogram', options)
    const detail = (recorded.mock.calls[0][1] as PerformanceMeasureOptions).detail
    expect(detail.devtools.properties).toEqual([['a', '1'], ['b', '2'], ['…', '2 more rows omitted']])
    expect(detail.devtools.color).toBe('primary')
    // React reuses its options object; the guard never changes it.
    expect(options.detail.devtools.properties).toHaveLength(4)
    performance.measure('small', { detail: { devtools: { properties: [['a', '1']] } } })
    expect((recorded.mock.calls[1][1] as PerformanceMeasureOptions).detail.devtools.properties).toEqual([['a', '1']])
  } finally { stop() }
})

it('clears recorded measures on an interval and restores the browser method when stopped', () => {
  vi.useFakeTimers()
  const original = performance.measure
  const clear = vi.spyOn(performance, 'clearMeasures')
  const stop = guardDevelopmentMeasures({ intervalMs: 1000 })
  expect(performance.measure).not.toBe(original)
  vi.advanceTimersByTime(3000)
  expect(clear).toHaveBeenCalledTimes(3)
  stop()
  vi.advanceTimersByTime(3000)
  expect(clear).toHaveBeenCalledTimes(3)
  expect(performance.measure).toBe(original)
})
