# Indic live trial: read-aloud failures

Status: diagnosed from local logs and read-only workspace records on 2026-09-17.
No implementation changes, app restart or new inference performed in this investigation.

## Observed outcomes

Times below are local EDT (UTC minus four hours), using attempt start times.

| Time | Language | Operation | Durable result |
| --- | --- | --- | --- |
| 09:42:35 | Malayalam | Opening | Unknown grouped transport outcome |
| 09:43:23–25 | Malayalam | Opening, speech, explanations, assistance, gloss, translation | All succeeded |
| 09:43:50–51 | Malayalam | Second opening and reading assistance | Text and assistance succeeded; speech failed |
| 09:44:05–06 | Hindi | Opening and reading assistance | Text and assistance succeeded; speech failed |
| 09:44:11 | Hindi | Speech replay | Failed again |

All three speech failures persist the error
`speech_transcript_content_difference`. Requested and actual speech model are
`openai/gpt-audio-mini`. There were no microphone transcription attempts in this
interval. These are generated read-aloud failures, not speech recognition failures.

The custom server started at 09:43:10, after the first failed opening. That timing
supports a connectivity explanation for the earlier transport failure, but the
native record contains a generic incomplete/invalid grouped-response error rather
than a specific connection-refused cause. All 12 subsequent logged HTTP requests
finished with status 200; all six operation groups finished with zero failures.
Native validation and durable publication succeeded for all 15 post-start text
operations. Successful HTTP audio delivery does not establish native audio acceptance.

## Cause established and remaining uncertainty

`native/src/ai/transport/speech_provider.rs` compares the provider's returned audio
transcript to the source. It permits whitespace differences but rejects punctuation,
case and other changes. `Content` is a broad diagnostic category: even canonically
equivalent Unicode strings are currently classified this way (an existing test
explicitly rejects composed versus decomposed accented text).

The rejected provider transcripts and waveforms are not retained in these logs or
attempt records. Therefore these records cannot establish whether the provider
changed words, romanized the sentence, or emitted an equivalent Unicode spelling.
Do not attribute the failures to Indic shaping or claim an NFC fix would resolve
these particular attempts without further evidence. No token-limit or text-gloss
validation failure was observed in the successful post-start exchanges.

Next investigation: add privacy-preserving speech mismatch diagnostics (canonical
equivalence, lengths and script profiles) before changing acceptance policy. Keep
actual content changes rejected. A controlled live reproduction would then identify
which category is responsible; it has not been run here.

## Evidence coverage

Read every manifest-declared stream, including success events and empty streams,
for these runs since the preceding development checkpoint (09:29 EDT):

- `native-1789651795283-47752`
- `native-1789652171485-51058`
- `native-1789652232962-51586`
- `native-1789652270712-51997`
- `native-1789652360326-52276`
- `server-1789652590047718000-55254`

Sources are under ignored `.local/logs/`: native `native.jsonl`, frontend
`diagnostics.jsonl`, server stdout/stderr/logging JSONL, and manifests. No declared
stream was missing. These runs do not contain outer launcher stdout/stderr streams.
Native generic log bodies and frontend console arguments are redacted. Earlier
setup runs contain access-check/frontend errors, not later failed inference.

Read-only SQL joined attempts, operations, turns and conversations from the active
application-support SQLite workspace. Correlated attempt IDs with native inference
records; checked transcription attempts separately. No credentials or conversation
text were exported. The legacy platform log predates this trial and was not used as
trial evidence. Latest inference records examined end at approximately 09:44:13 EDT.

## Speech diagnostic implementation

Added a `speech_validation` event to `native.jsonl` for each speech decoder outcome,
including successful, rejected and interrupted attempts. It is emitted on entry to
`finish_speech`, before publication checks, and carries sanitized attempt/operation
IDs, route, model hash, token counts, an allowlisted finish reason, error code and
`audioAccepted`. This is decoder acceptance, not proof of publication or playback.

`transcriptComparison` contains:

- `complete`: whether the response reached the stream completion boundary without
  interruption. `difference` is null for incomplete streams; absent comparison
  metadata is null when no decoder ran (for example scheduler failure).
- `difference`: the existing acceptance classifier (`exact`, `missing`, `whitespace`,
  `punctuation_or_case`, or `content`). Classification still rejects canonical
  spelling differences; diagnostic normalization does not authorize playback.
- `exact`, `whitespaceEquivalent`, `canonicalEquivalent` and
  `canonicalWhitespaceEquivalent`: comparison checks, using NFC for canonical
  equivalence. `exact` compares untrimmed text; the existing classifier trims edges.
- `firstDifferingScalar`: zero-based Unicode scalar position, not a byte or UTF-16
  offset; a length-only difference points to the end of the shorter text.
- Source/transcript profiles: byte, scalar, grapheme, whitespace, combining-mark,
  joining-control and script counts (Latin, Arabic, Devanagari, Malayalam, Han and
  other letters). Script counts include script-assigned marks; combining-mark counts
  are a separate overlapping category. A profile change can suggest romanization,
  but these aggregates cannot prove identical meaning or explain every substitution.

No source text, transcript, excerpts, codepoint values, audio, provider IDs or
arbitrary error messages enter this event. The original text is untouched. The
existing transcript rejection policy, retry behavior and speech publication rules
are unchanged. A native rebuild/restart is needed before reproducing the issue;
old attempts cannot acquire these diagnostics retroactively.

