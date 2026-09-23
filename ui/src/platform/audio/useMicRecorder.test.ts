// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { RecordingOwner, TranscriptionInspectionResult } from '../../generated/contracts'
import { useMicRecorder } from './useMicRecorder'
const transcript: TranscriptionInspectionResult = {
  text: 'fixture transcript', audioBase64: '', diagnostics: null,
  inspection: { recordingId: 'fixture-recording', owner: { kind: 'conversation', id: 'fixture-conversation' }, duration: 1, sampleRate: 16000,
    waveform: { binSeconds: 0.5, min: [-0.4, -0.2], max: [0.4, 0.2] },
    spectrogram: { frameSeconds: 0.5, frameStartSeconds: [0, 0.5], windowSeconds: 0.025, fftSize: 512, bands: [{ lowHz: 50, centerHz: 100, highHz: 200 }, { lowHz: 100, centerHz: 200, highHz: 400 }], minFrequencyHz: 50, maxFrequencyHz: 400, measuredMaxFrequencyHz: 400, melScale: 'htk', normalization: 'unit-peak triangular filters', dbReference: '0 dB = full-scale power (1.0)', dbMin: -80, dbMax: 0, bins: [[-60, -30], [-70, -20]] },
    activity: { algorithm: 'fixture', noiseFloorDbfs: -60, thresholdDbfs: -40, regions: [{ start: 0.1, end: 0.9 }], pauses: [], limitations: [] },
    wordTiming: { status: 'unavailable', reason: 'Provider returned text only.', words: [], unsupported: [] } },
}
const invoke = vi.hoisted(() => vi.fn())
const fault = vi.hoisted(() => vi.fn())
const browserStart = vi.hoisted(() => vi.fn())
vi.mock('./browser-recording', () => ({ startBrowserRecording: browserStart }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../diagnostics/faults', () => ({ reportFault: fault }))
beforeEach(() => {
  invoke.mockReset(); fault.mockReset(); browserStart.mockReset()
  invoke.mockImplementation(async (command: string) => {
    if (command === 'mic_start') return { recordingId: 'fixture-recording', samplesPerSecond: 689 }
    if (command === 'mic_wave') return []
    if (command === 'mic_transcribe') return transcript
    if (command === 'mic_cancel') return
    throw new Error(`Unexpected native command: ${command}`)
  })
})
it('uses browser capture when native requires it even with a desktop user agent', async () => {
  const capture = { wave: { samplesPerSecond: 60, read: () => [] }, cancel: vi.fn(), finish: vi.fn().mockResolvedValue('wav-base64') }
  browserStart.mockResolvedValue(capture)
  invoke.mockImplementation(async (command: string) => {
    if (command === 'mic_start') return { recordingId: 'fixture-recording', samplesPerSecond: 750, browserCapture: true }
    if (command === 'mic_transcribe') return transcript
    throw new Error(`Unexpected native command: ${command}`)
  })
  const { result } = setup()
  await act(async () => { await result.current.toggleMic() })
  expect(browserStart).toHaveBeenCalledOnce()
  expect(result.current.waveSource).toBe(capture.wave)
  await act(async () => { await result.current.toggleMic() })
  expect(invoke).toHaveBeenCalledWith('mic_transcribe', { recordingId: 'fixture-recording', audioBase64: 'wav-base64' })
})
const conversation = (id: string): RecordingOwner => ({ kind: 'conversation', id })
function setup() {
  const onTranscribe = vi.fn()
  return { ...renderHook(({ owner }) => useMicRecorder({ owner, onTranscribe }),
    { initialProps: { owner: conversation('fixture-conversation') } }), onTranscribe }
}
it('does no native work on mount and starts capture for the selected conversation only on action', async () => {
  const { result } = setup()
  expect(invoke).not.toHaveBeenCalled()
  await act(async () => { await result.current.toggleMic() })
  expect(invoke).toHaveBeenCalledWith('mic_start', { owner: conversation('fixture-conversation') })
  expect(result.current.recording).toBe(true)
})
it('transcribes the recording ID once on explicit Stop', async () => {
  const { result, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  await act(async () => { await result.current.toggleMic() })
  expect(invoke).toHaveBeenCalledWith('mic_transcribe', { recordingId: 'fixture-recording' })
  expect(onTranscribe).toHaveBeenCalledExactlyOnceWith('fixture transcript')
  expect(result.current.lastTranscription).toEqual(transcript)
})
it('cancels capture without transcription when the conversation changes', async () => {
  const { result, rerender, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  rerender({ owner: conversation('different-conversation') })
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
  let finish!: (text: TranscriptionInspectionResult) => void
  invoke.mockImplementation((command: string) => {
    if (command === 'mic_start') return Promise.resolve({ recordingId: 'fixture-recording', samplesPerSecond: 689 })
    if (command === 'mic_transcribe') return new Promise<TranscriptionInspectionResult>(resolve => { finish = resolve })
    return Promise.resolve([])
  })
  const { result, rerender, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  let pending!: Promise<void>
  act(() => { pending = result.current.toggleMic() })
  expect(result.current.transcribing).toBe(true)
  await act(async () => { await result.current.toggleMic() })
  expect(invoke.mock.calls.filter(([command]) => command === 'mic_start')).toHaveLength(1)
  rerender({ owner: conversation('different-conversation') })
  await act(async () => { finish(transcript); await pending })
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

it('clears the completed inspection when leaving its conversation', async () => {
  const { result, rerender } = setup()
  await act(async () => { await result.current.toggleMic() })
  await act(async () => { await result.current.toggleMic() })
  rerender({ owner: conversation('different-conversation') })
  expect(result.current.lastTranscription).toBeNull()
  rerender({ owner: conversation('fixture-conversation') })
  expect(result.current.lastTranscription).toBeNull()
})
it.each([
  ['recording', { recordingId: 'wrong' }],
  ['owner id', { owner: conversation('wrong') }],
  ['owner kind', { owner: { kind: 'drillItem', id: 'fixture-conversation' } as RecordingOwner }],
])('rejects a result belonging to another %s', async (_case, wrong) => {
  const { result, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  invoke.mockResolvedValue({ ...transcript, inspection: { ...transcript.inspection, ...wrong } })
  await act(async () => { await result.current.toggleMic() })
  expect(onTranscribe).not.toHaveBeenCalled()
  expect(result.current.lastTranscription).toBeNull()
  expect(fault).toHaveBeenCalled()
})
it('keeps inspection of an empty transcript without changing the composer', async () => {
  const { result, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  invoke.mockResolvedValue({ ...transcript, text: '' })
  await act(async () => { await result.current.toggleMic() })
  expect(result.current.lastTranscription?.text).toBe('')
  expect(onTranscribe).not.toHaveBeenCalled()
})

it('keeps playback excluded until native cancellation acknowledges the stop, including unmount', async () => {
  const { speechPlaybackPermit } = await import('./speech')
  let finish!: () => void
  const original = invoke.getMockImplementation()!
  invoke.mockImplementation((command: string, args: unknown) => command === 'mic_cancel'
    ? new Promise<void>(resolve => { finish = resolve }) : original(command, args))
  const { result, unmount } = setup()
  await act(async () => { await result.current.toggleMic() })
  act(() => result.current.cancel())
  expect(speechPlaybackPermit()).toBeNull()
  unmount()
  expect(speechPlaybackPermit()).toBeNull()
  await act(async () => { finish() })
  expect(speechPlaybackPermit()).not.toBeNull()
})

it('notifies publication after navigation even though the old composer discards the result', async () => {
  const { onRecordingPublished } = await import('./recording-events')
  const published = vi.fn()
  const unsubscribe = onRecordingPublished(published)
  let finish!: (value: TranscriptionInspectionResult) => void
  const original = invoke.getMockImplementation()!
  invoke.mockImplementation((command: string, args: unknown) => command === 'mic_transcribe'
    ? new Promise(resolve => { finish = resolve }) : original(command, args))
  const { result, unmount, onTranscribe } = setup()
  await act(async () => { await result.current.toggleMic() })
  let pending!: Promise<void>
  act(() => { pending = result.current.toggleMic() })
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_transcribe', expect.anything()))
  unmount()
  await act(async () => { finish(transcript); await pending })
  expect(published).toHaveBeenCalledWith(transcript.inspection.owner)
  expect(onTranscribe).not.toHaveBeenCalled()
  unsubscribe()
})

it('refreshes a Drill owner after post-publication cleanup fails without retranscribing', async () => {
  const { onRecordingPublished } = await import('./recording-events')
  const published = vi.fn()
  const unsubscribe = onRecordingPublished(published)
  const owner: RecordingOwner = { kind: 'drillItem', id: 'phrase' }
  const original = invoke.getMockImplementation()!
  invoke.mockImplementation((command: string, args: unknown) => command === 'mic_transcribe'
    ? Promise.reject(new Error('The attempt is saved; cleanup failed.')) : original(command, args))
  const { result } = renderHook(() => useMicRecorder({ owner, onTranscribe: vi.fn() }))
  await act(async () => { await result.current.toggleMic() })
  await act(async () => { await result.current.toggleMic() })
  expect(published).toHaveBeenCalledWith(owner)
  expect(invoke.mock.calls.filter(([command]) => command === 'mic_transcribe')).toHaveLength(1)
  expect(fault).toHaveBeenCalledWith('Microphone', expect.any(Error))
  unsubscribe()
})

it('continuous listening publishes separate takes and stops through the shared authority', async () => {
  let status = { recordingId: 'listen', listening: true, speaking: false, queued: 0, processing: false, completed: 0, failure: null }
  invoke.mockImplementation(async (command: string) => {
    if (command === 'mic_listen_start') return { recordingId: 'listen', samplesPerSecond: 750, browserCapture: false }
    if (command === 'mic_listen_status') return status
    if (command === 'mic_wave') return []
  })
  const owner: RecordingOwner = { kind: 'drillItem', id: 'phrase' }
  const { result, unmount } = renderHook(() => useMicRecorder({ owner, listening: { pauseMs: 1000, thresholdOffsetDb: 10, minTakeMs: 300 }, onTranscribe: vi.fn() }))
  await act(async () => { await result.current.toggleMic() })
  expect(invoke).toHaveBeenCalledWith('mic_listen_start', { owner, settings: { pauseMs: 1000, thresholdOffsetDb: 10, minTakeMs: 300 } })
  status = { ...status, speaking: true, queued: 2, processing: true, completed: 1 }
  await waitFor(() => expect(result.current.listeningStatus?.queued).toBe(2))
  expect(result.current.recording).toBe(true)
  expect(result.current.transcribing).toBe(true)
  await act(async () => { await result.current.toggleMic() })
  expect(invoke).toHaveBeenCalledWith('mic_listen_stop', { recordingId: 'listen' })
  status = { ...status, listening: false, speaking: false, queued: 0, processing: false, completed: 3 }
  await waitFor(() => expect(result.current.recording).toBe(false))
  expect(result.current.transcribing).toBe(false)
  expect(invoke.mock.calls.some(([command]) => command === 'mic_transcribe')).toBe(false)
  unmount()
})

it('discards only the current continuous take and cancels capture when its owner changes', async () => {
  invoke.mockImplementation(async (command: string) => {
    if (command === 'mic_listen_start') return { recordingId: 'listen', samplesPerSecond: 750, browserCapture: false }
    if (command === 'mic_wave') return []
    if (command === 'mic_listen_status') return { recordingId: 'listen', listening: true, queued: 0, processing: false, completed: 0, speaking: true, failure: null }
  })
  const { result, rerender, unmount } = renderHook(({ owner }) => useMicRecorder({ owner, listening: { pauseMs: 1000, thresholdOffsetDb: 10, minTakeMs: 300 }, onTranscribe: vi.fn() }),
    { initialProps: { owner: { kind: 'drillItem' as const, id: 'first' } } })
  await act(async () => { await result.current.toggleMic() })
  act(() => result.current.discardCurrent())
  expect(invoke).toHaveBeenCalledWith('mic_listen_discard', { recordingId: 'listen' })
  expect(result.current.recording).toBe(true)
  rerender({ owner: { kind: 'drillItem', id: 'second' } })
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_cancel', { recordingId: 'listen' }))
  expect(result.current.listeningStatus).toBeNull()
  unmount()
})

it('suspends continuous capture through the existing playback lifecycle and never auto-resumes', async () => {
  const { setPlaybackAllowed } = await import('./speech')
  let listening = true
  invoke.mockImplementation(async (command: string) => {
    if (command === 'mic_listen_start') return { recordingId: 'listen', samplesPerSecond: 750, browserCapture: false }
    if (command === 'mic_cancel') { listening = false; return }
    if (command === 'mic_wave') return []
    if (command === 'mic_listen_status') return { recordingId: 'listen', listening, queued: 0, processing: false, completed: 0, speaking: false, failure: null }
  })
  const { result, unmount } = renderHook(() => useMicRecorder({ owner: { kind: 'drillItem', id: 'phrase' }, listening: { pauseMs: 1000, thresholdOffsetDb: 10, minTakeMs: 300 }, onTranscribe: vi.fn() }))
  await act(async () => { await result.current.toggleMic() })
  act(() => { setPlaybackAllowed(false) })
  await waitFor(() => expect(result.current.recording).toBe(false))
  expect(result.current.failure).toBeInstanceOf(Error)
  act(() => { setPlaybackAllowed(true) })
  expect(invoke.mock.calls.filter(([command]) => command === 'mic_listen_start')).toHaveLength(1)
  unmount()
})

it('requests only newer spectral frames, merges them and clears history on owner change', async () => {
  const fixture = (await import('../../../tools/spectrogram-fixture.json')).default[0].spectrogram
  let cursor = 0
  invoke.mockImplementation(async (command: string) => {
    if (command === 'mic_listen_start') return { recordingId: 'live', samplesPerSecond: 750, browserCapture: false }
    if (command === 'mic_listen_status') return { recordingId: 'live', listening: true, queued: 0, processing: false, completed: 0, speaking: false, failure: null, takes: [] }
    if (command === 'mic_wave') return []
    if (command === 'mic_listen_spectrogram') {
      const time = cursor++ * .2
      return { endSeconds: time + .2, data: { ...fixture, frameStartSeconds: [time], bins: [fixture.bins[0]] } }
    }
  })
  const { result, rerender, unmount } = renderHook(({ id }) => useMicRecorder({ owner: { kind: 'drillItem', id }, listening: { pauseMs: 1000, thresholdOffsetDb: 10, minTakeMs: 300 }, onTranscribe: vi.fn() }), { initialProps: { id: 'first' } })
  await act(async () => { await result.current.toggleMic() })
  await waitFor(() => expect(result.current.liveSpectrum?.data.frameStartSeconds.length).toBeGreaterThanOrEqual(2))
  expect(result.current.liveSpectrum?.data.frameStartSeconds.slice(0, 2)).toEqual([0, .2])
  expect(invoke).toHaveBeenCalledWith('mic_listen_spectrogram', { recordingId: 'live', afterSeconds: 0 })
  rerender({ id: 'second' })
  expect(result.current.liveSpectrum).toBeNull()
  unmount()
})

it('moves the threshold of the run in progress without restarting capture', async () => {
  invoke.mockImplementation(async (command: string) => {
    if (command === 'mic_listen_start') return { recordingId: 'listen', samplesPerSecond: 750, browserCapture: false }
    if (command === 'mic_wave') return []
    if (command === 'mic_listen_status') return { recordingId: 'listen', listening: true, queued: 0, processing: false, completed: 0, speaking: false, failure: null }
  })
  const listening = { pauseMs: 1000, thresholdOffsetDb: 10, minTakeMs: 300 }
  const { result, unmount } = renderHook(() => useMicRecorder({ owner: { kind: 'drillItem', id: 'phrase' }, listening, onTranscribe: vi.fn() }))
  expect(() => result.current.tune(listening)).toThrow(/only be tuned while listening/)
  await act(async () => { await result.current.toggleMic() })
  act(() => result.current.tune({ ...listening, thresholdOffsetDb: 18 }))
  expect(invoke).toHaveBeenCalledWith('mic_listen_tune', { recordingId: 'listen', settings: { ...listening, thresholdOffsetDb: 18 } })
  expect(invoke.mock.calls.filter(([command]) => command === 'mic_listen_start')).toHaveLength(1)
  unmount()
})
