import { describe, expect, it } from 'vitest'
import { CLOUD, CUSTOM, HOSTED, needsProviderSetup, usesCredential, type Credential } from './providers'

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

describe('offering a way out of a provider failure', () => {
  it('recognises every message the core sends about configuring a provider', () => {
    // These are the literal strings from settings.rs.
    for (const message of [
      'Sign in to use the free hosted service, or choose a different AI provider, in Settings.',
      'No OpenRouter API key configured. Open Settings and add your key.',
      "No server address configured. Open Settings, and under AI provider enter your server's address (for example http://localhost:11434/v1).",
      'No model configured for your server. Open Settings, and under AI provider enter the model name your server serves.',
      'Voice input needs a Groq API key. Add one in Settings, or switch your AI provider to the free hosted service.',
      'Cloud speech needs an OpenRouter API key, whichever provider handles chat. Add one in Settings, switch your AI provider to the free hosted service, or set Speech engine to the OS voice.',
      'Unknown AI provider mode "nonsense". Open Settings and choose one under AI provider.',
    ]) {
      expect(needsProviderSetup(message), message).toBe(true)
    }
  })

  it('leaves ordinary failures alone', () => {
    // A rate limit or a network blip is not fixed by opening Settings, so the
    // banner should not offer it.
    for (const message of [
      'The tutor hit a rate limit — give it a few seconds and try again.',
      'The tutor returned an empty reply. Please try again.',
      'could not reach the hosted service: connection refused',
    ]) {
      expect(needsProviderSetup(message), message).toBe(false)
    }
  })
})
