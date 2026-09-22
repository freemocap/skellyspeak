// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { installPlaybackLifecycle } from './playback-lifecycle'
import { setPlaybackAllowed, speechPlaybackPermit } from './speech'

vi.mock('./reward-sounds', () => ({ setRewardPlaybackAllowed: vi.fn(), unlockRewardAudio: vi.fn() }))
afterEach(() => { vi.restoreAllMocks(); setPlaybackAllowed(true) })

it('recovers missing webview focus on real interaction without overriding suspension', () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(false)
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const listen = vi.spyOn(window, 'addEventListener')
  const lifecycle = installPlaybackLifecycle()
  const activate = listen.mock.calls.find(([name]) => name === 'pointerup')![1] as EventListener
  try {
    expect(speechPlaybackPermit()).toBeNull()
    activate({ isTrusted: false } as Event)
    expect(speechPlaybackPermit()).toBeNull()
    activate({ isTrusted: true } as Event)
    expect(speechPlaybackPermit()).not.toBeNull()
    lifecycle.suspend()
    activate({ isTrusted: true } as Event)
    expect(speechPlaybackPermit()).toBeNull()
    lifecycle.resume()
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    activate({ isTrusted: true } as Event)
    expect(speechPlaybackPermit()).toBeNull()
  } finally { lifecycle.dispose() }
})

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
