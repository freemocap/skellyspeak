// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ConversationSnapshot } from '../../../generated/contracts'
import { setPlaybackAllowed } from '../../../platform/audio/speech'
import { useMessageSpeech } from './useMessageSpeech'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), execute: vi.fn(), stream: vi.fn(), full: vi.fn(), append: vi.fn(), finish: vi.fn(), stop: vi.fn(), play: vi.fn(), rate: vi.fn(), volume: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('../../../platform/ipc/workspace', () => ({ executeAction: mocks.execute }))
vi.mock('../../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))
vi.mock('../../../platform/audio/speech-player', () => ({ playSpeechAudio: mocks.full }))
vi.mock('../../../platform/audio/speech-stream-player', () => ({ createSpeechStreamPlayer: mocks.stream }))
const snapshot = { sessionId: 'session', conversationId: 'chat', messages: [{ id: 'message', role: 'assistant', text: 'A reply.' }], turns: [] } as unknown as ConversationSnapshot
const chunk = { status: 'streaming', operationId: 'op', messageId: 'message', executionId: 'execution', sampleOffset: 0, audioBase64: 'AAAAAA==', alignment: null }
const ready = { status: 'ready', operationId: 'op', messageId: 'message', attemptId: 'attempt', audioBase64: 'complete', mime: 'audio/wav', alignment: null }
beforeEach(() => {
  vi.clearAllMocks(); setPlaybackAllowed(true)
  mocks.execute.mockResolvedValue({ entityId: 'op' })
  mocks.play.mockResolvedValue(undefined)
  mocks.append.mockImplementation((_bytes, offset) => offset + 2)
  mocks.stream.mockImplementation((_end, _error, _rate, _volume, observer) => {
    const handle = { append: mocks.append, finish: mocks.finish, stop: mocks.stop, play: mocks.play, setRate: mocks.rate, setVolume: mocks.volume }
    observer.onReady(handle); return handle
  })
})

it('starts on a chunk, requests the next cursor, and hands completion to the same player', async () => {
  let complete!: (value: unknown) => void
  mocks.invoke.mockResolvedValueOnce(chunk).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
  const view = renderHook(({ rate, volume }) => useMessageSpeech(snapshot, 'chat', true, true, rate, volume), { initialProps: { rate: 1, volume: 1 } })
  act(() => view.result.current.toggle('message'))
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2))
  expect(mocks.play).toHaveBeenCalledOnce()
  expect(mocks.invoke.mock.calls[1][1]).toEqual({ sessionId: 'session', operationId: 'op', executionId: 'execution', sampleOffset: 2 })
  expect(view.result.current.retained).toBeNull()
  view.rerender({ rate: 0.8, volume: 0.5 })
  expect(mocks.rate).toHaveBeenLastCalledWith(0.8); expect(mocks.volume).toHaveBeenLastCalledWith(0.5)
  await act(async () => complete(ready))
  expect(mocks.finish).toHaveBeenCalledWith(ready)
  expect(mocks.full).not.toHaveBeenCalled()
  expect(view.result.current.retained?.audio).toEqual(ready)
  act(() => view.result.current.stop())
  expect(mocks.execute).toHaveBeenCalledOnce()
})

it('detaches a streaming consumer on stop and ignores the pending read', async () => {
  let deliver!: (value: unknown) => void
  mocks.invoke.mockResolvedValueOnce(chunk).mockImplementationOnce(() => new Promise(resolve => { deliver = resolve }))
  const view = renderHook(() => useMessageSpeech(snapshot, 'chat', true, true))
  act(() => view.result.current.toggle('message'))
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2))
  act(() => view.result.current.stop())
  expect(mocks.stop).toHaveBeenCalledOnce()
  expect(mocks.execute).toHaveBeenLastCalledWith({ sessionId: 'session' }, { kind: 'cancelMessageSpeech', operationId: 'op' })
  await act(async () => deliver({ ...chunk, sampleOffset: 2 }))
  expect(mocks.append).toHaveBeenCalledOnce(); expect(mocks.finish).not.toHaveBeenCalled()
  expect(view.result.current.messageId).toBeNull()
})

it.each([
  { ...chunk, executionId: 'different', sampleOffset: 2 },
  { ...chunk, sampleOffset: 4 },
  { status: 'unavailable', operationId: 'op', messageId: 'message', reason: 'failed', message: 'The stream failed.', diagnostics: { request_id: 'receipt' } },
])('stops provisional playback on invalid continuation or terminal failure', async continuation => {
  mocks.invoke.mockResolvedValueOnce(chunk).mockResolvedValueOnce(continuation)
  const view = renderHook(() => useMessageSpeech(snapshot, 'chat', true, true))
  act(() => view.result.current.toggle('message'))
  await waitFor(() => expect(view.result.current.failure).not.toBeNull())
  expect(mocks.stop).toHaveBeenCalledOnce()
  expect(mocks.finish).not.toHaveBeenCalled(); expect(mocks.full).not.toHaveBeenCalled()
  expect(view.result.current.retained).toBeNull()
  expect(view.result.current.phase).toBe('idle')
})
