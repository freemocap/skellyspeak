/** What a failure means to the person using the app, chosen from the same
 * reviewed envelopes and native explanations the diagnostics show. This picks
 * the plain-words summary only: every surface keeps the raw explanation beside
 * it, one fold away.
 */
import { errorMessage, isRateLimited } from './error-details'

/** How much a failure asks of the learner: `passing` clears with a retry,
 * `needs-you` stays until they act or time passes, `broke` is unexplained. */
export type FriendlyLevel = 'passing' | 'needs-you' | 'broke'

export type FriendlyError =
  | { kind: 'credits' | 'shared-credits'; level: 'needs-you'; resetAt: number }
  | { kind: 'signed-out' | 'silent-microphone' | 'offline'; level: 'needs-you'; resetAt: null }
  | { kind: 'service-paused' | 'busy' | 'stopped' | 'dropped' | 'unusable-answer'; level: 'passing'; resetAt: null }
  | { kind: 'unknown'; level: 'broke'; resetAt: null; explanation: string | null }

const DAY_MS = 86_400_000

/** Envelope fields that may hold another envelope. Request content is never read. */
const ENVELOPES = ['error', 'response', 'diagnostics', 'http', 'choices', 'provider_error', 'detail', 'refusal', 'cause', 'causes', 'fields', 'metadata', 'hold', 'failure'] as const

const DAILY_CODES = ['daily_limit', 'personal_allowance_exhausted', 'shared_allowance_exhausted', 'personal_account_daily_limit', 'shared_account_daily_limit']
const SHARED_CODES = ['shared_allowance_exhausted', 'shared_account_daily_limit']

// Native explanations are fixed English sentences; a surface that only kept the
// sentence is classified by it. See native/src/ai/hosted/mod.rs.
const DAILY_TEXT = /daily allowance cannot cover|daily (?:authenticated-)?request limit|Daily request limit reached/i
const SHARED_TEXT = /The shared remaining daily allowance|The service's daily/i
const PAUSED_TEXT = /spending is paused/i
const SIGNED_OUT_TEXT = /Sign in again/
const BUSY_TEXT = /rate[- ]limit|Transcription is busy|too many (?:requests|sign-in attempts)/i
const MICROPHONE_TEXT = /microphone captured no audio/i
const STOPPED_TEXT = /Listening is stopping|was cancelled|stopped or its source\/access changed/i
const OFFLINE_TEXT = /Could not reach the|dns error|failed to lookup address/i
const DROPPED_TEXT = /transport_failed|decode_failed|Provider processing may have occurred|outcome is unknown/i
const UNUSABLE_TEXT = /Coach (?:observation|feedback) rejected|Translation: (?:result does not match|source meaning is unclear)|no usable assessment items/i

/** Marks of machine output: structure, identifiers, addresses, status lines,
 * redaction tags and the placeholder for an error that explained nothing. */
const MACHINE_TEXT = /[{}[\]<>=_\\|`\n]|:\/\/|\bHTTP \d|^The error did not include an explanation/
const EXPLANATION_LIMIT = 200

/** The app's own sentence about an unrecognised failure, when it reads as one.
 * `errorMessage` leads with that sentence and chains nested causes after it. */
function explanation(text: string): string | null {
  const sentence = text.split(' — ')[0].trim()
  return sentence && sentence.length <= EXPLANATION_LIMIT && !MACHINE_TEXT.test(sentence) ? sentence : null
}

/** A failing getter on the error being described must not replace that error
 * with a second one, so an unreadable property reads as absent. */
function read(value: object, key: string): unknown {
  try { return Reflect.get(value, key) } catch { return undefined }
}

/** Codes, reasons and the refusal's retry time from known envelopes only. */
function signals(error: unknown): { codes: Set<string>; retryAt: number | null } {
  const codes = new Set<string>()
  let retryAt: number | null = null
  const seen = new WeakSet<object>()
  const visit = (value: unknown, depth: number): void => {
    if (!value || typeof value !== 'object' || depth > 12 || seen.has(value)) return
    seen.add(value)
    if (Array.isArray(value)) { value.slice(0, 64).forEach(item => visit(item, depth + 1)); return }
    for (const key of ['code', 'reason', 'status']) {
      const code = read(value, key)
      if (typeof code === 'string' || typeof code === 'number') codes.add(String(code).toLowerCase())
    }
    const retry = read(value, 'retryAt')
    if (typeof retry === 'number' && Number.isFinite(retry)) retryAt = retry
    for (const key of ENVELOPES) visit(read(value, key), depth + 1)
  }
  visit(error, 0)
  return { codes, retryAt }
}

/** `now` is the caller's clock in epoch milliseconds: daily credits return at
 * the refusal's retry time, or at the next 00:00 UTC when only the sentence is known. */
export function friendlyError(error: unknown, now: number): FriendlyError {
  const text = typeof error === 'string' ? error : errorMessage(error)
  const { codes, retryAt } = signals(error)
  const has = (names: readonly string[]) => names.some(name => codes.has(name))

  if (has(DAILY_CODES) || DAILY_TEXT.test(text)) {
    const refused = retryAt === null ? null : retryAt * 1000
    const resetAt = refused !== null && refused > now ? refused : Math.floor(now / DAY_MS) * DAY_MS + DAY_MS
    return { kind: has(SHARED_CODES) || SHARED_TEXT.test(text) ? 'shared-credits' : 'credits', level: 'needs-you', resetAt }
  }
  if (codes.has('spending_paused') || PAUSED_TEXT.test(text)) return { kind: 'service-paused', level: 'passing', resetAt: null }
  if (codes.has('session_expired') || SIGNED_OUT_TEXT.test(text)) return { kind: 'signed-out', level: 'needs-you', resetAt: null }
  if (codes.has('rate_limit') || isRateLimited(error) || BUSY_TEXT.test(text)) return { kind: 'busy', level: 'passing', resetAt: null }
  if (MICROPHONE_TEXT.test(text)) return { kind: 'silent-microphone', level: 'needs-you', resetAt: null }
  if (STOPPED_TEXT.test(text)) return { kind: 'stopped', level: 'passing', resetAt: null }
  if (codes.has('connection_failed') || OFFLINE_TEXT.test(text)) return { kind: 'offline', level: 'needs-you', resetAt: null }
  if (has(['unknown_outcome', 'transport_failed', 'decode_failed']) || DROPPED_TEXT.test(text)) return { kind: 'dropped', level: 'passing', resetAt: null }
  if (UNUSABLE_TEXT.test(text)) return { kind: 'unusable-answer', level: 'passing', resetAt: null }
  return { kind: 'unknown', level: 'broke', resetAt: null, explanation: explanation(text) }
}
