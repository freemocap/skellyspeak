import { describe, expect, it } from 'vitest'
import { conversationTitle } from './conversation'
import type { GuidedTurnResult, StoredTurn } from '../types'

const reply = (text: string): GuidedTurnResult => ({
  reply: text,
  translation: null,
  tokens: [],
  user_tokens: [],
  user_translation: null,
  mechanics: [],
  scaffolds: { replies: [], frames: [], starters: [] },
  errors: [],
})

const turn = (user: string | null, assistant: string | null): StoredTurn => ({
  id: 1,
  user,
  assistant: assistant === null ? null : reply(assistant),
  analysisState: 'done',
})

describe('naming a conversation', () => {
  it('prefers what the learner said over the tutor greeting', () => {
    // Greetings are near-identical across conversations, so a list titled by
    // them is a list of indistinguishable rows. What you remember about a
    // conversation is what you brought to it.
    const turns = [
      turn(null, '¡Hola! ¿Cómo estás hoy?'),
      turn('Quiero hablar sobre cocinar pasta', 'Claro, me encanta la pasta.'),
    ]
    expect(conversationTitle(turns)).toBe('Quiero hablar sobre cocinar pasta')
  })

  it('falls back to the tutor greeting when nothing has been said yet', () => {
    // A conversation that has only been opened still deserves a name.
    expect(conversationTitle([turn(null, '¡Hola! ¿Cómo estás?')])).toBe('¡Hola! ¿Cómo estás?')
  })

  it('is empty for a conversation with nothing in it', () => {
    expect(conversationTitle([])).toBe('')
    expect(conversationTitle([turn(null, null)])).toBe('')
    // Whitespace is not content.
    expect(conversationTitle([turn('   ', null)])).toBe('')
  })

  it('collapses newlines and runs of spaces', () => {
    // A title is one line in a narrow sidebar.
    expect(conversationTitle([turn('hola\n\n   mundo', null)])).toBe('hola mundo')
  })

  it('truncates long messages on a word boundary', () => {
    const long = 'Me gustaría practicar el subjuntivo porque siempre me confunde muchísimo'
    const title = conversationTitle([turn(long, null)])
    expect(title.length).toBeLessThanOrEqual(53)
    expect(title.endsWith('…')).toBe(true)
    // Cut between words, not through one.
    expect(title.replace('…', '').trimEnd()).toBe(
      long.slice(0, title.replace('…', '').trimEnd().length)
    )
    expect(long.startsWith(title.replace('…', ''))).toBe(true)
  })

  it('still truncates when there is no word boundary to use', () => {
    // A single very long token has nowhere good to break, and must not be
    // returned at full length just because of that.
    const title = conversationTitle([turn('x'.repeat(200), null)])
    expect(title.length).toBeLessThanOrEqual(53)
    expect(title.endsWith('…')).toBe(true)
  })

  it('leaves a title that already fits alone', () => {
    expect(conversationTitle([turn('Hola', null)])).toBe('Hola')
  })
})
