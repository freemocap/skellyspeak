// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useMicRecorder } from './useMicRecorder'
const invoke = vi.hoisted(() => vi.fn())
const fault = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../lib/faults', () => ({ reportFault: fault }))
beforeEach(() => {
  invoke.mockReset(); fault.mockReset()
  invoke.mockImplementation(async (command: string) => {
    if (command === 'mic_start') return { recordingId: 'fixture-recording', samplesPerSecond: 689 }
    if (command === 'mic_wave') return []
    if (command === 'mic_transcribe') return 'fixture transcript'
    if (command === 'mic_cancel') return
    throw new Error(`Unexpected native command: ${command}`)
  })
})
function setup() {
  const onTranscribe = vi.fn()
  return { ...renderHook(({ conversationId }) => useMicRecorder({ conversationId, onTranscribe }),
    { initialProps: { conversationId: 'fixture-conversation' } }), onTranscribe }
}
it('does no native work on mount and starts capture for the selected conversation only on action', async () => {
  const { result } = setup()
  expect(invoke).not.toHaveBeenCalled()
  await act(async () => { await result.current.toggleMic() })
  expect(invoke).toHaveBeenCalledWith('mic_start', { conversationId: 'fixture-conversation' })
  expect(result.current.recording).toBe(true)
})
it('transcribes the recording ID once on explicit Stop', async () => {
  const { result, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  await act(async () => { await result.current.toggleMic() })
  expect(invoke).toHaveBeenCalledWith('mic_transcribe', { recordingId: 'fixture-recording' })
  expect(onTranscribe).toHaveBeenCalledExactlyOnceWith('fixture transcript')
})
it('cancels capture without transcription when the conversation changes', async () => {
  const { result, rerender, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  rerender({ conversationId: 'different-conversation' })
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_cancel', { recordingId: 'fixture-recording' }))
  expect(invoke.mock.calls.some(([command]) => command === 'mic_transcribe')).toBe(false)
  expect(onTranscribe).not.toHaveBeenCalled()
})
it('cancels a late capture startup after unmount', async () => {
  let resolve!: (value: { recordingId: string; samplesPerSecond: number }) => void
  invoke.mockImplementation((command: string) => command === 'mic_start'
    ? new Promise<{ recordingId: string; samplesPerSecond: number }>(done => { resolve = done }) : Promise.resolve())
  const { result, unmount } = setup()
  let pending!: Promise<void>
  act(() => { pending = result.current.toggleMic() })
  unmount()
  await act(async () => { resolve({ recordingId: 'late-recording', samplesPerSecond: 689 }); await pending })
  expect(invoke).toHaveBeenCalledWith('mic_cancel', { recordingId: 'late-recording' })
})
it('keeps transcription exclusive and does not insert a late result into another conversation', async () => {
  let finish!: (text: string) => void
  invoke.mockImplementation((command: string) => {
    if (command === 'mic_start') return Promise.resolve({ recordingId: 'fixture-recording', samplesPerSecond: 689 })
    if (command === 'mic_transcribe') return new Promise<string>(resolve => { finish = resolve })
    return Promise.resolve([])
  })
  const { result, rerender, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  let pending!: Promise<void>
  act(() => { pending = result.current.toggleMic() })
  expect(result.current.transcribing).toBe(true)
  await act(async () => { await result.current.toggleMic() })
  expect(invoke.mock.calls.filter(([command]) => command === 'mic_start')).toHaveLength(1)
  rerender({ conversationId: 'different-conversation' })
  await act(async () => { finish('late transcript'); await pending })
  expect(onTranscribe).not.toHaveBeenCalled()
  expect(result.current.transcribing).toBe(false)
})
it('reports capture failure without claiming to record', async () => {
  invoke.mockRejectedValue(new Error('Microphone unavailable'))
  const { result } = setup()
  await act(async () => { await result.current.toggleMic() })
  expect(result.current.recording).toBe(false)
  expect(fault).toHaveBeenCalled()
})

it('uses the native waveform rate and drains each sample once', async () => {
  const { result } = setup()
  await act(async () => { await result.current.toggleMic() })
  expect(result.current.waveSource?.samplesPerSecond).toBe(689)
  invoke.mockResolvedValue([0.1, -0.2])
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_wave', { recordingId: 'fixture-recording' }))
  expect(result.current.waveSource?.read()).toEqual([0.1, -0.2])
  expect(result.current.waveSource?.read()).toEqual([])
})
