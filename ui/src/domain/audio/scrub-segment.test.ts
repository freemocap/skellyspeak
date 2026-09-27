import { expect, it } from 'vitest'
import { scrubTime } from './scrub-segment'

it('uses displayed seconds when a same-scale track extends beyond its audio', () => {
  expect(scrubTime(0.25, 4, 8)).toBe(2)
  expect(scrubTime(0.75, 4, 8)).toBe(4)
})

it('round trips piecewise word alignment and intermediate animation without timeline drift', () => {
  const aligned = (time: number) => time <= 2 ? time / 2 : 1 + (time - 2) * 2
  for (const blend of [0, 0.2, 0.5, 1]) {
    const map = (time: number) => (time / 4 * (1 - blend) + aligned(time) / 5 * blend) * 5
    for (const time of [0, 0.1, 1, 2, 2.5, 3.9, 4]) {
      expect(scrubTime(map(time) / 5, 4, 5, map)).toBeCloseTo(time, 8)
    }
  }
})
