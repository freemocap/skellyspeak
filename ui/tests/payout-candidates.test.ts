import { expect, it } from 'vitest'
import { PAYOUT_CANDIDATES, renderPayoutCandidate, type PayoutCandidate } from '../tools/payout-candidates'

it('renders bounded, finite bursts with silent edges for every comparison size', () => {
  for (const kind of Object.keys(PAYOUT_CANDIDATES) as PayoutCandidate[]) for (const count of [1, 3, 12, 24, 32]) {
    const data = renderPayoutCandidate(kind, count)
    expect(data.length / 48000).toBeLessThan(2.3)
    expect(data[0]).toBe(0)
    expect(data.at(-1)).toBe(0)
    let peak = 0
    for (const value of data) { expect(Number.isFinite(value)).toBe(true); peak = Math.max(peak, Math.abs(value)) }
    expect(peak).toBeGreaterThan(.02)
    expect(peak).toBeLessThan(.5)
  }
})
it('rejects invalid payout counts', () => {
  for (const count of [0, -1, 1.5, 33, NaN]) expect(() => renderPayoutCandidate('chime', count)).toThrow()
})
