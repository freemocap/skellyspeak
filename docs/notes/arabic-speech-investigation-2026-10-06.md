# Arabic speech investigation — 2026-10-06

Status: investigation followed by a learner-approved source correction restoring
v4 Turbo and a one-time saved-settings migration. See implementation below.
No live workspace migration or deployment was performed. Recognition remains
unresolved; a successful provider response does not establish transcript accuracy.

## Confirmed observations

- The local workspace contains eight Arabic conversation transcription attempts
  on October 6, all Hosted/Groq `whisper-large-v3`, with routing language `ar`.
  All returned text successfully; all were fresh executions, not cache hits.
- Morning Arabic synthesis at approximately 08:01 Eastern used
  `eleven_v4_turbo` (three executions). Afternoon synthesis at 14:29–14:33
  used `eleven_v3` (nine executions, including explicit reading speech).
  Both used ElevenLabs. This establishes a model switch, not a provider switch.
- Commit `b8f1cc11115632bbc8b0fb93563007ff556a2908`, dated 13:44 Eastern,
  changed the shared synthesis order from v4-first to v3-first. The earlier
  [repetition investigation](speech-repetition-investigation-2026-10-06.md)
  records that this change was approved to address repetition, and that its
  experiments did not establish accent fidelity across languages.
- All three Arabic conversations select Levantine. The speech transport sends
  exact source text and `language_code: null`
  (`native/src/ai/transport/service_audio.rs`). The `ar` value in routing
  diagnostics is therefore not evidence that an explicit Arabic code reached
  synthesis. The server forwards a language code only when supplied.
- The server uses one configured ElevenLabs voice ID for synthesis
  (`server/app/inference/audio_service.py`); it does not select a voice from
  the conversation's language or variety. Retained receipts do not establish
  which deployed voice configuration was used or whether it changed.
- Recognition does forward `ar`. For Whisper, the native adapter additionally
  prefixes the canonical tag to the latest partner reply and truncates that
  context at a UTF-8 boundary within 224 bytes. This is a byte budget, not a
  token budget; it yields different amounts of context across encodings.
  See `speech/recording/owner.rs` and
  `ai/transport/transcription_adapters.rs` under `native/src/`.
- The three latest Arabic confidence scores are approximately 0.61, 0.48 and
  0.58. These are derived from segment log probabilities, not calibrated
  probabilities of transcript correctness. Spanish also has low-score examples;
  scores alone do not identify an Arabic-specific failure.
- One afternoon Arabic result has rejected word timing because an interval
  extends past recording duration. This establishes a timing defect in that
  response, not the cause of incorrect words.
- Saved Arabic recording results retain transcript/timing and audio digests.
  None of their original WAV digests exists in the inference blob table.
  The inspected microphone logs do not provide matching capture-health evidence
  for the afternoon failures. Microphone quality cannot be cleared from these
  records. Private utterances and request IDs are intentionally omitted here.

## Hypotheses and focused next checks

1. The confirmed v4-to-v3 change, combined with a shared voice and no explicit
   synthesis language, is a plausible cause of the perceived accent change.
   Compare identical short Levantine text with the actual configured voice,
   both models and supported explicit language settings. Human listening is
   required; round-trip transcription cannot certify an accent. Review voice
   selection as a shared language/variety capability, not an Arabic-only patch.
2. Recognition may be failing on the captured audio, short learner speech, or
   the partner-reply prompt. Obtain one known intended utterance and its original
   recording, then compare Whisper with and without context and Scribe using
   the same bytes. Preserve all outputs; do not assume a replacement model wins.
3. Preserve an explicit distinction between routing language and transmitted
   synthesis language in diagnostic work. Voice/model provenance should make
   future changes inspectable. This is a proposal, not implemented behavior.

No live inference or listening comparison was performed in this investigation.
No source fix is claimed. Documentation links were checked separately; application
tests are not applicable to this report-only change.

## Requested listening comparison

The learner subsequently requested live WAV comparisons and human listening review.
Six fresh synthesis requests succeeded using the configured local test voice,
the same artificial Levantine source and seed 31415 (best-effort reproducibility).
This does not verify that the local test voice equals the deployed Hosted voice.
No application settings or historical records were changed.

