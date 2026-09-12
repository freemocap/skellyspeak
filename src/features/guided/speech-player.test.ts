// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { playSpeechAudio } from './speech-player'
import { setPlaybackAllowed, setVoiceVolume } from '../../platform/audio/speech'

const audio0 = { status: 'ready', operationId: 'op', messageId: 'message', attemptId: 'attempt', mime: 'audio/mpeg', audioBase64: 'AA==' } as const

interface Media {
  play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn>
  removeAttribute: ReturnType<typeof vi.fn>; onended: (() => void) | null; onerror: (() => void) | null
  playbackRate: number; volume: number; preservesPitch: boolean
}

function stubAudio(): { media: Media[]; revoke: ReturnType<typeof vi.fn> } {
  const media: Media[] = []
  vi.stubGlobal('Audio', vi.fn(function () {
    const element: Media = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(), onended: null, onerror: null, playbackRate: 1, volume: 1, preservesPitch: false }
    media.push(element)
    return element
  }))
  const revoke = vi.fn()
  let urls = 0
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => `blob:${++urls}`), revokeObjectURL: revoke })
  return { media, revoke }
}

// Playback authority is module state, so every test restores it.
afterEach(() => { setPlaybackAllowed(true); vi.unstubAllGlobals() })

it('owns the blob URL and releases playback resources once on stop', async () => {
  const { media, revoke } = stubAudio()
  const player = playSpeechAudio(audio0, vi.fn(), vi.fn(), 0.65, 0.4)
  expect(media[0]).toMatchObject({ playbackRate: 0.65, volume: 0.4, preservesPitch: true })
  await player.play()
  expect(media[0].play).toHaveBeenCalledOnce()
  player.stop(); player.stop()
  expect(media[0].pause).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:1')
  expect(media[0].onended).toBeNull()
})

it('applies a volume change to the utterance that is playing and mutes by ending it', async () => {
  const { media } = stubAudio()
  const ended = vi.fn()
  const player = playSpeechAudio(audio0, ended, vi.fn(), 1, 0.8)
  await player.play()
  setVoiceVolume(0.25)
  expect(media[0].volume).toBe(0.25)
  setVoiceVolume(0)
  expect(media[0].pause).toHaveBeenCalledOnce()
  expect(ended).toHaveBeenCalledOnce()
})

it('suspension ends the active utterance exactly once and survives repeat suspension', async () => {
  const { media, revoke } = stubAudio()
  const ended = vi.fn()
  const player = playSpeechAudio(audio0, ended, vi.fn())
  await player.play()
  setPlaybackAllowed(false)
  setPlaybackAllowed(false)
  expect(media[0].pause).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledOnce()
  expect(ended).toHaveBeenCalledOnce()
  expect(() => setVoiceVolume(0.5)).not.toThrow()
  expect(media[0].volume).toBe(1)
})

it('an older utterance releasing late does not steal the newer registration', async () => {
  const { media } = stubAudio()
  const first = playSpeechAudio(audio0, vi.fn(), vi.fn(), 1, 1)
  const second = playSpeechAudio({ ...audio0, messageId: 'newer' }, vi.fn(), vi.fn(), 1, 1)
  first.stop()
  setVoiceVolume(0.5)
  expect(media[1].volume).toBe(0.5)
  expect(media[0].volume).toBe(1)
  setPlaybackAllowed(false)
  expect(media[1].pause).toHaveBeenCalledOnce()
  void second
})

it('rejects late registration while suspended and cannot replay a released handle', async () => {
  const { media, revoke } = stubAudio()
  const ended = vi.fn()
  setPlaybackAllowed(false)
  const player = playSpeechAudio(audio0, ended, vi.fn())
  await player.play()
  setPlaybackAllowed(true)
  await player.play()
  expect(media[0].play).not.toHaveBeenCalled()
  expect(ended).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledOnce()
})

it('treats a play promise aborted by suspension as an ended utterance', async () => {
  const { media } = stubAudio()
  const ended = vi.fn()
  const player = playSpeechAudio(audio0, ended, vi.fn())
  let reject!: (error: Error) => void
  media[0].play.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  const playing = player.play()
  setPlaybackAllowed(false)
  reject(new Error('Playback interrupted'))
  await expect(playing).resolves.toBeUndefined()
  expect(ended).toHaveBeenCalledOnce()
})

it('propagates a play promise rejection while the utterance is active', async () => {
  const { media } = stubAudio()
  const player = playSpeechAudio(audio0, vi.fn(), vi.fn())
  media[0].play.mockRejectedValueOnce(new Error('Playback denied'))
  await expect(player.play()).rejects.toThrow('Playback denied')
  player.stop()
})
