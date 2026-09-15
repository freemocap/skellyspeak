// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { installPlaybackLifecycle } from './playback-lifecycle'
import { setPlaybackAllowed, speechPlaybackPermit } from './audio/speech'

vi.mock('./audio/reward-sounds', () => ({ setRewardPlaybackAllowed: vi.fn(), unlockRewardAudio: vi.fn() }))
afterEach(() => { vi.restoreAllMocks(); setPlaybackAllowed(true) })

it('blur, visibility, and native suspension independently prohibit late speech', () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const lifecycle = installPlaybackLifecycle()
  try {
    const firstPermit = speechPlaybackPermit()
    expect(firstPermit).not.toBeNull()
    window.dispatchEvent(new Event('blur'))
    expect(speechPlaybackPermit()).toBeNull()
    window.dispatchEvent(new Event('focus'))
    expect(speechPlaybackPermit()).not.toBeNull()
    expect(speechPlaybackPermit()).not.toBe(firstPermit)

    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    expect(speechPlaybackPermit()).toBeNull()
    lifecycle.suspend()
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(speechPlaybackPermit()).toBeNull()
    lifecycle.resume()
    expect(speechPlaybackPermit()).not.toBeNull()

    window.dispatchEvent(new Event('pagehide'))
    expect(speechPlaybackPermit()).toBeNull()
    window.dispatchEvent(new Event('pageshow'))
    expect(speechPlaybackPermit()).not.toBeNull()
  } finally { lifecycle.dispose() }
  expect(speechPlaybackPermit()).toBeNull()
  window.dispatchEvent(new Event('focus'))
  expect(speechPlaybackPermit()).toBeNull()
})
