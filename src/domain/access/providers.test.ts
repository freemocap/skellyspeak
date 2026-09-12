import { describe, expect, it } from 'vitest'
import { needsProviderSetup } from './providers'

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
