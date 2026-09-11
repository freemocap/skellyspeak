import { expect, it } from 'vitest'
import { interactionKey, mergeRuns } from './activity'
import type { Run } from '../../types'
it('does not merge unrelated standalone calls into a single interaction', () => {
  expect(interactionKey({ id: 1, turn_id: null })).not.toBe(interactionKey({ id: 2, turn_id: null }))
  expect(interactionKey({ id: 1, turn_id: 4 })).toBe(interactionKey({ id: 2, turn_id: 4 }))
})
it('deduplicates snapshot/event overlap and orders runs by start time', () => {
  const a = { id: 1, started_at_ms: 1 } as Run
  const b = { id: 2, started_at_ms: 2 } as Run
  expect(mergeRuns([b], [a, b])).toEqual([a, b])
})
