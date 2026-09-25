import { expect, it } from 'vitest'
import { DEFAULT_PAYOUT_TIMING, payoutOnsets } from '../tools/payout-timing'
it('keeps the default twelve-coin cadence and changes its speed and contour', () => {
  expect(payoutOnsets(DEFAULT_PAYOUT_TIMING)).toEqual(Array.from({ length: 12 }, (_, index) => index * 120))
  const times = payoutOnsets({ ...DEFAULT_PAYOUT_TIMING, shape: 'accelerate' })
  expect(times[1]).toBeGreaterThan(times[11] - times[10])
  const reverse = payoutOnsets({ ...DEFAULT_PAYOUT_TIMING, shape: 'decelerate' })
  expect(reverse[1]).toBeLessThan(reverse[11] - reverse[10])
})
it('bounds irregular intervals and rejects invalid timing', () => {
  for (const distribution of ['uniform', 'centered', 'smooth'] as const) {
    const times = payoutOnsets({ ...DEFAULT_PAYOUT_TIMING, shape: 'swing', intervalMs: 40, strength: 80, variation: 80, distribution }, () => 0)
    expect(times).toHaveLength(12)
    times.slice(1).forEach((time, index) => expect(time - times[index]).toBeGreaterThanOrEqual(30 - 1e-9))
  }
  expect(() => payoutOnsets({ ...DEFAULT_PAYOUT_TIMING, intervalMs: NaN })).toThrow()
})
