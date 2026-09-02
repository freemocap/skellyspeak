import { describe, expect, it } from 'vitest'
import { CLOUD, CUSTOM, HOSTED, usesCredential, type Credential } from './providers'

const ALL: Credential[] = ['openrouter', 'groq', 'custom']

describe('which credentials a provider mode asks for', () => {
  it('asks hosted users for nothing at all', () => {
    // The whole point of the hosted service: installing the app is enough.
    // A key field on screen here reads as something broken.
    for (const credential of ALL) {
      expect(usesCredential(HOSTED, credential)).toBe(false)
    }
  })

  it('asks cloud users for both keys but not a server one', () => {
    expect(usesCredential(CLOUD, 'openrouter')).toBe(true)
    // OpenRouter does not serve Whisper, so speech-to-text still needs Groq.
    expect(usesCredential(CLOUD, 'groq')).toBe(true)
    expect(usesCredential(CLOUD, 'custom')).toBe(false)
  })

  it('still asks custom-server users for the cloud keys', () => {
    // A local Ollama serves neither Whisper nor speech synthesis, so both
    // keys stay relevant even though chat goes elsewhere. Hiding the
    // OpenRouter field here is what made `tts_endpoint`'s "add one in
    // Settings" message impossible to act on.
    expect(usesCredential(CUSTOM, 'custom')).toBe(true)
    expect(usesCredential(CUSTOM, 'openrouter')).toBe(true)
    expect(usesCredential(CUSTOM, 'groq')).toBe(true)
  })

  it('shows everything for an unrecognised mode rather than an empty panel', () => {
    for (const credential of ALL) {
      expect(usesCredential('somethingelse', credential)).toBe(true)
    }
  })
})
