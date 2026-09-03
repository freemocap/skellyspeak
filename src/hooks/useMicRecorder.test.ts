// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMicRecorder } from './useMicRecorder'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('../lib/log', () => ({ logInfo: vi.fn(), logDebug: vi.fn(), logWarn: vi.fn() }))

const reportFault = vi.hoisted(() => vi.fn())
vi.mock('../lib/faults', () => ({ reportFault }))

/// The core's answers for the desktop path. `mic_start` reports the waveform
/// rate; `mic_stop` hands back base64 audio.
function coreRecords(overrides: Record<string, unknown> = {}) {
  invoke.mockImplementation((cmd: string) => {
    const answers: Record<string, unknown> = {
      mic_native: true,
      mic_start: 750,
      mic_wave: [],
      mic_stop: 'BASE64WAV',
      mic_cancel: undefined,
      transcribe_audio: 'hola',
      ...overrides,
    }
    if (!(cmd in answers)) throw new Error(`unexpected command: ${cmd}`)
    return Promise.resolve(answers[cmd])
  })
}

function setup() {
  const onTranscribe = vi.fn()
  const hook = renderHook(() =>
    useMicRecorder({ micDeviceId: null, onTranscribe, buildPrompt: () => 'hint' })
  )
  return { ...hook, onTranscribe }
}

beforeEach(() => {
  invoke.mockReset()
  reportFault.mockReset()
})

describe('choosing a recorder', () => {
  it('records through the core when the core says it does', async () => {
    // The macOS bug this exists for: `navigator.mediaDevices` is undefined
    // there, so touching the browser API at all would throw before the core
    // was ever asked.
    coreRecords()
    expect(navigator.mediaDevices).toBeUndefined()

    const { result } = setup()
    await act(async () => {
      await result.current.toggleMic()
    })

    expect(invoke).toHaveBeenCalledWith('mic_start', { device: null })
    await waitFor(() => expect(result.current.recording).toBe(true))
    expect(reportFault).not.toHaveBeenCalled()
  })

  it('passes the chosen device through to the core', async () => {
    coreRecords()
    const onTranscribe = vi.fn()
    const { result } = renderHook(() =>
      useMicRecorder({
        micDeviceId: 'Yeti Stereo Microphone',
        onTranscribe,
        buildPrompt: () => '',
      })
    )
    await act(async () => {
      await result.current.toggleMic()
    })
    expect(invoke).toHaveBeenCalledWith('mic_start', { device: 'Yeti Stereo Microphone' })
  })

  it('reports a device that will not open instead of recording silently', async () => {
    invoke.mockImplementation((cmd: string) => {
      if (cmd === 'mic_native') return Promise.resolve(true)
      if (cmd === 'mic_start') return Promise.reject(new Error('microphone in use'))
      throw new Error(`unexpected command: ${cmd}`)
    })
    const { result } = setup()
    await act(async () => {
      await result.current.toggleMic()
    })
    expect(reportFault).toHaveBeenCalled()
    // Crucially it must not look like it is recording when it is not.
    expect(result.current.recording).toBe(false)
    expect(result.current.waveSource).toBeNull()
  })
})

describe('finishing a core recording', () => {
  it('transcribes what the core returns', async () => {
    coreRecords()
    const { result, onTranscribe } = setup()
    await act(async () => {
      await result.current.toggleMic()
    })
    await act(async () => {
      await result.current.toggleMic()
    })
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('transcribe_audio', {
        audioBase64: 'BASE64WAV',
        prompt: 'hint',
      })
    )
    await waitFor(() => expect(onTranscribe).toHaveBeenCalledWith('hola'))
    expect(result.current.recording).toBe(false)
  })

  it('throws the audio away on cancel and never transcribes it', async () => {
    coreRecords()
    const { result, onTranscribe } = setup()
    await act(async () => {
      await result.current.toggleMic()
    })
    act(() => {
      result.current.cancel()
    })
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_cancel'))
    expect(invoke).not.toHaveBeenCalledWith('mic_stop')
    expect(onTranscribe).not.toHaveBeenCalled()
    expect(result.current.recording).toBe(false)
  })

  it('does nothing when cancelled with nothing running', () => {
    coreRecords()
    const { result } = setup()
    act(() => {
      result.current.cancel()
    })
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('the waveform the strip reads', () => {
  it('reports the rate the core gave, not an assumed 48kHz', async () => {
    // A device running at 44.1kHz decimates to 689/s, not 750. Assuming the
    // wrong one puts a visible drift in the strip's time axis.
    coreRecords({ mic_start: 689 })
    const { result } = setup()
    await act(async () => {
      await result.current.toggleMic()
    })
    await waitFor(() => expect(result.current.waveSource?.samplesPerSecond).toBe(689))
  })

  it('hands each sample over exactly once', async () => {
    coreRecords({ mic_wave: [0.1, -0.2] })
    const { result } = setup()
    await act(async () => {
      await result.current.toggleMic()
    })
    await waitFor(() => expect(result.current.waveSource).not.toBeNull())
    // Poll once so there is something buffered, then drain twice: the strip
    // must not redraw the same samples on the following frame.
    await act(async () => {
      await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('mic_wave'))
    })
    await waitFor(() => expect(result.current.waveSource?.read().length).toBeGreaterThan(0))
    expect(result.current.waveSource?.read()).toEqual([])
  })
})
