# Friendly error summaries (2026-10-04)

Status: implemented behavior in `ui/`, with its verification. No native or
server change.

## What changed

Error surfaces lead with a plain-words summary. The recorded explanation and
diagnostics stay on the same surface, one fold away under "Technical details".
Nothing is removed from the durable log or the AI activity view.

- `ui/src/platform/diagnostics/friendly-error.ts` classifies a failure from
  envelope codes (`code`, `reason`, `status`, `refusal.reason`, `refusal.retryAt`)
  and, where a surface only kept the sentence, from the fixed native wording in
  `native/src/ai/hosted/mod.rs`. Request content is never read.
- `ui/src/components/feedback/FriendlyError.tsx` holds the wording and the shared
  pieces. Every message is in all seven interface locales.
- `ErrorDetails`, `FaultBar` and the reply bubble's failure reason (`ReplyStatus`)
  always show a summary. `ErrorNotice` shows one for failures it recognises and
  otherwise renders its owner's children as written; an inline `span` notice is
  never changed, because it cannot hold a fold.

## Kinds and levels

| Kind | Level | Recognised by |
| --- | --- | --- |
| `credits` | needs-you | `refusal.reason: daily_limit`, `PERSONAL_*` daily codes, "daily allowance cannot cover" |
| `shared-credits` | needs-you | `SHARED_*` daily codes, "The shared remaining daily allowance" |
| `signed-out` | needs-you | `session_expired`, "Sign in again" |
| `silent-microphone` | needs-you | "microphone captured no audio" |
| `offline` | needs-you | `connection_failed`, "Could not reach the" |
| `service-paused` | passing | `spending_paused`, "spending is paused" |
| `busy` | passing | `rate_limit`, HTTP 429 without a quota code, "rate-limited" |
| `stopped` | passing | "Listening is stopping", "was cancelled" |
| `dropped` | passing | `unknown_outcome`, `transport_failed`, `decode_failed` |
| `unusable-answer` | passing | "Coach observation rejected", "Translation: result does not match" |
| `unknown` | broke | everything else |

`passing` is neutral, `needs-you` uses the warning family and `broke` the danger
family (`ui/src/styles/components/errors.css`).

An `unknown` failure keeps the app's own sentence as its body when that sentence
reads as prose: at most 200 characters, with no structure characters,
identifiers, addresses, status lines or redaction tags. Otherwise the body is
"Try again, and open the details if it keeps happening." and the recorded text
is folded.

## Credits

Daily credits show when they return: the refusal's `retryAt` when the envelope
carries one, otherwise the next 00:00 UTC, formatted in the interface locale and
the device's time zone. Buying credits does not exist yet, so the personal
`credits` kind shows a disabled "Add credits · Coming soon" button.

## Open questions

- A provider rate limit reaches the UI without its own code or reason; it is
  recognised by HTTP 429 metadata or by the provider's "rate-limited" wording.
  A dedicated native reason would remove the text match.
- The fault bar keeps one dark-red panel for every level.

## Verification

Run on 2026-10-04 in a separate checkout of `skill-radar-levels` (`6b4f1f2`)
carrying the UI working tree's uncommitted changes, without its uncommitted
native changes:

- `tsc --noEmit` in `ui/`: passed.
- `vitest run` in `ui/`: 1779 passed, 2 failed. Both failures are in
  `tests/architecture/ipc-commands.test.ts` and name `get_skill_guide`, a command
  the checkout's older `native/` does not register. They need a rerun against the
  real working tree.
- Fast-gate checks run one by one: localization sources, localization usage,
  diagnostic policy, styles, validation tooling types and its regression tests
  passed. Rust formatting was not run; no Rust file changed.
- `npm run build`: passed.
- Looked at in a browser: light and dark themes in English, and the Arabic and
  German wording, for `ErrorDetails`, `ErrorNotice`, `FaultBar` and the held
  reply bubble.

Not verified: the running application, right-to-left layout inside the app shell
and a review of the six translations by a fluent reader.
