import { describe, expect, it } from 'vitest'
import type { Profile, TeachingPlan } from '../types'
import { normalizeDocs } from './normalize'

describe('normalizeDocs', () => {
  it('fills missing arrays and fields so renders cannot crash', () => {
    const norm = normalizeDocs({} as TeachingPlan, {} as Profile)
    expect(norm.plan.session_focus).toEqual([])
    expect(norm.plan.correction_budget).toBe(1)
    expect(norm.plan.taught_ledger).toEqual([])
    expect(norm.profile.sessions).toBe(0)
    expect(norm.profile.long_term_errors).toEqual([])
  })

  it('preserves present values', () => {
    const plan = { session_focus: ['a'], correction_budget: 2 } as unknown as TeachingPlan
    const profile = { about: 'me', sessions: 3 } as unknown as Profile
    const norm = normalizeDocs(plan, profile)
    expect(norm.plan.session_focus).toEqual(['a'])
    expect(norm.plan.correction_budget).toBe(2)
    expect(norm.profile.about).toBe('me')
    expect(norm.profile.sessions).toBe(3)
  })
})

describe('the not-applicable sentinel', () => {
  it('never reaches the learner', () => {
    // Strict schemas require every field, so a model with nothing to say
    // writes the sentinel. It must read as empty, not as content.
    const norm = normalizeDocs(
      {
        session_focus: ['greetings', 'not applicable'],
        recurring_errors: [],
        vocab_recycle: ['Not Applicable'],
        avoid: [],
        learner_interests: [],
        energy_read: 'not applicable',
        correction_budget: 1,
        taught_ledger: [],
      } as never,
      {
        about: '  Not applicable  ',
        level_notes: 'A2 with evidence',
        strengths: [],
        weaknesses: [],
        interests: [],
        long_term_errors: [],
        sessions: 0,
      } as never
    )
    expect(norm.plan.session_focus).toEqual(['greetings'])
    expect(norm.plan.vocab_recycle).toEqual([])
    expect(norm.plan.energy_read).toBe('')
    expect(norm.profile.about).toBe('')
    expect(norm.profile.level_notes).toBe('A2 with evidence')
  })
})
