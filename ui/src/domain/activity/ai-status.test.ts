import { expect, it } from 'vitest'
import type { TurnView } from '../../generated/contracts'
import english from '../localization/locales/english.json'
import { aiStatus, OPERATION_WORDS, STEP_WORDS, type AiStatusInput } from './ai-status'

type Turn = AiStatusInput['turns'][number]

/// A turn from [operation id, kind, state] rows and the attempts that ran them.
function turn(id: string, operations: [string, string, string][], attempts: Partial<TurnView['attempts'][number]>[] = []): Turn {
  return {
    id,
    operations: operations.map(([operationId, kind, state]) => ({ id: operationId, kind, state, dependencies: [], role: 'standard', contractVersion: 1, sourceMessageId: null })),
    attempts: attempts.map((attempt, index) => ({ id: `${id}-a${index}`, operationId: 'x', state: 'running', requestedModel: 'model-m', actualModel: null, providerId: null,
      startedAt: '2026-09-30T10:00:00.000Z', finishedAt: null, inputTokens: null, outputTokens: null, error: null, unpublishedText: null, ...attempt })),
  }
}

function input(overrides: Partial<AiStatusInput> = {}): AiStatusInput {
  return { transcribing: false, scheduling: false, turns: [], streaming: new Set(), audio: null, connection: 'connected',
    models: { transcription: 'whisper-large-v3', speech: 'voice-model' }, ...overrides }
}

it('names nothing while the AI is idle', () => {
  expect(aiStatus(input())).toEqual({ busy: false, line: null })
})

it('reports transcription as a learner-started step, with the transcription model', () => {
  expect(aiStatus(input({ transcribing: true }))).toEqual({ busy: true, line: {
    id: 'transcribe', tone: 'work', announce: true, kinds: ['speech_transcription'], models: ['whisper-large-v3'],
    words: ['Transcribing recorded audio…', 'Transcribing audio…', 'Transcribing…'],
  } })
  expect(aiStatus(input({ transcribing: true, models: { transcription: null, speech: null } })).line?.models).toEqual([])
})

it('reports a send as scheduling a turn until native storage holds it', () => {
  const { busy, line } = aiStatus(input({ scheduling: true }))
  expect(busy).toBe(true)
  expect(line).toMatchObject({ id: 'schedule', announce: true, words: ['Scheduling reply turn…', 'Scheduling turn…', 'Scheduling…'] })
})

it('tells a requested reply apart from one streaming tokens', () => {
  const running = turn('t1', [['c', 'persona_context', 'succeeded'], ['r', 'persona_reply', 'running']], [
    { operationId: 'c', state: 'succeeded', finishedAt: '2026-09-30T10:00:00.050Z' },
    { operationId: 'r', requestedModel: 'partner-model' },
  ])
  expect(aiStatus(input({ turns: [running] })).line).toMatchObject({
    id: 'request:persona_reply', announce: true, kinds: ['persona_reply'], models: ['partner-model'],
    words: ['Generating partner reply…', 'Generating reply…', 'Generating…'],
  })
  expect(aiStatus(input({ turns: [running], streaming: new Set(['t1-a1']) })).line).toMatchObject({
    id: 'stream:persona_reply', announce: false, words: ['Streaming reply tokens…', 'Receiving reply…', 'Streaming…'],
  })
})

it('keeps the partner reply ahead of work running beside it', () => {
  const running = turn('t1', [['r', 'persona_reply', 'running'], ['f', 'coach_feedback', 'running']], [
    { operationId: 'r', startedAt: '2026-09-30T10:00:00.000Z' },
    { operationId: 'f', startedAt: '2026-09-30T10:00:01.000Z' },
  ])
  expect(aiStatus(input({ turns: [running] })).line?.kinds).toEqual(['persona_reply'])
})

