import { describe, expect, it } from 'vitest'
import type { ChatMessage, ConversationSnapshot } from '../contracts'
import { conversationTurns } from './conversation-view'

function message(sequence: number, role: string, text: string, translation: string | null = null): ChatMessage {
  return { sequence, role, text, translation, translationState: translation ? 'succeeded' : null, id: `source-${sequence}`, createdAt: '2026-09-10' }
}
function snapshot(messages: ChatMessage[]): ConversationSnapshot {
  return {
    messages, turns: [], coachMessages: [], transcriptionAttempts: [], holds: [],
    conversationId: 'conversation', sessionId: 'session', revision: 1, hasOlder: false,
    connection: { route: 'hosted', signedIn: true, ownKeyConfigured: false, email: '', revision: 1, configured: true, standardModel: 'google/gemini-2.5-flash', fastModel: '', paused: false },
  }
}

describe('durable conversation projection', () => {
  it('preserves exact multilingual text and saved translation without manufacturing analysis', () => {
    const source = snapshot([
      message(1, 'user', '  Sí, sí!\ne\u0301 你好 👩🏽‍💻  '),
      message(2, 'assistant', 'مرحبا\n你好。', 'Hello\nHello.'),
    ])
    const original = structuredClone(source)
    const projected = conversationTurns(source)
    expect(projected).toHaveLength(1)
    expect(projected[0].user).toBe(source.messages[0].text)
    expect(projected[0].assistant?.reply).toBe(source.messages[1].text)
    expect(projected[0].assistant?.translation).toBe('Hello\nHello.')
    expect(projected[0].analysisState).toBeNull()
    expect(projected[0].assistant).toMatchObject({ tokens: [], user_tokens: [], user_translation: null, mechanics: [], scaffolds: { replies: [], frames: [], starters: [], coach_help: null }, errors: [] })
    expect(source).toEqual(original)
  })

  it('hydrates translation independently without changing source or older projections', () => {
    const initial = snapshot([message(1, 'user', 'Question'), message(2, 'assistant', 'Reply')])
    const before = conversationTurns(initial)
    const after = conversationTurns({ ...initial, revision: 2, messages: [initial.messages[0], { ...initial.messages[1], translation: 'Saved meaning', translationState: 'succeeded' }] })
    expect(before[0].assistant?.translation).toBeNull()
    expect(after[0].assistant?.translation).toBe('Saved meaning')
    expect(after[0].assistant?.reply).toBe(before[0].assistant?.reply)
    expect(after[0].id).toBe(before[0].id)
    expect(after[0].analysisState).toBeNull()
  })

  it('preserves an assistant at a page boundary and a pending learner message', () => {
    const result = conversationTurns(snapshot([message(100, 'assistant', 'Previous reply'), message(101, 'user', 'Next question')]))
    expect(result.map(turn => ({ id: turn.id, user: turn.user, reply: turn.assistant?.reply ?? null }))).toEqual([
      { id: 100, user: null, reply: 'Previous reply' },
      { id: 101, user: 'Next question', reply: null },
    ])
    expect(result.every(turn => turn.analysisState === null)).toBe(true)
  })

  it('does not include private coach messages in partner turns', () => {
    const source = snapshot([message(1, 'user', 'Partner question')])
    source.coachMessages = [message(2, 'assistant', 'Private coaching')]
    expect(conversationTurns(source)).toEqual([{ id: 1, user: 'Partner question', assistant: null, analysisState: null }])
  })

  it('fails on an unexpected native role rather than dropping content', () => {
    expect(() => conversationTurns(snapshot([message(1, 'system', 'Unexpected')]))).toThrow('Unexpected conversation message role.')
  })
})
