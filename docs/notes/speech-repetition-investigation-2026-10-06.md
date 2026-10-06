# Speech repetition investigation — 2026-10-06

Status: forward-only source fix implemented; no deployment. Human listening
verification of the fresh comparison clips is pending. Existing unrelated work
in the shared checkout was preserved.

## Observed failures

The learner reported complete repetition of the short English bus-arrival and
trains sentences, and repetition of the initial Spanish “No” in a longer reply.
The learner confirmed that the cached trains WAV repeats outside the conversation
player. This excludes that player as the sole cause, but does not by itself
exclude native assembly: cached WAVs are assembled from provider streams.

Read-only inspection found one speech attempt for the bus example, using
eleven_v4_turbo. The source sentence occurs once in the request. Native preparation
prefixes a bracketed language/variety display label plus “accent” and a newline.
The server sends one dialogue input with its configured voice. Native sends null
language_code; the server omits that optional provider field.

Highlighting is a separate issue: SpeechFollowText subscribes to a global text
and word-range signal. Matching conversation and coaching excerpts can both
highlight; the subscribers do not initiate synthesis or playback.

## Authorized live comparison

Used the configured provider voice, fixed provider origins, PCM 24 kHz, and the
same normalization setting as the application. Sent 15 synthesis requests:
14 succeeded and one bus non-streaming request returned HTTP 429 during concurrent
testing. That failure was not silently retried. Subsequent requests were serial.
No credentials or account voice identifiers are included here.

Independently parsed provider responses were saved locally and compared with the
production server framing parser. Every successful streamed response matched
exactly. No identical nonempty PCM frames were found within those responses.
Non-streaming results were single provider audio objects, without app stream
assembly. The v4 text-to-speech endpoint was also tested separately from dialogue.

With the learner's separate authorization, Groq Whisper transcribed the three
cached failures and 14 fresh outputs. These transcripts are supporting evidence,
not a substitute for human listening; recognition can omit or invent repetitions.

| Source | Model / endpoint | Delivery / cue | Transcript result |
| --- | --- | --- | --- |
| Trains | v4 Turbo / dialogue | Stream / current cue | Entire sentence twice |
| Trains | v4 Turbo / dialogue | Complete / current cue | Entire sentence twice |
| Trains | v4 Turbo / speech | Complete / current cue | Entire sentence twice |
| Trains | v4 Turbo / dialogue | Stream and complete / no cue | Once in each |
| Trains | v4 Turbo / dialogue | Stream / American accent cue | Once |
| Trains | v3 / speech | Stream and complete / current cue | Once in each |
| Bus | v4 Turbo / dialogue | Stream / current cue and no cue | Once in each |
| Spanish reply | v4 Turbo / dialogue | Stream and complete / current cue | Initial No twice in each |
| Spanish reply | v4 Turbo / dialogue | Stream / no cue | Once |
| Spanish reply | v3 / speech | Stream / current cue | Once |

All three cached recordings' transcripts reproduce the learner's reported pattern.
The bus failure did not recur in the fresh successful calls, demonstrating that
the current cue does not always cause repetition. Most conditions have only one
sample; these results do not estimate failure rates or establish accent fidelity.

Local-only WAVs, redacted raw provider responses, request IDs, frame lengths/hashes,
transcripts, and the probe are under `.local/audio-playback-audit/`. Using existing
application allowance rates, successful synthesis totals about USD 0.0498. This
is an estimate, excludes transcription and the failed request, and is not a bill.

## Interpretation and remaining decisions

The evidence strongly implicates the current prepared accent cue interacting with
v4 Turbo: repetition occurs in provider non-streaming output as well as streamed
output, and disappears in this sample when the cue is omitted. It is not evidence
that the UI plays two streams or that our parser duplicates the initial frame.
The exact provider mechanism remains unknown. Do not deduplicate waveform chunks
or cut audio using tag timestamps: that could erase legitimate speech.

Both tested HTTP model paths use base64 PCM audio and original/normalized timing
objects; dialogue additionally includes voice_segments. The observed audio fields
do not require cumulative-buffer subtraction or first-chunk suppression. This
finding concerns the HTTP endpoints actually tested, not WebSocket protocols.

