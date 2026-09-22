# Provider success validation audit — 2026-09-22

Status: implemented in the working tree, automated verification complete. Not
committed, deployed, installed on the iPad, or verified against live providers.

## Finding

The observed Groq response was HTTP 200 with usable transcript text. SkellySpeak
returned HTTP 502/AUDIO_RESPONSE_INVALID because a word ended at 1.82 seconds in
an approximately 1.7627-second recording. A roughly 57 ms alignment difference
does not invalidate speech recognition. It only affects whether the app can use
that alignment for timing analysis. This adapter failure is not intrinsically
iOS-specific; other platforms reaching the same hosted response decoder were
exposed to it too.

The broader pattern was repeated all-or-nothing response validation: required
content, optional provider reporting, generation preferences and durable state
constraints were treated as equally necessary for success. Several tests explicitly
required these needless failures. A larger timing tolerance would perpetuate the
same problem and has been superseded.

## Scope and implemented changes

Reviewed active native/server completion, transcription and speech decoding;
native publication into conversation, reading, coaching, assessment and partner
generation; and the UI consumers of those results. Archived code is excluded.

| Area | Previous failure trigger | Implemented behavior |
| --- | --- | --- |
| Hosted Groq/ElevenLabs transcription | Word timing outside recording, malformed optional timing or detection metadata | Return usable text; omit unusable timing with an explicit diagnostic. Preserve valid timing unchanged and original redacted metadata. Empty text from a successful silence transcription is valid. |
| Native transcription | Timing decode, alignment/text mismatch, confidence/segment fields could discard text | Decode text independently; optional timing failure leaves text successful. Removed the obsolete all-or-nothing Whisper parser. |
| JSON transcription responses | Incorrect or missing JSON MIME header despite readable JSON | Parse the bounded response body; JSON decoding determines readability. Raw PCM retains its format contract. |
| Native chat responses | Missing request ID/model/finish label, absent or unrepresentable usage counters | Use returned content; mark unavailable reporting fields explicitly and retain bounded redacted response metadata. Do not invent token counts or actual cost. |
| Conversation, translation, generation, coaching, assessment, reading | Any finish reason other than `stop` | A finish label such as `length` alone no longer rejects usable content. Explicit provider errors and unreadable required content remain failures. |
| Assessment | Returned model name not matching the expected family | Preserve reported model identity without discarding otherwise usable assessment. |
| Hosted/custom TTS response | Missing usage receipt or mismatched model metadata | Decode playable canonical audio independently of optional usage fields. |
| Streaming speech | Missing expiry/ID marker, unusual finish label, usage-only event or optional transcript irregularity | Publish decodable audio when stream framing completes; retain reporting metadata without requiring redundant audio markers. |
| Speech publication | Token counters exceeding database integer width or non-stop metadata | Publish valid audio. Retain original counters in per-attempt diagnostics/context; leave unrepresentable typed counters unavailable. |
| Structured model output | Harmless extra JSON fields | Provider response types accept extras while requiring fields actually used by the feature. Command/storage strictness is not globally disabled. |
| Reply help | Exact requested item counts, short display text limits, duplicate suggestions, missing frame placeholder, heuristic script/romanization checks | Keep usable generated help. Prompt/schema guidance remains; presentation preferences no longer reject the response. |
| Coaching observations | 160-character display targets, multiple help items, unused cues, substring-based answer-leak heuristic | Accept usable observations; existing deterministic policy selects displayed help. Exact learner-source and evidence ownership checks remain. |
| Word glosses and reading help | 256-character display target or unsolicited romanization | Accept readable help within overall response bounds; preserve actual source-span checks. |
| Prose | Emoji alone made returned text invalid | Emoji presence no longer fails validation. Existing mixed-prose cleanup remains, but cannot turn an emoji-only successful reply into an empty failure. |

The shared hosted timing helper is included in Docker and cloud upload manifests.
No automatic retries, new providers or speculative provider fallbacks were added.

## Deliberately retained checks

HTTP success is sufficient transport success. It cannot by itself supply missing
required content or make undecodable audio playable. Required JSON fields/types,
actual provider errors, bounded payloads and the supported audio wire format are
still checked. The hosted/custom TTS wire format remains nonempty mono 24 kHz
16-bit PCM WAV; this audit does not implement arbitrary-format audio conversion.
Streaming speech still requires valid framing, complete PCM samples and stream
completion. Optional transcript/timing/reporting defects do not invalidate the
primary usable result.

Stateful publication still checks cancellation, current operation/source identity,
quote and grapheme references, known constructs and outcome types, and consistent
repair evidence. These checks prevent applying results to the wrong text or
awarding learner credit from contradictory/stale records. Duplicate evidence for
one construct is distinct from duplicate display suggestions. Overall response
resource bounds remain; short presentation targets remain in generation guidance.

This is a scoped audit and implementation, not proof that every possible response
shape from every provider will work. New adapters still need provider-specific
decoding. Diagnostics retain non-content response information with existing
redaction; unknown fields are not blindly persisted as raw bodies.

## Verification

- Native library: 532 passed, 6 ignored. Includes local HTTP fixtures, successful
  publication despite finish metadata, oversized counters, missing reporting
  fields, timing defects, extra fields, longer help and retained source checks.
- Server: 531 passed, 7 skipped. Includes Groq/ElevenLabs adapter and hosted-route
  regressions returning success for unusable optional timing, plus packaging.
- UI: 1,086 passed across 162 files.
- Rust Clippy with warnings denied, Rust formatting, generated contract check and
  diff whitespace check passed.
- No live provider requests or device end-to-end validation in these tests.

The deployed server and installed app have not changed in this audit. The hosted
Groq fix requires deployment; native changes require a rebuilt app. No commit was
created. Deployment still requires explicit authorization under the repository
working agreement.
