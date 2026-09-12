import { describe, expect, it } from 'vitest'
import type { ChatMessage, ConversationSnapshot } from '../../contracts'
import { conversationTurns } from './conversation-view'

function message(sequence: number, role: string, text: string, translation: string | null = null): ChatMessage {
  return { wordGloss: null, glossError: null, glossState: null, glossOperationId: null, sequence, role, text, translation, translationState: translation ? 'succeeded' : null, id: `source-${sequence}`, createdAt: '2026-09-10' }
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
    expect(projected[0].assistant).toMatchObject({ tokens: [], user_tokens: [], user_translation: null, mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, suggestionsState: null, errors: [] })
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

  it('does not include private coach messages in persona turns', () => {
    const source = snapshot([message(1, 'user', 'Persona question')])
    source.coachMessages = [message(2, 'assistant', 'Private coaching')]
    expect(conversationTurns(source)).toMatchObject([{ id: 1, user: 'Persona question', assistant: null, analysisState: null }])
  })

  it('fails on an unexpected native role rather than dropping content', () => {
    expect(() => conversationTurns(snapshot([message(1, 'system', 'Unexpected')]))).toThrow('Unexpected conversation message role.')
  })
})

it('passes native feedback through unchanged and projects suggestion state and failure', () => {
  const user: ChatMessage = { ...message(1, 'user', 'Yo fue ayer'), feedbackState: 'succeeded',
    feedback: { correctness: 2, understandability: 4, explanation: 'Use fui for yo.', correction: 'Yo fui ayer.', evidence: [] } }
  const reply: ChatMessage = { ...message(2, 'assistant', '¿Adónde fuiste?'), suggestedReplies: [{ text: 'Fui al mercado.', segments: [] }], suggestionsState: 'failed', suggestionsError: 'Coach feedback rejected: suggestions_schema.' }
  const [turn] = conversationTurns(snapshot([user, reply]))
  expect(turn.coach).toBe(user.feedback)
  expect(turn.analysisState).toBe('done')
  expect(turn.assistant).toMatchObject({ scaffolds: { replies: [{ text: 'Fui al mercado.', segments: [] }] }, suggestionsState: 'failed', errors: ['Coach feedback rejected: suggestions_schema.'] })
})

it('projects saved source gloss and independent operation state without token reconstruction', () => {
  const source = message(2, 'assistant', 'Hola hola')
  source.wordGloss = {sourceMessageId: source.id, targetLanguageId:'spanish', explanationLanguageId:'english', formatVersion:'format', templateVersion:'template', boundaryPolicy:'policy', operationId:'gloss', attemptId:'attempt', coverage:'partial', segments:[{start:5,end:9,kind:'gloss',gloss:'hello'}]}
  source.glossOperationId = 'gloss'
  source.glossState = 'failed'
  source.glossError = 'Word meanings request failed.'
  const projected = conversationTurns(snapshot([source]))[0].assistant!
  expect(projected.savedGloss).toBe(source.wordGloss)
  expect(projected).toMatchObject({reply:'Hola hola',tokens:[],glossOperationId:'gloss',glossState:'failed',glossError:source.glossError})
  source.wordGloss = {...source.wordGloss, sourceMessageId: 'another-message'}
  expect(() => conversationTurns(snapshot([source]))).toThrow('Saved word meanings do not belong to this message.')
})

it.each([null, 'ready', 'waiting_dependencies', 'running', 'succeeded', 'failed', 'unknown', 'cancelled', 'invalidated'])('preserves authoritative translation state %s independently of saved text', state => {
  const reply = { ...message(2, 'assistant', 'Reply', 'Saved translation'), translationState: state }
  const source = snapshot([message(1, 'user', 'Question'), reply])
  const before = structuredClone(source)
  const result = conversationTurns(source)[0].assistant!
  expect(result.translationState).toBe(state)
  expect(result.translation).toBe('Saved translation')
  expect(result.reply).toBe('Reply')
  expect(result.glossState).toBeNull()
  expect(result.errors).toEqual([])
  expect(source).toEqual(before)
})

it('projects human reading independently of the reply and rejects another source', () => {
  const human = message(1, 'user', 'Hola', 'Hello')
  human.wordGloss = { sourceMessageId: human.id, targetLanguageId:'es', explanationLanguageId:'en', formatVersion:'v1', templateVersion:'v1', boundaryPolicy:'v1', operationId:'human-gloss', attemptId:'attempt', coverage:'complete', segments:[{ start:0, end:4, kind:'gloss', gloss:'hello' }] }
  const result = conversationTurns(snapshot([human]))[0]
  expect(result.userSavedGloss).toBe(human.wordGloss)
  expect(result.userTranslation).toBe('Hello')
  expect(result.assistant).toBeNull()
  human.wordGloss.sourceMessageId = 'different'
  expect(() => conversationTurns(snapshot([human]))).toThrow('Saved word meanings do not belong to this message.')
})