There is also a timing issue: the cached Spanish response reports a final timing
of 7.20 seconds for 7.12 seconds of audio, causing the existing validator to reject
alignment. Similar 80 ms overruns appeared in some fresh v4 responses. This may
affect highlighting but does not duplicate PCM. Investigate separately rather than
weakening validation during an audio-repetition fix.

The learner authorized the forward fix and further live comparisons. A shared
speech-prompt policy should distinguish language identity, desired regional speech,
provider capabilities and display labels. Do not add language-specific patches or
assume a shorter English tag solves all varieties. The learner explicitly excluded
cache and historical behavior changes; those are outside this fix.

## Implemented fix and second experiment

Native synthesis now sends the exact source text, without constructing an accent
instruction from language/variety display labels. This shared policy applies to
both supported models. The existing language_code null behavior remains unchanged
while explicit language selection is tested separately. Wire regression coverage
checks both models with English, Spanish, Arabic, Han text and decomposed accents.

Two further rounds produced 14 successful v4 Turbo streaming clips: the two
English/Spanish problem sentences with plain text, concise accent cues, or plain
text plus language_code; and the bus sentence with plain text in each round.
All 14 independent transcripts contained the source once. Every provider stream
again matched the production server parser, without identical repeated frames.
The concise tags were American accent and Mexican accent. This is preliminary
evidence for clear, short provider-style instructions, not proof of accent quality
or a general variety configuration ready to ship. Provider guidance recommends
clear delivery instructions and testing the specific voice/tag combination;
accent tags remain experimental. [@elevenlabs_speech_prompt_guidance_20261006]

Recommendation: retain plain-source generation as the production baseline. Test
explicit language selection against declared model capabilities separately from
regional pronunciation. Review concise tags and appropriate voices with listening
samples before introducing a shared regional-speech policy. Do not synthesize
instructions from translated interface labels or treat language_code as a regional
accent selector. No provider setting or route change was made by this fix.

## Verification

### Third experiment: reformatted accent cues on both supported models

At the learner's request, compared these two same-line formats, each followed by
a space and the unchanged source sentence:

- Concise: `[American accent]` / `[Mexican accent]`.
- Shared directional template: `[Speak {language} with a {variety} accent]`,
  instantiated as `[Speak English with a United States accent]` and
  `[Speak Spanish with a Mexico accent]`.

Two rounds covered trains, bus and the longer Spanish reply, both formats and
both eleven_v3 and eleven_v4_turbo: 24 successful streaming requests. All 24
transcripts contained the sentence once, with no extra spoken instruction.
All provider frames again matched the production server framing parser. There
were no identical nonempty repeated frames. Samples and receipts use the local
`*-inline-format1` and `*-inline-format2` filenames.

The directional template is a promising shared candidate that avoids a separate
demonym mapping for every variety. This is not a claim that the exact wording is
a prescribed provider API token: it applies the documented clear-instruction
guidance. It also changes both wording and newline placement, so this experiment
does not isolate punctuation alone as the original trigger. Both models passed
these English/Spanish examples; other varieties and accent fidelity remain
unverified. Human listening comparison is pending. Production still uses the
plain-source mitigation; no cache/history or model-specific prompt change was made.

### Fourth experiment: broader shared-format validation

With explicit authorization for additional small paid tests, exercised the same
`[Speak {language} with a {variety} accent] ` template across all 25 configured
varieties (21 languages). Used short artificial transit sentences, retaining the
longer Spanish problem sentence. The 48 supported model/variety combinations all
returned audio: Cantonese/v3 and Irish/v4 were excluded by the repository's
declared capabilities. No language-specific production changes were introduced.
Groq transcribed 47 clips; Irish has no configured Groq language and was left for
listening review. This was one broad trial per combination, not a reliability or
accent-fidelity benchmark. Production behavior was unchanged during this work.

The candidate did **not** pass broader validation. Cantonese/v4's transcript
contained the entire sentence twice. Two additional fixed-seed comparisons
(31415 and 27182, best-effort seed support) reproduced the difference:

