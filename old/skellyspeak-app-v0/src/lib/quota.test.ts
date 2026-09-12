import { describe, expect, it } from 'vitest'
import { resetsAtLocalTime } from './quota'

describe('when the hosted allowance resets, locally', () => {
  it('is the next 00:00 UTC, not the next local midnight', () => {
    // 2026-09-03 18:00 UTC. The next reset is 2026-09-04 00:00 UTC, six hours
    // later — whatever local midnight happens to be.
    const now = new Date('2026-09-03T18:00:00Z')
    const next = new Date(now)
    next.setUTCHours(24, 0, 0, 0)
    expect(next.toISOString()).toBe('2026-09-04T00:00:00.000Z')
    expect(resetsAtLocalTime(now)).toBe(
      next.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    )
  })

  it('rolls to tomorrow even one minute after a reset', () => {
    const justAfter = new Date('2026-09-03T00:01:00Z')
    const expected = new Date('2026-09-04T00:00:00Z')
    expect(resetsAtLocalTime(justAfter)).toBe(
      expected.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    )
  })

  it('gives the same clock time whatever the moment', () => {
    // The reset is a fixed UTC instant, so its local time of day does not
    // wander through the day — that is what makes it worth showing at all.
    const morning = resetsAtLocalTime(new Date('2026-09-03T02:00:00Z'))
    const evening = resetsAtLocalTime(new Date('2026-09-03T22:00:00Z'))
    expect(morning).toBe(evening)
  })
})
