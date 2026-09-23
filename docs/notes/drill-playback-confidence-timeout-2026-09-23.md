# Drill playback, recognition reliability and silence timeout

Implemented in source. No deployment or commit was performed. Device interaction
and real-provider calibration remain unverified.

## Behavior

- Both reference and recorded-take playback buttons switch to Stop, using the
  existing abortable audio lifecycle. This also cancels a pending reference request.
- Auto listening stops after 10 seconds of continuous below-threshold audio by
  default. Recording settings offer 5, 10, 15, 30 and 60 seconds. The shared native
  detector owns timing, including initial silence, activity resets and live tuning.
  A timeout releases capture normally; accepted queued takes finish processing.
- Recognition reliability is distinct from similarity to the target. New production
  Drill attempts receive a stored reliability assessment. No detected activity,
  provider no-speech probability above 0.6, recognition confidence below 0.6, or
  missing confidence makes an attempt unscored. Transcript and raw text comparison
  remain available. Unreliable attempts do not contribute exact matches, best
  scores, mean scores or word-grid evidence. Their recording attempt count remains.
- Low confidence uses `--danger-ink/tint`; accepted confidence uses
  `--success-ink/tint` (the coach's red/cyan status roles), through Drill's existing
  chip component styles. Unavailable confidence is neutral. The UI names confidence
  separately from match percentage and states the cutoff.

## Evidence and limitations

The service summarizes confidence before verbose metadata can be truncated:
`exp(mean(logprob))` over word entries for ElevenLabs and over segment average
log probabilities for Groq. It preserves the source and count and marks incomplete
or invalid likelihood data unavailable. Language-detection probability is never
used as recognition confidence. Groq no-speech evidence uses the largest valid
segment probability. Provider field meanings: [@groq_transcription_confidence],
[@elevenlabs_transcription_confidence].

The 0.6 cutoffs are initial product policy, not research-established calibration.
Provider word/segment likelihoods are not calibrated probabilities of correctness
and are not directly comparable measurement units. The local energy detector is
an activity heuristic: it can reject silence but cannot reliably distinguish
speech from every environmental noise. This does not validate pronunciation.

The server includes a bounded `transcription_confidence` summary; the native
adapter retains declared scalar fields even when general diagnostic limits are
reached. Native publication stores reliability alongside the comparison in the
existing transaction, independently of optional diagnostic truncation. Existing
historical comparisons are not silently reinterpreted. No schema reset is needed.

Correction after inspecting the running service's receipts: confidence evidence was
already arriving at `usage.diagnostics.response.segments[].avg_logprob` and
`no_speech_prob`. The initial implementation incorrectly required the new summary.
The native transport now normalizes those existing declared segment/word fields
before applying general diagnostic truncation, while preferring a full-response
summary when supplied. Truncated or invalid metric lists remain explicitly
unavailable. This correction works with the running server without deployment.
Previously stored failed evaluations are not rewritten; new recordings use the
corrected extraction. The server has not been deployed.

## Verification

- UI: 115 tests passed across Drill, Drill statistics, recording and architecture.
  Includes playback cancellation, timeout controls, immediate queue hydration,
  recognition status colors, and rejection from word evidence.
- Server: 280 inference tests passed, including adapter confidence, invalid/missing
  data, long responses, transcript preservation and diagnostic redaction.
- Native: 28 recording tests and 38 Drill tests passed, plus the adapter metadata
  limit regression. Includes silence boundaries, live tuning, draining a queued
  take after timeout, cross-script reliability and transactional score exclusion.
- Production UI build, style-token check and preview type-check passed. Existing
  jsdom canvas and large-bundle notices remain.
- Native content validation passed for all 20 languages. The initial bibliography
  edit used an invalid review enum and caused a startup error; it was corrected
  to `reviewed`, with the review date moved into `review-notes`.

Contracts are generated from Rust, including settings defaults and reliability.
The exporter trims generated declaration line endings to avoid trailing whitespace.

## Confidence wiring correction

The observed Groq response contained `avg_logprob = -0.05339829` and
`no_speech_prob = 0.0012197495`, which yields 0.9480023574 under the declared
recognition calculation. The initial unavailable label was a wiring error, not
missing provider support. Added tests cover the exact content-free response shape,
word evidence, truncated/invalid evidence, and decoding through the native Drill
gate. No transcript or credentials were copied into fixtures.

Correction verification: all 12 transcription regressions passed, including the
observed-response-to-Drill-gate test and local mock-provider transport tests.
