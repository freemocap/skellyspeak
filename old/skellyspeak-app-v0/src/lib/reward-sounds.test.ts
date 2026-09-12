// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { soundEnabled, soundPattern } from './reward-sounds'

it('follows Read aloud only in Follow TTS mode', () => {
  expect(soundEnabled('yes', false)).toBe(true)
  expect(soundEnabled('no', true)).toBe(false)
  expect(soundEnabled('follow_tts', false)).toBe(false)
  expect(soundEnabled('follow_tts', true)).toBe(true)
})
it('uses bounded rising rewards and a distinct confusion contour', () => {
  const pop = soundPattern({ kind: 'pop' })
  expect(pop).toHaveLength(2)
  expect(pop[1].frequency).toBeGreaterThan(pop[0].frequency)
  expect(pop[1].at + pop[1].duration).toBeLessThan(.2)
  const small = soundPattern({ kind: 'xp', xp: 2 })
  const large = soundPattern({ kind: 'xp', xp: 1000 })
  expect(large).toHaveLength(4)
  expect(large.at(-1)!.frequency).toBeGreaterThan(small.at(-1)!.frequency)
  expect(large.at(-1)!.at + large.at(-1)!.duration).toBeLessThan(0.35)
  const confused = soundPattern({ kind: 'confused' })
  expect(confused[1].frequency).toBeLessThan(confused[0].frequency)
  expect(() => soundPattern({ kind: 'xp', xp: 0 })).toThrow()
})

const voices: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = []
class Synth {
  state = 'running'
  currentTime = 1
  destination = {}
  resume = vi.fn(async () => {})
  createOscillator() {
    const voice = { type: '', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null }
    voices.push(voice)
    return voice
  }
  createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() } }
}
beforeEach(() => { vi.resetModules(); voices.length = 0; vi.stubGlobal('AudioContext', Synth) })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = '' })

it('synchronizes a visible flash with sound and cancels all scheduled notes when backgrounded', async () => {
  const sound = await import('./reward-sounds')
  const target = document.createElement('button')
  document.body.append(target)
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 50))
  const flash = { cancel: vi.fn(), onfinish: null }
  target.animate = vi.fn(() => flash as unknown as Animation)
  sound.configureRewardSounds('yes', false)
  sound.unlockRewardAudio()
  expect(sound.playRewardSound({ kind: 'xp', xp: 20 }, target)).toBe(true)
  expect(voices).toHaveLength(4)
  expect(target.animate).toHaveBeenCalledOnce()
  sound.setRewardPlaybackAllowed(false)
  for (const voice of voices) expect(voice.stop).toHaveBeenCalledTimes(2)
  expect(flash.cancel).toHaveBeenCalledOnce()
  expect(sound.playRewardSound({ kind: 'understood' }, target)).toBe(false)
  sound.setRewardPlaybackAllowed(true)
  expect(voices).toHaveLength(4)
  sound.configureRewardSounds('no', true)
  expect(sound.playRewardSound({ kind: 'understood' }, target)).toBe(false)
})

it('drops offscreen sounds and caps burst backlog', async () => {
  const sound = await import('./reward-sounds')
  const target = document.createElement('button')
  document.body.append(target)
  const bounds = vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, -100, 50, 20))
  target.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
  sound.configureRewardSounds('yes', false)
  sound.unlockRewardAudio()
  expect(sound.playRewardSound({ kind: 'xp', xp: 2 }, target)).toBe(false)
  expect(target.animate).not.toHaveBeenCalled()
  bounds.mockReturnValue(new DOMRect(10, 10, 50, 20))
  for (let i = 0; i < 20; i++) sound.playRewardSound({ kind: 'xp', xp: 2 }, target)
  expect(voices.length).toBeLessThanOrEqual(8)
  sound.stopRewardSounds()
})

