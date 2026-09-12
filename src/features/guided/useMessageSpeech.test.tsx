// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ConversationSnapshot } from '../../contracts'
import { setPlaybackAllowed } from '../../platform/audio/speech'
import { useMessageSpeech } from './useMessageSpeech'
const native = vi.hoisted(() => ({ invoke: vi.fn(), execute: vi.fn(), fault: vi.fn(), play: vi.fn(), stop: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke }))
vi.mock('../../platform/ipc/workspace', () => ({ executeAction: native.execute, nativeError: String }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: native.fault }))
vi.mock('./speech-player', () => ({ playSpeechAudio: () => ({ play: native.play, stop: native.stop }) }))
function snapshot(ids: string[], operation = true): ConversationSnapshot {
  return { conversationId: 'chat', sessionId: 'session', revision: ids.length, messages: ids.map((id, i) => ({ id, sequence: i, role: 'assistant', text: id })), turns: operation ? ids.map(id => ({ operations: [{ id: `speech-${id}`, kind: 'persona_speech', sourceMessageId: id }] })) : [] } as unknown as ConversationSnapshot
}
beforeEach(() => {
  setPlaybackAllowed(true)
  vi.clearAllMocks()
  native.play.mockResolvedValue(undefined)
  native.execute.mockResolvedValue({ entityId: 'manual' })
  native.invoke.mockImplementation(async (_command, { operationId }) => ({ status: 'ready', operationId, messageId: operationId === 'manual' ? 'old' : operationId.slice(7), attemptId: operationId, mime: 'audio/mpeg', audioBase64: '' }))
})
it('does not request or play history on mount, preference changes or reopen', () => {
  const old = snapshot(['old'])
  const view = renderHook(({ enabled, active }) => useMessageSpeech(old, 'chat', enabled, active), { initialProps: { enabled: true, active: true } })
  view.rerender({ enabled: false, active: true }); view.rerender({ enabled: true, active: true })
  view.rerender({ enabled: true, active: false }); view.rerender({ enabled: true, active: true })
  expect(native.invoke).not.toHaveBeenCalled(); expect(native.execute).not.toHaveBeenCalled(); expect(native.play).not.toHaveBeenCalled()
})
it('reads and plays a newly arriving speech operation once, without generating it', async () => {
  const view = renderHook(({ state }) => useMessageSpeech(state, 'chat', true, true), { initialProps: { state: snapshot(['old']) } })
  view.rerender({ state: snapshot(['old', 'new']) })
  await waitFor(() => expect(native.play).toHaveBeenCalledTimes(1))
  view.rerender({ state: snapshot(['old', 'new']) })
  expect(native.invoke).toHaveBeenCalledTimes(1)
  expect(native.execute).not.toHaveBeenCalled()
  act(() => view.result.current.stop())
  expect(native.stop).toHaveBeenCalledTimes(1)
})
it('manual replay requests the selected source and duplicate clicks stop pending work', async () => {
  let finish!: (value: unknown) => void
  native.execute.mockImplementation((_state, action) => action.kind === 'requestMessageSpeech' ? new Promise(resolve => { finish = resolve }) : Promise.resolve({}))
  const view = renderHook(() => useMessageSpeech(snapshot(['old']), 'chat', true, true))
  act(() => view.result.current.toggle('old'))
  act(() => view.result.current.toggle('old'))
  await act(async () => finish({ entityId: 'manual' }))
  expect(native.execute).toHaveBeenCalledWith(expect.anything(), { kind: 'requestMessageSpeech', messageId: 'old' })
  expect(native.execute).toHaveBeenCalledWith(expect.anything(), { kind: 'cancelMessageSpeech', operationId: 'manual' })
  expect(native.invoke).not.toHaveBeenCalled()
})
it('suppresses late audio and cancels pending speech when leaving the conversation', async () => {
  let finish!: (value: unknown) => void
  native.invoke.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = renderHook(({ state }) => useMessageSpeech(state, state.conversationId, true, true), { initialProps: { state: snapshot(['old']) } })
  view.rerender({ state: snapshot(['old', 'new']) })
  await waitFor(() => expect(native.invoke).toHaveBeenCalledTimes(1))
  view.rerender({ state: { ...snapshot(['elsewhere']), conversationId: 'other' } })
  await act(async () => finish({ status: 'ready', operationId: 'speech-new', messageId: 'new' }))
  expect(native.execute).toHaveBeenCalledWith({ sessionId: 'session' }, { kind: 'cancelMessageSpeech', operationId: 'speech-new' })
  expect(native.play).not.toHaveBeenCalled()
})
it('surfaces playback rejection without falling back or regenerating', async () => {
  native.play.mockRejectedValue(new Error('Playback denied'))
  const view = renderHook(() => useMessageSpeech(snapshot(['old']), 'chat', false, true))
  act(() => view.result.current.toggle('old'))
  await waitFor(() => expect(view.result.current.failure?.text).toContain('Playback denied'))
  expect(native.stop).toHaveBeenCalledTimes(1)
  expect(native.execute).toHaveBeenCalledTimes(1)
})

