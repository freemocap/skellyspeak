// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isSpeaking, setPlaybackRate, speakSmart, stopSpeaking, subscribeSpeechProgress, type SpeechProgress } from './speech'

const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('./tauri', () => ({ invoke: backend.invoke }))

class AudioPlayer {
  static latest: AudioPlayer | undefined
  currentTime = 0
  duration = 10
  playbackRate = 1
  preservesPitch = false
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  onpause: (() => void) | null = null
  play = vi.fn(async () => {})
  pause = vi.fn()
  constructor() { AudioPlayer.latest = this }
}

beforeEach(() => {
  AudioPlayer.latest = undefined
  backend.invoke.mockReset().mockResolvedValue({ audio_base64: 'AAAAAA==', mime: 'audio/wav' })
  vi.stubGlobal('Audio', AudioPlayer)
  URL.createObjectURL = vi.fn(() => 'blob:test-audio')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { stopSpeaking(); vi.unstubAllGlobals() })

it('slows cloud audio without changing pitch and clears on completion', async () => {
  const events: (SpeechProgress | null)[] = []
  const unsubscribe = subscribeSpeechProgress((event) => events.push(event))
  const played = speakSmart('hola mundo', 'es', 'cloud', 'nova', 0.5, 'turn-1')
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  const audio = AudioPlayer.latest!
  expect(audio.playbackRate).toBe(0.5)
  expect(audio.preservesPitch).toBe(true)
  expect(events.at(-1)).toEqual({ utteranceId: 'turn-1' })
  setPlaybackRate(0.8)
  expect(audio.playbackRate).toBe(0.8)
  audio.onended?.()
  expect(await played).toBe(true)
  expect(events.at(-1)).toBeNull()
  expect(isSpeaking()).toBe(false)
  unsubscribe()
})

it('does not play a synthesis response that arrives after stop', async () => {
  let deliver!: (value: { audio_base64: string; mime: string }) => void
  backend.invoke.mockImplementation(() => new Promise((resolve) => { deliver = resolve }))
  const played = speakSmart('late response', 'en', 'cloud', 'nova', 1, 'turn-2')
  stopSpeaking()
  deliver({ audio_base64: 'AAAAAA==', mime: 'audio/wav' })
  expect(await played).toBe(false)
  expect(isSpeaking()).toBe(false)
})

it('surfaces media playback errors and clears the active state', async () => {
  const played = speakSmart('playback failure', 'en', 'cloud', 'nova', 1, 'turn-3')
  const rejected = expect(played).rejects.toThrow('could not be played')
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  AudioPlayer.latest!.onerror?.()
  await rejected
  expect(isSpeaking()).toBe(false)
})

it('shares an in-flight synthesis and caches replay without another request', async () => {
  let deliver!: (value: { audio_base64: string; mime: string }) => void
  backend.invoke.mockImplementation(() => new Promise((resolve) => { deliver = resolve }))
  const first = speakSmart('shared synthesis', 'en', 'cloud', 'nova', 1, 'first')
  const second = speakSmart('shared synthesis', 'en', 'cloud', 'nova', 0.5, 'second')
  expect(backend.invoke).toHaveBeenCalledTimes(1)
  deliver({ audio_base64: 'AAAAAA==', mime: 'audio/wav' })
  expect(await first).toBe(false)
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  AudioPlayer.latest!.onended?.()
  expect(await second).toBe(true)
  AudioPlayer.latest = undefined
  const replay = speakSmart('shared synthesis', 'en', 'cloud', 'nova', 0.8, 'replay')
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  expect(backend.invoke).toHaveBeenCalledTimes(1)
  AudioPlayer.latest!.onended?.()
  expect(await replay).toBe(true)
})

it('passes speed to the OS voice and clears state when it finishes', async () => {
  const synth = { getVoices: () => [{ lang: 'en-US' }], cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  const played = speakSmart('OS voice test', 'en', 'os', 'nova', 0.65, 'os')
  expect(synth.speak).toHaveBeenCalledTimes(1)
  const utterance = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance
  expect(utterance.rate).toBe(0.65)
  utterance.dispatchEvent = vi.fn()
  utterance.onend?.call(utterance, {} as SpeechSynthesisEvent)
  expect(await played).toBe(true)
  expect(isSpeaking()).toBe(false)
})
