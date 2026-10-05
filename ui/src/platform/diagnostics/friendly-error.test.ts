import { describe, expect, it } from 'vitest'
import { friendlyError } from './friendly-error'

// 2026-10-03T13:20:00Z: the next 00:00 UTC is 2026-10-04T00:00:00Z.
const NOW = Date.UTC(2026, 9, 3, 13, 20)
const NEXT_MIDNIGHT = Date.UTC(2026, 9, 4)

describe('friendlyError', () => {
  it('reads an exhausted personal allowance as credits that return at the refusal time', () => {
    const retryAt = (NOW + 3_600_000) / 1000
    expect(friendlyError({ code: 'admission_held', message: 'Held', refusal: { reason: 'daily_limit', serviceWide: true, retryAt, requestId: null } }, NOW))
      .toEqual({ kind: 'credits', level: 'needs-you', resetAt: NOW + 3_600_000 })
  })

  it('falls back to the next 00:00 UTC when only the native sentence survived', () => {
    const sentence = 'Your remaining daily allowance cannot cover this request. Wait for pending requests to finish or for the 00:00 UTC reset.'
    expect(friendlyError(sentence, NOW)).toEqual({ kind: 'credits', level: 'needs-you', resetAt: NEXT_MIDNIGHT })
    expect(friendlyError({ code: 'PERSONAL_ALLOWANCE_EXHAUSTED', refusal: { reason: 'daily_limit', retryAt: 1 } }, NOW).resetAt).toBe(NEXT_MIDNIGHT)
  })

  it('separates the shared allowance from the personal one', () => {
    expect(friendlyError('The shared remaining daily allowance cannot cover this request. Your personal token balance may still be positive. Wait for pending requests to finish or for the 00:00 UTC reset.', NOW).kind).toBe('shared-credits')
    expect(friendlyError({ code: 'SHARED_ALLOWANCE_EXHAUSTED' }, NOW).kind).toBe('shared-credits')
    expect(friendlyError('Hosted HTTP 429: Your daily authenticated-request limit is exhausted. Resets at 00:00 UTC. No automatic retry was made.', NOW).kind).toBe('credits')
  })

  it('treats provider and service rate limits as a busy service, never as spent credits', () => {
    for (const error of [
      'AI provider error: google/gemini-2.5-flash-lite is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: [secret redacted]',
      'ElevenLabs HTTP 429: The provider rate limit was reached. This is separate from your SkellySpeak allowance. Usage is unconfirmed; no automatic retry was made.',
      'Transcription is busy. Try again shortly.',
      { code: 'provider', message: 'Refused', refusal: { reason: 'rate_limit', serviceWide: false, retryAt: null, requestId: null } },
      { message: 'ElevenLabs system_busy', diagnostics: { status: 429, message: 'Heavy traffic. Try again.' } },
    ]) expect(friendlyError(error, NOW)).toEqual({ kind: 'busy', level: 'passing', resetAt: null })
  })

  it('names a paused service without inventing a return time', () => {
    expect(friendlyError('Hosted spending is paused while a provider billing discrepancy is investigated. Signing in again will not clear this service-side pause.', NOW))
      .toEqual({ kind: 'service-paused', level: 'passing', resetAt: null })
    expect(friendlyError({ refusal: { reason: 'spending_paused', retryAt: null } }, NOW).kind).toBe('service-paused')
  })

  it('tells an unreachable service from a connection that dropped mid-request', () => {
    expect(friendlyError('Could not reach the AI server. No inference request was accepted. Check the connection and retry.', NOW).kind).toBe('offline')
    expect(friendlyError({ code: 'provider', message: 'Could not reach the hosted account service.', diagnostics: { reason: 'transport_failed', stage: 'hosted_account' } }, NOW).kind).toBe('offline')
    expect(friendlyError({ code: 'unknown_outcome', message: 'grouped_request: transport_failed. Provider processing may have occurred; no automatic retry was made.', diagnostics: { reason: 'transport_failed', stage: 'grouped_request' } }, NOW))
      .toEqual({ kind: 'dropped', level: 'passing', resetAt: null })
    expect(friendlyError('speech_stream: decode_failed. Provider processing may have occurred; no automatic retry was made.', NOW).kind).toBe('dropped')
  })

  it('recognises rejected AI output, a silent microphone, a stop and an expired session', () => {
    expect(friendlyError('Coach observation rejected: output exceeds 32768 bytes.', NOW).kind).toBe('unusable-answer')
    expect(friendlyError('Translation: result does not match the source message', NOW).kind).toBe('unusable-answer')
    expect(friendlyError(new Error('The microphone captured no audio samples.'), NOW)).toEqual({ kind: 'silent-microphone', level: 'needs-you', resetAt: null })
    expect(friendlyError({ code: 'conflict', message: 'Listening is stopping.' }, NOW).kind).toBe('stopped')
    expect(friendlyError('Speech consumer was cancelled.', NOW).kind).toBe('stopped')
    expect(friendlyError({ code: 'session_expired', message: 'Session ended.' }, NOW).kind).toBe('signed-out')
    expect(friendlyError('This session was signed out remotely. Sign in again.', NOW).kind).toBe('signed-out')
  })

  it('keeps the app\'s own sentence for a failure it does not recognise', () => {
    expect(friendlyError('Enter between 1 and 512 characters to practise.', NOW))
      .toEqual({ kind: 'unknown', level: 'broke', resetAt: null, explanation: 'Enter between 1 and 512 characters to practise.' })
    expect(friendlyError({ code: 'conflict', message: 'Account installation limit reached.' }, NOW)).toMatchObject({ kind: 'unknown', explanation: 'Account installation limit reached.' })
    expect(friendlyError('Saving failed. — database is locked — SQLITE_BUSY', NOW)).toMatchObject({ kind: 'unknown', explanation: 'Saving failed.' })
  })

  it('offers no sentence when the failure only has machine output', () => {
    for (const error of ['{"error":{"code":500,"status":"INTERNAL"}}', 'persona_reply: schema_mismatch at $.items[0]', 'GET https://example.invalid/v1 failed', 'x'.repeat(201), null, '', new Error('')])
      expect(friendlyError(error, NOW)).toEqual({ kind: 'unknown', level: 'broke', resetAt: null, explanation: null })
  })

  it('reads codes from envelopes only, not from request content', () => {
    expect(friendlyError({ message: 'Saved.', messages: [{ code: 'PERSONAL_ALLOWANCE_EXHAUSTED' }], prompt: { status: 429 } }, NOW).kind).toBe('unknown')
  })
})