Verification: all 50 focused speech tests passed, including synthetic loopback
transport, cancellation/publication, unchanged transcript acceptance, canonical
Devanagari/Malayalam comparisons, interrupted-stream metadata, and durable event
redaction. Loopback required execution outside the network-restricted sandbox.
Formatting, diff whitespace, documentation links and strict Clippy (library and tests) passed.
No live provider calls or application restart were performed.

## Unsolicited romanization in the Hindi message

The screenshot's parenthesized line is part of the persisted assistant message,
not UI-generated annotation. Read-only inspection of that message and its captured
system prompt confirms that the model appended a whole-sentence romanization.
The captured prompt instructed Devanagari and referred to a separate reading aid,
but did not explicitly forbid adding parallel text to the conversational reply.
There is no evidence that the Romanization toggle requested the parenthetical.
The toggle displays independently saved word-gloss romanization, hence two layers.

Updated contact-reply prompt v11 to explicitly separate conversational prose from
app-generated reading aids, for both openings and replies. It prohibits unsolicited
parallel romanization, respelling and translation, including copying that pattern
from previous messages. Direct learner questions about language remain answerable.
Clarified Hindi/Malayalam writing guidance: a separate operation generates reading
aids. A regression checks every bundled language and verifies that reading-display
preferences do not change the partner prompt.

Existing messages, source anchors and audio inputs are not rewritten or stripped.
The stored parenthetical also reaches speech as part of the source; this may
complicate transcript matching, but no retained provider transcript establishes
that it caused the observed audio failures. Prompt changes govern newly accepted
turns after a native rebuild; retrying a captured old turn need not use new prompts.
This is an instruction fix, not a deterministic guarantee of future model compliance.

Romanization fix verification: 5 conversation-prompt tests and 25 configuration
tests passed. `languages:check` validated all 9 language definitions and interface
keys. Rust formatting and diff whitespace checks passed. No new live inference
was run; provider compliance still requires a fresh conversation/turn after rebuild.

## Latest trial: 10:02 EDT

Read every declared stream for native run `native-1789653446116-63921` and the
continuing server run `server-1789652590047718000-55254` from 09:57:26 EDT onward:
314 frontend records, 261 native records, 568 server logging records; server
stdout/stderr had no new records. Correlated read-only workspace messages and
attempts. All 23 HTTP requests finished with 200; all 42 text operations returned
native validation records, including one rejected skill assessment.

- Malayalam microphone attempt at 10:02:38 succeeded structurally using
  `whisper-large-v3`, but its auto-sent message used Latin spelling. The native
  adapter returns the provider text; it does not romanize it. Source inspection
  shows the recording path supplies the configured `ml` code and a Latin-script
  `Malayalam — Kerala` prompt hint. The server forwards those decoded form fields
  to Groq. There is no explicit desired-script policy or script validation in this
  transcription path. The hint could contribute to the output style, but logs do
  not establish that causal explanation or the accuracy of the recognized words.
- Malayalam opening TTS at 10:01:59 succeeded with an exact transcript. Reply TTS
  at 10:02:42 failed after a complete stream. Both comparison strings have 22
  scalars, 11 graphemes, 19 Malayalam-script characters, eight combining marks,
  two spaces and no Latin characters. First differing scalar is index 20;
  canonical and canonical-plus-whitespace equivalence are both false. Thus this
  failure is neither Latin romanization nor canonical Unicode normalization.
  The difference starts near the end of the text; the retained aggregates cannot
  identify the provider's replacement character or establish a meaning change.
- The same turn also failed `skill_assessment` with `unknown or duplicate skill`.
  Its JSON shape passed but domain validation rejected the returned skill IDs.
  This is a separate failure from microphone transcription and read-aloud.

No source modifications or new inference performed during this check. Next work
should address transcription script guidance at the shared recording/provider
boundary, and investigate the TTS suffix discrepancy without equating aggregate
`content` classification with a proven semantic error.


## Implemented shared fixes after the latest trial

These changes supersede the earlier transcript acceptance policy described above.

- Recording context now supplies the selected language's native name and latest
  accepted assistant message, bounded to 224 bytes without splitting graphemes.
  The explicit provider language code remains. This replaces the English variety
  label at the shared recording boundary; it is contextual guidance, not a
  guarantee of script choice or recognition accuracy. See
  `groq_transcription_context` in references.bib for provider prompt semantics.
- Speech playback requires valid audio and successful stream completion. Provider
  transcript metadata is not an independent check of the waveform, so differences
  or missing transcript metadata no longer reject complete audio. All content-free
  comparison diagnostics remain available. Malformed, interrupted and unsuccessful
  audio streams still fail. This deliberately changes the shared acceptance policy;
  it does not establish that differing audio faithfully reads the source.
- Skill assessment prompt version 2 requests exact catalog IDs and one judgment
  per skill. Every observation is validated before repeated valid observations are
  consolidated. Conflicting outcomes retain the partial judgment, with one credit
  per skill and replay protection. Unknown IDs and invalid source quotes still fail
  explicitly. The historical combined error cannot establish whether that specific
  result contained unknown IDs or duplicates.

No language-specific exceptions, message rewriting, or automatic provider retries
were introduced by these fixes. The Malayalam suffix test uses synthetic differing
text; it does not reconstruct the unavailable historical provider transcript.

Verification: 51 speech tests and 3 skill-assessment tests passed. Speech tests
include a local HTTP fixture, with no live provider calls. Rust formatting and
Clippy for library/tests with warnings denied passed. A rebuilt native application
and a fresh live microphone/read-aloud trial remain necessary to verify provider
behavior; automated results do not prove recognition or pronunciation quality.
