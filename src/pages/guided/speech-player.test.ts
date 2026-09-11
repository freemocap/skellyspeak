// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { playSpeechAudio } from './speech-player'
afterEach(() => vi.unstubAllGlobals())
it('owns the blob URL and releases playback resources once on stop', async () => {
  const media = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(), onended: null, onerror: null }
  const construct = vi.fn(function () { return media })
  vi.stubGlobal('Audio', construct)
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fixture'), revokeObjectURL: revoke })
  const player = playSpeechAudio({ status: 'ready', operationId: 'op', messageId: 'message', attemptId: 'attempt', mime: 'audio/mpeg', audioBase64: 'AA==' }, vi.fn(), vi.fn())
  await player.play()
  expect(construct).toHaveBeenCalledWith('blob:fixture')
  expect(media.play).toHaveBeenCalledOnce()
  player.stop(); player.stop()
  expect(media.pause).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:fixture')
  expect(media.onended).toBeNull()
})
