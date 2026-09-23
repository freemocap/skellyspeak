import { expect, it } from 'vitest'
import type { InspectionActivity } from '../../generated/contracts'
import { speechTiming } from './timing'

const activity = (regions: [number, number][], pauses: number[]): InspectionActivity => ({
  algorithm: 'fixture', noiseFloorDbfs: -60, thresholdDbfs: -50, limitations: [],
  regions: regions.map(([start, end]) => ({ start, end })),
  pauses: pauses.map((duration, index) => ({ start: index, duration })),
})

it('sums detected speech, counts only inner pauses and derives a pace', () => {
  const timing = speechTiming(activity([[0.1, 0.9], [1.3, 2.5]], [0.4]), 5)
  expect(timing.speaking).toBeCloseTo(2)
  expect(timing.pauses).toBe(1)
  expect(timing.longestPause).toBe(0.4)
  expect(timing.wordsPerSecond).toBeCloseTo(2.5)
})

it('reports no pace for silence and refuses impossible input', () => {
  expect(speechTiming(activity([], []), 3)).toEqual({ speaking: 0, pauses: 0, longestPause: null, wordsPerSecond: null })
  expect(() => speechTiming(activity([[2, 1]], []), 1)).toThrow()
  expect(() => speechTiming(activity([], []), -1)).toThrow()
})