Source: بِدَّك قَهْوِة وَلّا شَاي؟ أَنَا بَدِّي قَهْوِة.

Intended meaning: Do you want coffee or tea? I want coffee.

| Clip | Model | Preparation |
| --- | --- | --- |
| A | eleven_v3 | Plain source; current application policy |
| B | eleven_v4_turbo | Plain source |
| C | eleven_v3 | Plain source with explicit `language_code: ar` |
| D | eleven_v4_turbo | Plain source with explicit `language_code: ar` |
| E | eleven_v3 | Former `[Arabic — Levantine accent]` prefix and newline |
| F | eleven_v4_turbo | Former prefix and newline |

Local playback files are `.local/arabic-listening/A.wav` through `F.wav`;
the manifest maps them to detailed receipts and redacted provider streams under
`.local/audio-playback-audit/`. Experimental Python drivers are local-only.
Each model used its current application endpoint: v3 text-to-speech, v4 Turbo
single-speaker text-to-dialogue, both streaming with timestamps and PCM 24 kHz.

All six WAV containers validated, with distinct audio hashes and durations of
3.12–3.20 seconds. Independent provider-frame parsing matched the production
server parser for each clip; no identical nonempty frames occurred. These checks
do not establish correct pronunciation or absence of spoken repetition. Human
listening is pending. No round-trip transcription was used as an accent verdict.
The final fast gate and all 48 selected ElevenLabs adapter/speech-streaming tests
passed. The initial sandbox connection attempt failed before
connecting; the authorized network-enabled run completed all six requests.

## Learner listening results and exact failing message

The learner listened to A–F and reported that all six sound like proper Arabic,
although the voices differ. This is positive listening evidence for those samples,
not proof of reliability across text or repeated generations.

The learner then identified the final reply in the latest Noor conversation as
having a British-sounding voice speaking Arabic. Read-only inspection located
its successful v3 generation at 14:33:06 Eastern. It was a fresh generation
(`cacheHit: false`). The cached WAV lasts 2.40 seconds at 24 kHz; both original
and normalized character alignment match the identified message exactly.
This provides no evidence of a different sentence being substituted by the cache.
It does not establish acoustic correctness or the deployed voice identity.

The original was extracted unchanged to
`.local/arabic-listening/noor-original.wav` for learner playback. Private source
text and exact-message experiment files remain local-only. Four comparisons are
prepared: v3/v4 Turbo, each with plain source or explicit Arabic language code.
Automatic approval review blocked execution because sending the private message
to ElevenLabs requires explicit transfer authorization. No fresh requests for
this exact-message comparison have run; learner permission is pending.

### Authorized exact-message comparison completed

The learner explicitly authorized sending the identified text to ElevenLabs.
All four prepared requests subsequently succeeded. Listening files are
`.local/noor-listening/A.wav` through `D.wav`: A is v3/plain (2.32 s), B is
v4 Turbo/plain (2.40 s), C is v3/explicit Arabic (2.24 s), and D is v4
Turbo/explicit Arabic (2.40 s). All use the same configured test voice, exact
source and best-effort seed 31415. Independent provider frames match the server
parser and contain no identical nonempty frames. Human listening is pending;
the reported accent failure has not yet been established in the fresh samples.

A read-only voice metadata request identified the configured test voice as
George - Warm, Captivating Storyteller, labelled English, British, male and
premade. Its ID matches the repository deployment default. This confirms that
these tests use a British English reference voice, even though the learner found
the earlier six artificial samples acceptable in Arabic. Accent transfer remains
a hypothesis for the exact failing generation, not a proven mechanism.

A narrowly time-filtered history request intended to match the original provider
request ID returned HTTP 401. The original Hosted voice identity therefore remains
unverified. No credentials or permissions were changed. Voice metadata is retained
locally; no provider audio or application history was overwritten.

Next decision depends on listening: compare A/B to isolate model/endpoint and
A/C or B/D to assess explicit language conditioning. If all sound acceptable,
repeat the failing condition to measure variability before claiming a fix.
If language conditioning is insufficient, evaluate a suitable native-language
voice under a shared voice-selection policy. Do not infer a reliable accent fix
from a single sample or silently change every language's voice.

