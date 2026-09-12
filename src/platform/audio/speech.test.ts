import { describe, expect, it } from 'vitest'
import { ttsAvailable } from './speech'

// The speak button's availability depends on the CONFIGURED engine, not on
// the webview's speech synthesis: the cloud engine does not use it, so it must
// stay offered on webviews (such as Android's) that provide none.
describe('ttsAvailable', () => {
  it('offers cloud playback on a webview with no speech synthesis (Android)', () => {
    expect(ttsAvailable('cloud', false)).toBe(true)
  })

  it('offers cloud playback on a webview that does have it (desktop)', () => {
    expect(ttsAvailable('cloud', true)).toBe(true)
  })

  it('offers the OS engine only where the webview can actually speak', () => {
    expect(ttsAvailable('os', true)).toBe(true)
    expect(ttsAvailable('os', false)).toBe(false)
  })
})
