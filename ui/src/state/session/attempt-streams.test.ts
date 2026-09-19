import { beforeEach, expect, it } from 'vitest'
import type { AttemptStreamUpdate, TurnView } from '../../generated/contracts'
import { useAttemptStreams, useReplyStream } from './attempt-streams'

function update(overrides: Partial<AttemptStreamUpdate>): AttemptStreamUpdate {
  return { generation: 5, attemptId: 'a', conversationId: 'c', turnId: 't', operationId: 'o', kind: 'persona_reply', seq: 1, text: 'Ho', terminal: null, ...overrides }
}
beforeEach(() => useAttemptStreams.getState().reset())

function replyTurn(state: string, unpublishedText: string | null): TurnView {
  return {
    id: 't', state, paused: false, route: 'openrouter', hold: null, replacesTurnId: null, replacedBy: null,
    operations: [{ id: 'o', kind: 'persona_reply', state, role: 'standard', contractVersion: 1, dependencies: [], sourceMessageId: null }],
    attempts: [{ id: 'a', operationId: 'o', state, requestedModel: 'm', actualModel: null, providerId: null,
      startedAt: '', finishedAt: null, inputTokens: null, outputTokens: null, error: null, diagnostics: null, unpublishedText }],
  }
}

it.each(['cancelled', 'invalidated', 'unknown', 'failed'])('keeps the live text across an early %s snapshot until retention catches up', state => {
  useAttemptStreams.getState().apply(update({ text: 'Hola mundo' }))
  const view = renderHook(({ turn }) => useReplyStream(turn), { initialProps: { turn: replyTurn('running', null) } })
  expect(view.result.current?.text).toBe('Hola mundo')
  view.rerender({ turn: replyTurn(state, null) })
  expect(view.result.current?.text).toBe('Hola mundo')
  view.rerender({ turn: replyTurn(state, 'Hola') })
  expect(view.result.current?.text).toBe('Hola mundo')
  act(() => { useAttemptStreams.getState().apply(update({ seq: 2, text: 'Hola mundo', terminal: state })) })
  expect(view.result.current?.text).toBe('Hola mundo')
  view.rerender({ turn: replyTurn(state, 'Hola mundo') })
  expect(view.result.current).toBeNull()
  expect(useAttemptStreams.getState().entries.a).toBeUndefined()
})

it('hands a successful attempt over to its atomically published message', () => {
  useAttemptStreams.getState().apply(update({ text: 'Hola' }))
  const view = renderHook(() => useReplyStream(replyTurn('succeeded', null)))
  expect(view.result.current).toBeNull()
  expect(useAttemptStreams.getState().entries.a).toBeUndefined()
})

it('keeps each mounted reader covered when another reader has already handed over', () => {
  useAttemptStreams.getState().apply(update({ text: 'Hola mundo' }))
  const first = renderHook(({ turn }) => useReplyStream(turn), { initialProps: { turn: replyTurn('running', null) } })
  const second = renderHook(({ turn }) => useReplyStream(turn), { initialProps: { turn: replyTurn('running', null) } })
  first.rerender({ turn: replyTurn('cancelled', 'Hola mundo') })
  expect(first.result.current).toBeNull()
  expect(useAttemptStreams.getState().entries.a).toBeUndefined()
  expect(second.result.current?.text).toBe('Hola mundo')
  second.rerender({ turn: replyTurn('cancelled', 'Hola') })
  expect(second.result.current?.text).toBe('Hola mundo')
  act(() => { useAttemptStreams.getState().apply(update({ generation: 6, attemptId: 'new', text: 'New workspace' })) })
  expect(second.result.current).toBeNull()
})

it('keeps only strictly newer sequences, so terminal changes are never dropped', () => {
  const store = useAttemptStreams.getState()
  store.apply(update({ seq: 2, text: 'Hola' }))
  store.apply(update({ seq: 1, text: 'Ho' }))
  expect(useAttemptStreams.getState().entries.a.text).toBe('Hola')
  store.apply(update({ seq: 3, text: 'Hola', terminal: 'failed' }))
  expect(useAttemptStreams.getState().entries.a.terminal).toBe('failed')
  store.apply(update({ seq: 3, text: 'stale duplicate' }))
  expect(useAttemptStreams.getState().entries.a.text).toBe('Hola')
})

it('reconciles a read with events in either order', () => {
  const store = useAttemptStreams.getState()
  store.apply(update({ seq: 4, text: 'Hola m' }))
  store.adoptRead({ generation: 5, entries: [update({ seq: 3, text: 'Hola' }), update({ attemptId: 'b', seq: 1, text: 'Otra' })] })
  expect(useAttemptStreams.getState().entries.a.text).toBe('Hola m')
  expect(useAttemptStreams.getState().entries.b.text).toBe('Otra')
})

it('adopts a newer generation, clearing old text and asking for a re-read, and drops an older one', () => {
  const store = useAttemptStreams.getState()
  store.apply(update({ seq: 9, text: 'Before reset' }))
  expect(store.apply(update({ generation: 6, attemptId: 'n', seq: 1, text: 'New' }))).toBe(true)
  expect(Object.keys(useAttemptStreams.getState().entries)).toEqual(['n'])
  expect(store.apply(update({ generation: 5, attemptId: 'late', seq: 50, text: 'Late event' }))).toBe(false)
  store.adoptRead({ generation: 5, entries: [update({ attemptId: 'late', seq: 50 })] })
  expect(useAttemptStreams.getState()).toMatchObject({ generation: 6 })
  expect(useAttemptStreams.getState().entries.late).toBeUndefined()
})
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
