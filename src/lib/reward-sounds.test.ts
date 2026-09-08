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
  expect(soundPattern({ kind: 'pop' })).toEqual([{ frequency: 700, at: 0, duration: 0.06 }])
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
