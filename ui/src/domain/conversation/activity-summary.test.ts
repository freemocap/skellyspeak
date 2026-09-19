import { expect, it } from 'vitest'
import type { TurnView } from '../../generated/contracts'
import { countWords, humanizeKind, operationPhase, retainedReplyText, turnActivity } from './activity-summary'

function turn(operations: [string, string, string][], attempts: Partial<TurnView['attempts'][number]>[] = []) {
  return {
    operations: operations.map(([id, kind, state]) => ({ id, kind, state, dependencies: [], role: 'standard', contractVersion: 1, sourceMessageId: null })),
    attempts: attempts.map((attempt, index) => ({ id: `a${index}`, requestedModel: 'm', actualModel: null, providerId: null, finishedAt: null, inputTokens: null, outputTokens: null, error: null, unpublishedText: null, state: 'running', startedAt: '2026-09-18T10:00:00.000Z', operationId: 'x', ...attempt })),
  } as Pick<TurnView, 'operations' | 'attempts'>
}

it('groups every recorded state, including held', () => {
  expect(['waiting_dependencies', 'ready', 'held', 'running', 'succeeded', 'failed', 'unknown', 'cancelled', 'invalidated'].map(operationPhase))
    .toEqual(['waiting', 'waiting', 'held', 'running', 'succeeded', 'failed', 'unknown', 'ended', 'ended'])
  expect(operationPhase('something_new')).toBeNull()
})

it('names operations only by their kind', () => {
  expect(humanizeKind('persona_word_gloss')).toBe('persona word gloss')
})

it('summarizes running, waiting, held and finished work in start order', () => {
  const activity = turnActivity(turn(
    [['c', 'persona_context', 'succeeded'], ['r', 'persona_reply', 'running'], ['t', 'user_translation', 'running'], ['w', 'reply_translation', 'waiting_dependencies'], ['h', 'skill_assessment', 'held']],
    [
      { operationId: 'c', state: 'succeeded', startedAt: '2026-09-18T10:00:00.000Z', finishedAt: '2026-09-18T10:00:00.100Z' },
      { operationId: 't', startedAt: '2026-09-18T10:00:00.200Z' },
      { operationId: 'r', startedAt: '2026-09-18T10:00:00.300Z' },
    ]), '¡Qué bien! Fuiste al mercado.')
  expect(activity).toMatchObject({ total: 5, done: 1, waiting: 1, held: 1, running: ['user translation', 'persona reply'], replyRunning: true, replyWords: 5, lastFinished: 'persona context', settled: false })
})

it('reports elapsed time once settled', () => {
  const activity = turnActivity(turn([['c', 'persona_context', 'succeeded'], ['r', 'persona_reply', 'succeeded']], [
    { operationId: 'c', state: 'succeeded', startedAt: '2026-09-18T10:00:00.000Z', finishedAt: '2026-09-18T10:00:00.500Z' },
    { operationId: 'r', state: 'succeeded', startedAt: '2026-09-18T10:00:00.500Z', finishedAt: '2026-09-18T10:00:04.000Z' },
  ]))
  expect(activity).toMatchObject({ settled: true, elapsedMs: 4000, replyWords: null })
})

it('counts words with the platform segmenter, including spaceless scripts', () => {
  expect(countWords('Hola, ¿qué tal?')).toBe(3)
  expect(countWords('我去了市场', 'zh')).toBeGreaterThan(1)
  expect(countWords('')).toBe(0)
})

it('exposes the retained text of a reply that never became a message', () => {
  expect(retainedReplyText(turn([['r', 'persona_reply', 'failed']], [{ operationId: 'r', state: 'failed', unpublishedText: 'Cut off' }]))).toBe('Cut off')
  expect(retainedReplyText(turn([['t', 'user_translation', 'failed']], [{ operationId: 't', state: 'failed', unpublishedText: 'ignored' }]))).toBeNull()
})
