import { expect, it } from 'vitest'
import { waveformEnvelope } from './waveform-envelope'
it('bounds dense geometry while retaining a one-sample positive and negative peak', () => {
  const samples = Array(74000).fill(0)
  samples[37000] = 1; samples[37001] = -1
  const points = waveformEnvelope(samples, samples.length, 400)
  expect(points.length).toBeLessThanOrEqual(800)
  expect(points.map(([, value]) => value)).toContain(1)
  expect(points.map(([, value]) => value)).toContain(-1)
  expect(points.every(([x], index) => index === 0 || x >= points[index - 1]![0])).toBe(true)
})
it('keeps sparse samples aligned to the right of the recording timeline', () => {
  expect(waveformEnvelope([1, -1], 100, 100)).toEqual([[98, 1], [99, -1]])
  expect(waveformEnvelope([], 100, 100)).toEqual([])
  expect(waveformEnvelope([1], 100, 0)).toEqual([])
})