it('follows the follow-on operation that started most recently, without announcing it', () => {
  const running = turn('t1', [['r', 'persona_reply', 'succeeded'], ['t', 'reply_translation', 'running'], ['g', 'persona_word_gloss', 'running'], ['w', 'reply_brief', 'waiting_dependencies']], [
    { operationId: 'r', state: 'succeeded', finishedAt: '2026-09-30T10:00:03.000Z' },
    { operationId: 't', startedAt: '2026-09-30T10:00:03.100Z', requestedModel: 'translation-model' },
    { operationId: 'g', startedAt: '2026-09-30T10:00:03.200Z', requestedModel: 'gloss-model' },
  ])
  expect(aiStatus(input({ turns: [running] }))).toEqual({ busy: true, line: {
    id: 'run:persona_word_gloss', tone: 'work', announce: false, kinds: ['persona_word_gloss'], models: ['gloss-model'],
    words: ['Glossing reply words…', 'Glossing words…', 'Glossing…'],
  } })
})

it('reads the newest turn that has running work', () => {
  const settled = turn('t2', [['r', 'persona_reply', 'succeeded']], [{ operationId: 'r', state: 'succeeded', finishedAt: '2026-09-30T10:00:09.000Z' }])
  const older = turn('t1', [['g', 'user_word_gloss', 'running']], [{ operationId: 'g' }])
  expect(aiStatus(input({ turns: [settled, older] })).line?.kinds).toEqual(['user_word_gloss'])
})

it('names an operation it has no wording for by its scheduler kind', () => {
  const running = turn('t1', [['n', 'brand_new_check', 'running']], [{ operationId: 'n' }])
  expect(aiStatus(input({ turns: [running] })).line).toMatchObject({ id: 'run:brand_new_check', words: null, kinds: ['brand_new_check'] })
})

it('reports queued work that no request is running for yet', () => {
  const queued = turn('t1', [['c', 'persona_context', 'ready'], ['r', 'persona_reply', 'waiting_dependencies']])
  expect(aiStatus(input({ turns: [queued] }))).toMatchObject({ busy: true, line: { id: 'dispatch', words: ['Awaiting request dispatch…', 'Awaiting dispatch…', 'Queued…'] } })
})

it('does not treat held work as running', () => {
  const held = turn('t1', [['r', 'persona_reply', 'held']])
  expect(aiStatus(input({ turns: [held] }))).toEqual({ busy: false, line: null })
})

it('reports speech synthesis, from a turn or from a replay', () => {
  const speaking = turn('t1', [['s', 'persona_speech', 'running']], [{ operationId: 's', requestedModel: 'turn-voice-model' }])
  const words = ['Synthesizing partner voice…', 'Synthesizing voice…', 'Synthesizing…']
  expect(aiStatus(input({ turns: [speaking] })).line).toMatchObject({ id: 'run:persona_speech', words, models: ['turn-voice-model'] })
  expect(aiStatus(input({ audio: 'partner' }))).toMatchObject({ busy: true, line: { id: 'synthesize', words, kinds: ['persona_speech'], models: ['voice-model'] } })
})

it('reports a practice card’s audio as fetched, since native may answer it from its cache', () => {
  expect(aiStatus(input({ audio: 'card' }))).toEqual({ busy: true, line: {
    id: 'card-audio', tone: 'work', announce: false, kinds: [], models: ['voice-model'],
    words: ['Fetching card audio…', 'Fetching audio…', 'Fetching…'],
  } })
})

it('reports the connection only while no work runs, and never as work', () => {
  expect(aiStatus(input({ connection: 'checking' }))).toEqual({ busy: false, line: {
    id: 'check', tone: 'check', announce: false, kinds: [], models: [], words: ['Checking AI connection…', 'Checking connection…', 'Checking…'],
  } })
  expect(aiStatus(input({ connection: 'disconnected' })).line).toMatchObject({ id: 'offline', tone: 'offline', words: ['AI not connected', 'Not connected', 'Disconnected'] })
  expect(aiStatus(input({ connection: 'disconnected', transcribing: true })).line?.id).toBe('transcribe')
})

it('words every status in at most three words, then two, then one, each a catalog message', () => {
  const catalog = english as Record<string, unknown>
  for (const [kind, tiers] of Object.entries({ ...STEP_WORDS, ...OPERATION_WORDS })) {
    tiers.forEach((key, tier) => {
      expect(catalog[key], `${kind}: ${key}`).toBe(key)
      const words = key.replace('…', '').trim().split(/\s+/).length
      expect(words, `${kind}: ${key}`).toBeLessThanOrEqual(3 - tier)
    })
  }
})
