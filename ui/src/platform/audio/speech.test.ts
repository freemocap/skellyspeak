import { afterEach, expect, it } from 'vitest'
import { beginCapture, endCapture, interruptSpeech, microphoneHeld, setPlaybackAllowed, speechPlaybackPermit } from './speech'
let held: object | null = null
afterEach(() => { if (held) endCapture(held); held = null; setPlaybackAllowed(true) })
it('does not re-enable playback when capture ends during lifecycle suspension', () => {
  setPlaybackAllowed(true)
  held = beginCapture()
  setPlaybackAllowed(false)
  endCapture(held)
  expect(speechPlaybackPermit()).toBeNull()
  setPlaybackAllowed(true)
  expect(speechPlaybackPermit()).not.toBeNull()
})
it('refuses a second capture without losing the first claim', () => {
  held = beginCapture()
  expect(() => beginCapture()).toThrow('already running')
  expect(microphoneHeld()).toBe(true)
  expect(interruptSpeech()).toBeNull()
  endCapture({})
  expect(speechPlaybackPermit()).toBeNull()
  endCapture(held)
  expect(interruptSpeech()).not.toBeNull()
})