### Exact-message listening verdict

The learner reports A and C sound like the British speaker, while B and D sound
like an Arabic speaker. The reported failure is therefore reproduced with v3
both without and with explicit Arabic conditioning; both tested v4 Turbo
conditions pass this learner's accent review. This isolates the model/endpoint
combination as the successful intervention in these samples. It does not prove
the provider's internal mechanism, universal v3 failure, or universal v4 success.

The candidate correction is v4 Turbo with exact plain source, retaining the
accent-prefix removal from the repetition fix. An Arabic language code alone is
not a demonstrated remedy for this example. An Arabic-specific routing override
is unnecessary; the shared model policy can express this correction. Existing
capability selection (including v3 for Irish) still matters.

Two additional v4/plain exact-message clips were generated with seeds 27182 and
16180, saved as `.local/noor-listening/E.wav` and `F.wav`. Both are 2.40 seconds.
The earlier English trains repetition fixture was also regenerated with those
seeds using v4/plain; both are 1.68 seconds. All four independently parsed provider
streams match the server parser, with no identical nonempty frames. These new
clips await listening; durations and frame hashes cannot certify absence of
spoken repetition. No application policy, learner settings, migration or cache
was changed in this follow-up.

Migration 53 explicitly changed saved v4 selections to v3, without provenance
distinguishing default and manual choices. Merely reversing the catalog order
will not repair those saved selections. Never edit that historical migration;
any subsequent persisted-setting correction needs a deliberate treatment of
learner choices and a new consecutive migration if changing stored policy.

### Repeated-sample listening passed; implementation decision pending

The learner confirmed E and F sound Arabic and both new English controls say
the expected sentence once, without duplication. Together with the earlier
comparison, these observations support restoring v4 Turbo while retaining plain
source text. They are bounded listening checks, not a universal reliability claim.

Before implementing a stored-policy change, asked whether to restore existing
saved v3 selections to v4 once or only change fresh-workspace defaults. Format
53 erased selection provenance, so there is no evidence-based way to target
only automatically changed selections. The answer determines whether a new
consecutive migration is appropriate. Source behavior remains unchanged pending
that ownership decision; the historical migration will remain frozen.

## Implemented correction

The learner approved restoring existing v3 selections once. The shared catalog,
fresh-workspace SQL and server advertised default now prefer v4 Turbo. Existing
capability selection still uses v3 where v4 is not listed, including Irish, and
later explicit learner selections still win. No language-specific override was
added. Speech requests continue to send exact source text without accent prefixes.

New workspace format 54 appends a 53 → 54 migration that changes only saved
`eleven_v3` speech models to `eleven_v4_turbo` and increments their connection
revision. This deliberately includes manual v3 selections under the approved
policy. Released migrations are unchanged. Other settings, custom models,
conversations, evidence, receipts and cached audio are preserved. The original
cached Noor failure is not regenerated or deleted.

Migration regression coverage includes every supported starting format, fresh
default equivalence, all non-settings tables across the new step, full settings
row preservation except the intended model/revision, rollback, repeat startup and
learner model changes after upgrading. Routing tests cover Arabic, Spanish,
English, Cantonese and Irish. Existing exact-source wire tests remain intact.
Generated server catalog metadata was refreshed through the Rust exporter.

This source correction requires running the updated native application before an
existing workspace is migrated. No release version, tag, commit or deployment
was created.

### Implementation verification

- `cargo test --manifest-path native/Cargo.toml --lib -- --test-threads=4`:
  843 passed, five ignored, no failures. Includes the new migration tests and
  existing exact-source synthesis, playback and routing regressions.
- Clippy for the library and tests with warnings denied: passed.
- Native binary checks and generated-contract checks: passed.
- Server inference suite: 300 passed. Its first run caught the expected stale
  generated catalog hash; after running the Rust exporter, the full suite passed.
- Final fast gate, documentation links and diff whitespace checks: passed.

These are source and temporary-workspace checks, not a launched-app or deployed
service verification. User listening approval applies to the retained experimental
v4 clips, not to future arbitrary utterances. Transcription errors remain a separate
investigation; this change does not alter recognition models or microphone capture.
