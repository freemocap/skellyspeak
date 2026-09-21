import { expect, it } from 'vitest'
import { errorDetails, scrubErrorText } from './error-details'

it('retains the actual runtime explanation and source frames without URL secrets', () => {
  const error = new Error('Maximum update depth exceeded. This can happen when a component repeatedly calls setState.')
  error.stack = `${error.message}\n    at LearningPicker (http://user:pass@localhost:1420/src/features/settings/language/LanguagePickers.tsx?t=secret:51:9)\nrender@http://localhost:1420/assets/app.js?token=secret:27:3`
  const details = errorDetails(error)
  expect(details.message).toBe(error.message)
  expect(details.stack).toContain('LanguagePickers.tsx:51:9')
  expect(details.stack).toContain('app.js:27:3')
  for (const secret of ['user:pass', 'localhost', '?', 'secret']) expect(JSON.stringify(details).replaceAll('[secret redacted]', '')).not.toContain(secret)
})
it('removes credentials and echoed content while preserving the failure explanation', () => {
  const message = 'Selection failed: invalid credentials; api_key=short-key; Bearer abc123; https://example.com/?key=other; transcript=private words'
  const clean = scrubErrorText(message)
  expect(clean).toContain('Selection failed: invalid credentials')
  for (const secret of ['short-key', 'abc123', 'example.com', 'private words']) expect(clean).not.toContain(secret)
  expect(scrubErrorText('Parse failed near "private sentence"', ['private sentence'])).toBe('Parse failed near "[user content redacted]"' )
})
it('removes known private values echoed in a message and preserves nested diagnostic metadata', () => {
  const details = errorDetails({ message: 'Rejected short-secret at validation', diagnostics: {
    api_key: 'short-secret', content: 'private text', request_id: 'req-123', stage: 'decode', usage: { tokens: 12 }, unknown: 'unreviewed',
  } })
  expect(details.message).toBe('Rejected [user content redacted] at validation')
  expect(details.metadata).toMatchObject({ request_id: 'req-123', stage: 'decode', usage: { tokens: 12 } })
  for (const secret of ['short-secret', 'private text', 'unreviewed']) expect(JSON.stringify(details).replaceAll('[secret redacted]', '')).not.toContain(secret)
})
it('retains nested causes, bounds long messages and handles cyclic values and throwing accessors', () => {
  const cause = new Error('Permission denied')
  const error = new Error('Language selection failed', { cause })
  Object.defineProperty(cause, 'cause', { value: error })
  expect(errorDetails(error)).toMatchObject({ cause: { message: 'Permission denied', cause: { message: '[omitted: circular cause]' } } })
  expect(scrubErrorText('error '.repeat(1000))).toContain('[truncated: string limit]')
  expect(errorDetails({ get message() { throw new Error('unsafe') } }).message).toBe('[unreadable: property]')
})

it('redacts quoted credential assignments and private keys without erasing the error', () => {
  for (const value of [
    'Request failed: {"api_key":"short-secret"}',
    'Request failed: Authorization: Basic short-secret',
    'Request failed: refreshToken=short-secret',
    'Request failed: -----BEGIN PRIVATE KEY-----\nshort-secret\n-----END PRIVATE KEY-----',
  ]) {
    expect(scrubErrorText(value)).toContain('Request failed')
    expect(scrubErrorText(value)).not.toContain('short-secret')
  }
})

it('preserves the property responsible for a JavaScript TypeError', () => {
  expect(scrubErrorText("Cannot read properties of undefined (reading 'varieties')"))
    .toBe('Cannot read properties of undefined (reading property varieties)')
})

it('retains root error codes, refusal receipts and camelCase provider fields', () => {
  const details = errorDetails({ code: 'admission_held', message: 'Speech is held', refusal: { reason: 'rate_limit', requestId: 'req-42', retryAt: 123 }, diagnostics: { requestedModel: 'speech-v1', actualModel: 'speech-v2', providerId: 'provider-42', finish_reason: 'length' } })
  expect(details).toMatchObject({ code: 'admission_held', fields: { refusal: { reason: 'rate_limit', requestId: 'req-42', retryAt: 123 } }, metadata: { requestedModel: 'speech-v1', actualModel: 'speech-v2', providerId: 'provider-42', finish_reason: 'length' } })
})

it('summarizes provider explanations and causes instead of an object string', async () => {
  const { errorMessage } = await import('./error-details')
  expect(errorMessage({ code: 'provider', message: 'Speech request failed', diagnostics: { response: { error: { message: 'Model does not support audio', code: 'unsupported_model' } } } })).toContain('Model does not support audio')
  expect(errorMessage(new Error('Request failed', { cause: new Error('Connection refused') }))).toContain('Connection refused')
  expect(errorMessage({ detail: 'No speech model configured' })).toBe('No speech model configured')
  expect(errorMessage({ status: 503, secret: 'private' })).not.toContain('[object Object]')
})

it('preserves novel reasons and quoted validation descriptions while removing supplied content', () => {
  const message = 'Field "language" failed validation: "must be a supported language code". Received private-utterance; api_key=short-secret'
  const clean = scrubErrorText(message, ['private-utterance'])
  expect(clean).toContain('Field "language" failed validation: "must be a supported language code"')
  expect(clean).not.toContain('private-utterance')
  expect(clean).not.toContain('short-secret')
})
