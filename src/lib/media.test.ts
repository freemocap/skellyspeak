// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mediaDevices } from './media'

/// jsdom defines `navigator` but not `navigator.mediaDevices`, which is
/// exactly the macOS situation.
function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value,
    configurable: true,
  })
}

afterEach(() => {
  setMediaDevices(undefined)
})

describe('reaching the microphone API', () => {
  it('hands back the real API when the context is secure', () => {
    const fake = { getUserMedia: () => {}, enumerateDevices: () => {} }
    setMediaDevices(fake)
    expect(mediaDevices()).toBe(fake)
  })

  it('explains itself instead of throwing a TypeError', () => {
    setMediaDevices(undefined)
    // The bare `navigator.mediaDevices.getUserMedia(...)` this replaced threw
    // "undefined is not an object", which reached the user unchanged and told
    // them nothing about what to do.
    expect(() => mediaDevices()).toThrow(/did not offer a microphone/i)
    expect(() => mediaDevices()).not.toThrow(TypeError)
  })

  it('tells the user what still works, so the message is actionable', () => {
    setMediaDevices(undefined)
    let message = ''
    try {
      mediaDevices()
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toMatch(/Android settings/)
    expect(message).toMatch(/Type your reply/)
  })
})
