import { describe, expect, it } from 'vitest'
import { chatHistory, latestAnswered, latestScaffolds, transcriptForCoach } from './turns'
import type { GuidedTurnResult, Scaffolds, StoredTurn } from '../types'

const scaffolds = (over: Partial<Scaffolds> = {}): Scaffolds => ({
  replies: [],
  frames: [],
  starters: [],
  ...over,
})

const answer = (reply: string, s: Scaffolds = scaffolds()): GuidedTurnResult => ({
  reply,
  translation: null,
  tokens: [],
  user_tokens: [],
  user_translation: null,
  mechanics: [],
  scaffolds: s,
  errors: [],
})

const turn = (id: number, user: string | null, reply: string | null, s?: Scaffolds): StoredTurn => ({
  id,
  user,
  assistant: reply === null ? null : answer(reply, s),
  analysisState: reply === null ? null : 'done',
})

describe('chatHistory', () => {
  it('flattens turns into alternating messages, oldest first', () => {
    expect(chatHistory([turn(1, 'Hola', 'Buenos días'), turn(2, '¿Qué tal?', 'Muy bien')], 30)).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Buenos días' },
      { role: 'user', content: '¿Qué tal?' },
      { role: 'assistant', content: 'Muy bien' },
    ])
  })

  it('omits a turn that is still streaming', () => {
    // Sending a half-formed exchange would have the tutor answer something it
    // never said.
    expect(chatHistory([turn(1, 'Hola', 'Buenos días'), turn(2, 'espera', null)], 30)).toEqual([
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Buenos días' },
    ])
  })

  it('keeps a greeting, which has a reply but no learner message', () => {
    expect(chatHistory([turn(1, null, '¡Hola!')], 30)).toEqual([
      { role: 'assistant', content: '¡Hola!' },
    ])
  })

  it('keeps the MOST RECENT messages when it has to cut', () => {
    // Cutting from the wrong end would feed the tutor ancient context and drop
    // what was just said.
    const turns = [turn(1, 'one', 'a'), turn(2, 'two', 'b'), turn(3, 'three', 'c')]
    expect(chatHistory(turns, 2)).toEqual([
      { role: 'user', content: 'three' },
      { role: 'assistant', content: 'c' },
    ])
  })

  it('is empty for an empty conversation', () => {
    expect(chatHistory([], 30)).toEqual([])
  })
})

describe('latestAnswered', () => {
  it('finds the newest turn that has a reply', () => {
    const turns = [turn(1, 'a', 'A'), turn(2, 'b', 'B'), turn(3, 'c', null)]
    expect(latestAnswered(turns)?.id).toBe(2)
  })

  it('is null when nothing has been answered', () => {
    expect(latestAnswered([])).toBeNull()
    expect(latestAnswered([turn(1, 'a', null)])).toBeNull()
  })

  it('does not disturb the conversation it scans', () => {
    const turns = [turn(1, 'a', 'A'), turn(2, 'b', 'B')]
    const before = turns.map((t) => t.id)
    latestAnswered(turns)
    expect(turns.map((t) => t.id)).toEqual(before)
  })
})

describe('latestScaffolds', () => {
  it('takes the newest turn that actually produced suggestions', () => {
    const turns = [
      turn(1, 'a', 'A', scaffolds({ replies: ['old'] })),
      turn(2, 'b', 'B', scaffolds({ starters: ['new'] })),
    ]
    expect(latestScaffolds(turns)?.starters).toEqual(['new'])
  })

  it('falls back to an earlier turn when the newest degraded to nothing', () => {
    // Analysis degrades per section; showing no chips when usable ones exist
    // just above would be worse than showing the older ones.
    const turns = [
      turn(1, 'a', 'A', scaffolds({ replies: ['still useful'] })),
      turn(2, 'b', 'B', scaffolds()),
    ]
    expect(latestScaffolds(turns)?.replies).toEqual(['still useful'])
  })

  it('is null when no turn produced any', () => {
    expect(latestScaffolds([turn(1, 'a', 'A', scaffolds())])).toBeNull()
    expect(latestScaffolds([])).toBeNull()
  })
})

describe('transcriptForCoach', () => {
  it('labels each side and keeps the most recent exchange', () => {
    const turns = [turn(1, 'Hola', 'Buenos días'), turn(2, '¿Qué tal?', 'Muy bien')]
    expect(transcriptForCoach(turns, 8)).toBe(
      'LEARNER: Hola\nNATIVE: Buenos días\nLEARNER: ¿Qué tal?\nNATIVE: Muy bien'
    )
  })

  it('includes a turn still in flight, which the history deliberately omits', () => {
    // The coach is asked about the message on screen right now, so unlike the
    // tutor history it must see the learner's newest line even unanswered.
    expect(transcriptForCoach([turn(1, 'espera', null)], 8)).toBe('LEARNER: espera')
  })
})