it('plays the visible XP face inside a zero-height button and finishes after the token disappears', async () => {
  const sound = await import('./reward-sounds')
  const message = document.createElement('div')
  message.className = 'msg'
  const button = document.createElement('button')
  const face = document.createElement('span')
  button.append(face)
  message.append(button)
  document.body.append(message)
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 30, 28, 0))
  vi.spyOn(face, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 18, 26, 24))
  const flash: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null } = { cancel: vi.fn(), onfinish: null }
  message.animate = vi.fn(() => flash as unknown as Animation)
  sound.configureRewardSounds('yes', false)
  sound.unlockRewardAudio()
  expect(sound.playRewardSound({ kind: 'pop' }, button)).toBe(false)
  expect(voices).toHaveLength(0)
  expect(sound.playRewardSound({ kind: 'pop' }, face)).toBe(true)
  expect(voices).toHaveLength(2)
  expect(message.animate).toHaveBeenCalledOnce()
  button.remove()
  flash.onfinish!()
  for (const [index, voice] of voices.entries()) {
    const note = soundPattern({ kind: 'pop' })[index]
    expect(voice.start).toHaveBeenCalledWith(1 + note.at)
    expect(voice.stop).toHaveBeenCalledExactlyOnceWith(1 + note.at + note.duration + .01)
    expect(voice.disconnect).not.toHaveBeenCalled()
  }
  sound.stopRewardSounds()
})

it.each(['pointerup', 'touchend'])('unlocks on touch release (%s), recovers interrupted audio, and respects suspension and mute', async eventName => {
  const sound = await import('./reward-sounds')
  const { installPlaybackLifecycle } = await import('./playback-lifecycle')
  const audio = new Synth()
  audio.state = 'suspended'
  let activated = false
  audio.resume.mockImplementation(async () => { if (activated) audio.state = 'running' })
  vi.stubGlobal('AudioContext', class { constructor() { return audio } })
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const lifecycle = installPlaybackLifecycle()
  const target = document.createElement('button')
  document.body.append(target)
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 50))
  target.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
  try {
    sound.configureRewardSounds('follow_tts', true)
    window.dispatchEvent(new Event('pointerdown'))
    expect(audio.state).toBe('suspended')
    activated = true
    // Capture must run even when a token prevents event bubbling.
    target.addEventListener(eventName, event => event.stopPropagation())
    target.dispatchEvent(new Event(eventName, { bubbles: true }))
    await Promise.resolve()
    expect(sound.playRewardSound({ kind: 'xp', xp: 10 }, target)).toBe(true)
    lifecycle.suspend()
    audio.state = 'interrupted'
    audio.resume.mockClear()
    target.dispatchEvent(new Event(eventName, { bubbles: true }))
    expect(audio.resume).not.toHaveBeenCalled()
    lifecycle.resume()
    target.dispatchEvent(new Event(eventName, { bubbles: true }))
    expect(audio.resume).toHaveBeenCalledOnce()
    expect(sound.playRewardSound({ kind: 'understood' }, target)).toBe(true)
    sound.configureRewardSounds('no', true)
    audio.state = 'interrupted'
    audio.resume.mockClear()
    target.dispatchEvent(new Event(eventName, { bubbles: true }))
    expect(audio.resume).not.toHaveBeenCalled()
    sound.configureRewardSounds('yes', false)
    lifecycle.dispose()
    target.dispatchEvent(new Event(eventName, { bubbles: true }))
    expect(audio.resume).not.toHaveBeenCalled()
  } finally { lifecycle.dispose() }
})

it('scales the effects output independently and silences active and future notes at zero', async () => {
  const sound = await import('./reward-sounds')
  const { configureAudioVolumes } = await import('./audio-volume')
  const audio = new Synth()
  const createGain = vi.spyOn(audio, 'createGain')
  vi.stubGlobal('AudioContext', class { constructor() { return audio } })
  configureAudioVolumes({ master_volume: 50, voice_volume: 100, effects_volume: 40 })
  sound.configureRewardSounds('yes', false)
  sound.unlockRewardAudio()
  const output = createGain.mock.results[0].value
  expect(output.gain.value).toBeCloseTo(.2)
  const target = document.createElement('button')
  document.body.append(target)
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 30, 30))
  target.animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
  expect(sound.playRewardSound({ kind: 'pop' }, target)).toBe(true)
  configureAudioVolumes({ master_volume: 50, voice_volume: 0, effects_volume: 80 })
  expect(output.gain.value).toBeCloseTo(.4)
  configureAudioVolumes({ master_volume: 0, voice_volume: 100, effects_volume: 80 })
  expect(output.gain.value).toBe(0)
  expect(sound.playRewardSound({ kind: 'pop' }, target)).toBe(false)
  expect(() => configureAudioVolumes({ master_volume: 101, voice_volume: 100, effects_volume: 80 })).toThrow('Volume')
  sound.stopRewardSounds()
})
