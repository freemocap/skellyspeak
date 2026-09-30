import { expect, it } from 'vitest'
import type { CoachDecision, CoachObservationView } from '../../generated/contracts'
import { coachFlags, coachMarks } from './coach-marks'

const feedback = (patch: Partial<CoachObservationView>): CoachObservationView => ({ corrections: [], notes: [], meaningRecovered: 'full', items: [], candidatesSent: 0, itemsReturned: 0, ...patch })
const decision = (quote: string): CoachDecision => ({ exposedMove: null, shown: { construct: 'c', quote, move: 'hint', text: 'hint' }, retryInvited: true, alsoNoticed: [], keptGoing: false })

it('flags the shown correction, other corrections and weak observations once each', () => {
  const flags = coachFlags(feedback({
    corrections: [{ construct: 'a', quote: 'son', move: 'explicit', text: 'también' }],
    items: [
      { construct: 'a', quote: 'son', outcome: 'partial', rationale: '' },
      { construct: 'b', quote: 'los tacos', outcome: 'partial', rationale: '' },
      { construct: 'c', quote: 'Me gustan', outcome: 'demonstrated', rationale: '' },
      { construct: 'd', quote: 'aguacates', outcome: 'not_demonstrated', rationale: '' },
      { construct: 'e', quote: 'Sí', outcome: 'uncertain', rationale: '' },
    ],
  }), decision('son'))
  expect(flags).toEqual([{ quote: 'son', severity: 'error' }, { quote: 'los tacos', severity: 'partial' }, { quote: 'aguacates', severity: 'error' }])
})

it('flags nothing without coaching', () => {
  expect(coachFlags(undefined, undefined)).toEqual([])
  expect(coachFlags(feedback({}), { ...decision('x'), shown: null })).toEqual([])
})

it('marks the first exact occurrence and skips quotes the message lacks', () => {
  const source = 'Me gustan… son… los tacos.'
  expect(coachMarks(source, [{ quote: 'son', severity: 'error' }, { quote: 'burritos', severity: 'error' }])).toEqual([{ start: 11, end: 14, severity: 'error' }])
})

it('lets an error win where marks overlap', () => {
  const source = 'yo fue ayer'
  expect(coachMarks(source, [{ quote: 'yo fue', severity: 'partial' }, { quote: 'fue ayer', severity: 'error' }])).toEqual([
    { start: 0, end: 3, severity: 'partial' },
    { start: 3, end: 11, severity: 'error' },
  ])
})
