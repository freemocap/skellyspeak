// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isSpeaking, setVoiceVolume, setPlaybackAllowed, setPlaybackRate, speakSmart, stopSpeaking, subscribeSpeechProgress, type SpeechProgress } from './speech'
import { configureAudioVolumes } from './audio-volume'
import { installPlaybackLifecycle } from '../playback-lifecycle'

const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../ipc/tauri', () => ({ invoke: backend.invoke }))

class AudioPlayer {
  static latest: AudioPlayer | undefined
  volume = 1
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
  setVoiceVolume(1)
  AudioPlayer.latest = undefined
  backend.invoke.mockReset().mockResolvedValue({ audio_base64: 'AAAAAA==', mime: 'audio/wav' })
  vi.stubGlobal('Audio', AudioPlayer)
  URL.createObjectURL = vi.fn(() => 'blob:test-audio')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { stopSpeaking(); setPlaybackAllowed(true); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it.each(['blur', 'pagehide', 'beforeunload'])('cancels cloud playback on %s and blocks background auto-play', async eventName => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const lifecycle = installPlaybackLifecycle()
  try {
    const played = speakSmart(`leaving app ${eventName}`, 'en', 'cloud', 'nova', 1, 'leaving', null, 'lifecycle')
    await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
    const audio = AudioPlayer.latest!
    window.dispatchEvent(new Event(eventName))
    expect(await played).toBe(false)
    expect(audio.pause).toHaveBeenCalled()
    expect(isSpeaking()).toBe(false)
    const requests = backend.invoke.mock.calls.length
    expect(await speakSmart('new reply in background', 'en', 'cloud', 'nova', 1, 'background', null, 'lifecycle')).toBe(false)
    expect(backend.invoke).toHaveBeenCalledTimes(requests)
    window.dispatchEvent(new Event('pageshow'))
    window.dispatchEvent(new Event('focus'))
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(isSpeaking()).toBe(false)
  } finally { lifecycle.dispose() }
})

it('invalidates pending synthesis when hidden, even if it completes after returning', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const lifecycle = installPlaybackLifecycle()
  let deliver!: (value: { audio_base64: string; mime: string }) => void
  backend.invoke.mockImplementation(() => new Promise(resolve => { deliver = resolve }))
  try {
    const played = speakSmart('hidden synthesis', 'en', 'cloud', 'nova', 1, 'hidden', null, 'lifecycle')
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    deliver({ audio_base64: 'AAAAAA==', mime: 'audio/wav' })
    expect(await played).toBe(false)
    expect(AudioPlayer.latest).toBeUndefined()
    expect(isSpeaking()).toBe(false)
  } finally { lifecycle.dispose() }
})

it('cancels OS speech on native suspension and never resumes the old utterance', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const synth = { getVoices: () => [{ lang: 'en-US' }], cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  const lifecycle = installPlaybackLifecycle()
  try {
    const played = speakSmart('native background', 'en', 'os', 'nova', 1, 'os', null, 'lifecycle')
    expect(synth.speak).toHaveBeenCalledTimes(1)
    const cancellations = synth.cancel.mock.calls.length
    lifecycle.suspend()
    expect(await played).toBe(false)
    expect(synth.cancel.mock.calls.length).toBeGreaterThan(cancellations)
    lifecycle.focus(true)
    expect(await speakSmart('still suspended', 'en', 'os', 'nova', 1, 'os', null, 'lifecycle')).toBe(false)
    lifecycle.resume()
    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(isSpeaking()).toBe(false)
    const fresh = speakSmart('fresh playback', 'en', 'os', 'nova', 1, 'os-new', null, 'lifecycle')
    expect(synth.speak).toHaveBeenCalledTimes(2)
    stopSpeaking()
    expect(await fresh).toBe(false)
  } finally { lifecycle.dispose() }
})

it('does not start OS speech when a partner lookup completes after native close', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const synth = { getVoices: () => [{ lang: 'en-US' }], cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  const lifecycle = installPlaybackLifecycle()
  let deliver!: (value: { persona: { id: string } }) => void
  backend.invoke.mockImplementation(() => new Promise(resolve => { deliver = resolve }))
  try {
    const played = speakSmart('late OS lookup', 'en', 'os', 'nova', 1, 'os', 'chat', 'lifecycle')
    lifecycle.close()
    deliver({ persona: { id: '__none__' } })
    expect(await played).toBe(false)
    expect(synth.speak).not.toHaveBeenCalled()
    expect(isSpeaking()).toBe(false)
  } finally { lifecycle.dispose() }
})