| Input | First pair | Second pair | Transcript observation |
| --- | --- | --- | --- |
| Plain source | 1.68 s | 1.68 s | Sentence once in both |
| Directional cue plus source | 3.52 s | 3.04 s | Sentence twice in both |

The initial cued Cantonese clip was 3.28 seconds and also transcribed twice.
These recordings need human listening confirmation; duration alone is not a
duplication detector. The source was `架巴士到咗喇。`; the cue was
`[Speak Cantonese with a Hong Kong accent] `.

Malayalam transcripts were poor for both models. Eight further clips compared
plain/cued source with the same two seeds on both models. V4 cued clips were
2.56/2.48 seconds versus 1.04/1.04 seconds plain, but inconsistent transcripts
(including unrelated script output) prevent a reliable repetition judgment.
Do not treat those transcription errors as established synthesis errors.
Smaller transcription differences also occurred in Arabic, Hindi, Indonesian,
Thai and Vietnamese. Native-speaker listening is needed to separate recognition
errors from pronunciation or content errors. Irish remains untranscribed.

All 60 new synthesis requests (48 broad plus 12 controls) succeeded. Independent
provider-frame parsing matched the production server parser for every stream;
none contained identical nonempty audio frames. These findings continue to
argue against first-chunk replay in our framing code. No extra spoken instruction
was apparent in the available transcripts, but unreliable/missing transcripts
cannot establish that for every clip.

Local artifacts are under `.local/audio-playback-audit/`, using `broad-` and
`control-` prefixes, alongside the bounded experiment drivers. Receipts, prepared
input, source, audio hashes, timing, frame details and transcripts are retained.
No application cache, history or database was accessed in this validation.

Recommendation following this experiment: do not promote the shared directional
template to production. Keep the plain-source mitigation while reviewing the
listening samples. The earlier English/Spanish results remain encouraging but
are insufficient to claim an accent instruction works across supported varieties.
This is a failed generalization test, not evidence that all accent cues fail or
that provider tags can guarantee regional pronunciation.

### Agreed and implemented routing change

After the broader validation, the learner approved v3 as the default and v4 only
as the capability-based alternative. The shared catalog now orders v3 before v4;
fresh workspace settings and server defaults also prefer v3. Format 53 migrates
the prior saved v4 selection to v3 once, preserving other model identities. The
format-52 migration remains unchanged. Because saved v4 choices have no origin
marker, the one-time change also includes explicit v4 selections; later learner
choices are honored. No language-specific routing override or retry was added.

Plain source text remains the provider input. The accent candidate is not enabled.
This source implementation takes effect when the updated app runs; the agent
has not opened or migrated the learner's actual workspace or deployed the server.

Routing-change verification: the full native suite returned 835 passed, five
ignored and one failure in the new test's comparison after ordinary startup
incremented metadata. The assertion was corrected to compare all non-settings
tables immediately after migration. All 24 migration tests then passed. The
remaining native tests had passed in the full run, including fresh-workspace
routing and every configured variety. Final fast validation and Clippy passed;
300 server inference tests, generated-contract validation and documentation links
also passed. No live provider calls were needed for this routing-only change.

### Implementation checks

- 20 focused server streaming/model/alignment tests passed. Pytest reported an
  unwritable optional cache directory; assertions all completed.
- Five native speech-stream decoder tests passed, including fragmented reads,
  terminal handling, actual local HTTP streaming and retained alignment.
- `npm run check:fast` passed on the observed shared working tree.
- Clippy with warnings denied and the final-state fast gate passed.
- Final native suite: 834 passed, five ignored, using `--test-threads=4`.
  Default parallelism caused unrelated transcription fixtures' five-second local
  HTTP deadlines to expire; reducing concurrency resolved them without changes
  to those tests. The earlier reading expectation was updated to exact source text.
- Two follow-up rounds added an estimated USD 0.03312 of synthesis using the
  application's allowance rate, excluding transcription; actual billing is unknown.
- Current documentation link checks passed.
- Only native speech preparation and its regression coverage changed. No cache,
  history, commits, release changes or deployment performed.
