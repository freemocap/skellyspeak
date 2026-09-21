# Speech variety routing — September 20, 2026

## Confirmed gap

Conversation execution already captures the selected language and variety in
`SpeechInput.language` (for example, `Spanish — Mexico`). OpenRouter included
that value in its system instruction. Hosted/custom transport discarded it,
sending only model and text; the server used its single configured voice.
This source finding does not identify the user's active route or prove the
reported recording's accent.

## Implemented

Hosted/custom speech now requires `model`, `text`, and `language`. Native
transport forwards the captured language/variety unchanged. Server admission
validates the value and passes it to the ElevenLabs adapter. Eleven v3 input
gets a bracketed accent cue, e.g. `[Spanish — Mexico accent]`, followed by the
unchanged source text. Domain messages are not edited. Provider text limits and
allowance estimates include the cue. Unsupported accent models and malformed or
missing variety fail before reservation. Provider error redaction covers both
the full tagged input and the original text, while retaining useful errors.
OpenRouter instructions now explicitly request regional pronunciation and
intonation throughout.

Accent tags are the documented v3 control mechanism [@elevenlabs_accent_tags_20260920].
The generic cue wording for each configured variety remains a listening hypothesis,
not a measured pronunciation guarantee. The service's configured voice still
influences the result. No voice-library selection, voice creation, or language-name
to ISO-code guessing was introduced.

## Verification

- 58 native transport tests passed, including a mock HTTP assertion that the
  service receives Spanish/Mexico. After updating the OpenRouter fixture to
  Spanish/Mexico, its 12 speech tests also passed.
- 246 server inference/diagnostics tests passed. Coverage includes Mexico versus
  Spain cues, malformed/missing variety, unsupported models, tagged input limits,
  allowance accounting, source preservation, and original-source redaction.
- `git diff --check` passed. One existing Starlette/httpx deprecation warning.
- Tests use mock providers, with no live synthesis or listening validation.

## Activation and remaining verification

Native and server must run matching updated source because the hosted request
contract now requires language. Restart/rebuild local processes or separately
authorize a hosted deployment as applicable. No deployment or commit was made.
Existing cached audio is unchanged; listen to a newly generated reply to assess
accent. If the current voice resists the cue, regional voice selection is the
next focused step. No actual accent improvement is claimed until heard.