it('slows cloud audio without changing pitch and clears on completion', async () => {
  const events: (SpeechProgress | null)[] = []
  const unsubscribe = subscribeSpeechProgress((event) => events.push(event))
  const played = speakSmart('hola mundo', 'es', 'cloud', 'nova', 0.5, 'turn-1', null, 'test-pair' )
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
  const played = speakSmart('late response', 'en', 'cloud', 'nova', 1, 'turn-2', null, 'test-pair' )
  stopSpeaking()
  deliver({ audio_base64: 'AAAAAA==', mime: 'audio/wav' })
  expect(await played).toBe(false)
  expect(isSpeaking()).toBe(false)
})

it('surfaces media playback errors and clears the active state', async () => {
  const played = speakSmart('playback failure', 'en', 'cloud', 'nova', 1, 'turn-3', null, 'test-pair' )
  const rejected = expect(played).rejects.toThrow('could not be played')
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  AudioPlayer.latest!.onerror?.()
  await rejected
  expect(isSpeaking()).toBe(false)
})

it('shares an in-flight synthesis and caches replay without another request', async () => {
  let deliver!: (value: { audio_base64: string; mime: string }) => void
  backend.invoke.mockImplementation(() => new Promise((resolve) => { deliver = resolve }))
  const first = speakSmart('shared synthesis', 'en', 'cloud', 'nova', 1, 'first', null, 'test-pair' )
  const second = speakSmart('shared synthesis', 'en', 'cloud', 'nova', 0.5, 'second', null, 'test-pair' )
  expect(backend.invoke).toHaveBeenCalledTimes(1)
  deliver({ audio_base64: 'AAAAAA==', mime: 'audio/wav' })
  expect(await first).toBe(false)
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  AudioPlayer.latest!.onended?.()
  expect(await second).toBe(true)
  AudioPlayer.latest = undefined
  const replay = speakSmart('shared synthesis', 'en', 'cloud', 'nova', 0.8, 'replay', null, 'test-pair' )
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  expect(backend.invoke).toHaveBeenCalledTimes(1)
  AudioPlayer.latest!.onended?.()
  expect(await replay).toBe(true)
})

it('passes speed to the OS voice and clears state when it finishes', async () => {
  const synth = { getVoices: () => [{ lang: 'en-US' }], cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  const played = speakSmart('OS voice test', 'en', 'os', 'nova', 0.65, 'os', null, 'test-pair' )
  expect(synth.speak).toHaveBeenCalledTimes(1)
  const utterance = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance
  expect(utterance.rate).toBe(0.65)
  utterance.dispatchEvent = vi.fn()
  utterance.onend?.call(utterance, {} as SpeechSynthesisEvent)
  expect(await played).toBe(true)
  expect(isSpeaking()).toBe(false)
})

it('does not reuse synthesized audio across language-pair settings scopes', async () => {
  const first = speakSmart('scope test', 'es', 'cloud', 'nova', 1, 'one', 'chat', 'es:en:1')
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  AudioPlayer.latest!.onended!()
  await first
  const previousAudio = AudioPlayer.latest
  const second = speakSmart('scope test', 'es', 'cloud', 'nova', 1, 'two', 'chat', 'es:fr:2')
  await vi.waitFor(() => expect(backend.invoke).toHaveBeenCalledTimes(2))
  await vi.waitFor(() => expect(AudioPlayer.latest).not.toBe(previousAudio))
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  AudioPlayer.latest!.onended!()
  await second
})

it('scales cloud speech by master and voice, changes live volume, and mutes without another synthesis', async () => {
  configureAudioVolumes({ master_volume: 50, voice_volume: 80, effects_volume: 10 })
  const played = speakSmart('volume controls', 'en', 'cloud', 'nova', 1, 'volume', null, 'volume-test')
  await vi.waitFor(() => expect(AudioPlayer.latest?.play).toHaveBeenCalled())
  expect(AudioPlayer.latest!.volume).toBeCloseTo(.4)
  configureAudioVolumes({ master_volume: 25, voice_volume: 80, effects_volume: 100 })
  expect(AudioPlayer.latest!.volume).toBeCloseTo(.2)
  configureAudioVolumes({ master_volume: 0, voice_volume: 80, effects_volume: 100 })
  expect(await played).toBe(false)
  backend.invoke.mockClear()
  expect(await speakSmart('muted', 'en', 'cloud', 'nova', 1, 'muted', null, 'volume-test')).toBe(false)
  expect(backend.invoke).not.toHaveBeenCalled()
})

it('applies voice and master volume to OS speech independently of effects', async () => {
  const synth = { getVoices: () => [{ lang: 'en-US' }], cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  configureAudioVolumes({ master_volume: 80, voice_volume: 25, effects_volume: 0 })
  const played = speakSmart('OS volume', 'en', 'os', 'nova', 1, 'volume', null, 'volume-test')
  expect(synth.speak.mock.calls[0][0].volume).toBeCloseTo(.2)
  setVoiceVolume(0)
  expect(await played).toBe(false)
  expect(synth.cancel).toHaveBeenCalled()
})