it('waits for source binding on a pre-created speech operation', async () => {
  const first = snapshot(['old'])
  first.turns.push({ operations: [{ id: 'speech-new', kind: 'persona_speech', sourceMessageId: null }] } as never)
  const view = renderHook(({ state }) => useMessageSpeech(state, 'chat', true, true), { initialProps: { state: first } })
  view.rerender({ state: snapshot(['old', 'new']) })
  await waitFor(() => expect(native.play).toHaveBeenCalledTimes(1))
  expect(native.execute).not.toHaveBeenCalled()
})
it('stops audio when automatic playback is suspended for microphone input', async () => {
  const view = renderHook(({ state, enabled }) => useMessageSpeech(state, 'chat', enabled, true), { initialProps: { state: snapshot(['old']), enabled: true } })
  view.rerender({ state: snapshot(['old', 'new']), enabled: true })
  await waitFor(() => expect(native.play).toHaveBeenCalledTimes(1))
  view.rerender({ state: snapshot(['old', 'new']), enabled: false })
  expect(native.stop).toHaveBeenCalledTimes(1)
  view.rerender({ state: snapshot(['old', 'new']), enabled: true })
  expect(native.play).toHaveBeenCalledTimes(1)
})

it('manual replay consumes the native operation returned for the selected message', async () => {
  native.execute.mockResolvedValue({ entityId: 'speech-old' })
  const view = renderHook(() => useMessageSpeech(snapshot(['old']), 'chat', true, true))
  act(() => view.result.current.toggle('old'))
  await waitFor(() => expect(native.play).toHaveBeenCalledTimes(1))
  expect(native.invoke).toHaveBeenCalledWith('read_speech_audio', { sessionId: 'session', operationId: 'speech-old' })
  act(() => view.result.current.stop())
  act(() => view.result.current.toggle('old'))
  await waitFor(() => expect(native.play).toHaveBeenCalledTimes(2))
  expect(native.execute).toHaveBeenCalledTimes(2)
  expect(native.invoke).toHaveBeenCalledTimes(2)
})

it.each([false, true])('suppresses a delayed audio result after suspension (resumed: %s)', async (resume) => {
  let finish!: (value: unknown) => void
  native.invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = renderHook(({ state }) => useMessageSpeech(state, 'chat', true, true), { initialProps: { state: snapshot(['old']) } })
  view.rerender({ state: snapshot(['old', 'new']) })
  await waitFor(() => expect(native.invoke).toHaveBeenCalledOnce())
  act(() => { setPlaybackAllowed(false); if (resume) setPlaybackAllowed(true) })
  await act(async () => finish({ status: 'ready', operationId: 'speech-new', messageId: 'new' }))
  expect(native.play).not.toHaveBeenCalled()
  expect(view.result.current.messageId).toBeNull()
  expect(native.execute).toHaveBeenCalledWith({ sessionId: 'session' }, { kind: 'cancelMessageSpeech', operationId: 'speech-new' })
})
