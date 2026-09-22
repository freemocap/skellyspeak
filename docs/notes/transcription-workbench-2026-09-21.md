# Transcription experiments — September 21, 2026

Status: local workbench implemented; comparative accuracy not measured. No production
routing changes, deployment, live provider benchmark or commit.

## Observations and question

The [Arabic audit](arabic-transcription-audit-2026-09-20.md) identified English output
from an Arabic attempt through Scribe v2. The provider labeled the result Arabic
with probability 1.0. The source request path supplies `ar`, and no translation
step intervenes. This is not evidence that the speaker caused the failure, nor
proof that language forcing, preprocessing or any particular model is the cause.
The current ElevenLabs adapter uses `no_verbatim=true`; native Groq also supplies
variety context, so provider choice alone does not describe all app conditions.

## Implemented experiment ownership

The [workbench](../../tools/benchmarks/transcription/README.md) is a separate local
benchmark under `tools/benchmarks/transcription/`. The learner owns the audio,
intended phrase, actual-spoken reference and listening notes. It does not create
conversations, award credit, assess pronunciation, change settings or upload on
Stop. Run explicitly submits the chosen recording to selected providers.

Thirty-six editable starter phrases span US English, Mexican Spanish, Levantine Arabic
and Mandarin. The Arabic default follows the previously captured app variety;
Mandarin is the initial interpretation of Chinese. Romanization and translations
are authored aids, not native-speaker-validated evaluation labels. System TTS uses
an installed matching language voice; voice/variety mismatch remains a limitation.
Microphone audio, phrase snapshot, capture settings, reference voice, file hash,
reference and request conditions survive restart in ignored local files.

## Initial options

| Option | Workbench status | Experiment purpose |
| --- | --- | --- |
| ElevenLabs Scribe v2 | Implemented; needs ElevenLabs key | Forced vs auto language; cleaned vs verbatim |
| Groq Whisper large-v3 | Implemented; local Groq key detected at launch | Independent recognizer; forced vs auto language |
| Groq Whisper large-v3-turbo | Implemented; same key | Compare speed-oriented Whisper variant on identical attempts |
| OpenAI whisper-1 | Implemented; needs OpenAI key | Whisper API baseline (Whisper V2, not Groq's V3) |
| OpenAI gpt-4o-transcribe / mini | Implemented; needs OpenAI key | Compare another transcription model family |
| Qwen3-ASR | Research candidate only | Model family explicitly covering Arabic, Mandarin and other Chinese varieties |
| Language/dialect fine-tuned Whisper | Research candidate only | Consider after an error corpus establishes a persistent language-specific gap |

Scribe language hints and verbatim settings are documented provider controls,
not accuracy guarantees [@elevenlabs_language_codes_20260921]
[@elevenlabs_non_verbatim]. API request shapes for Groq and OpenAI are checked
against their official transcription guides [@groq_transcription_api]
[@transcription_workbench_apis_20260921]. OpenAI whisper-1 and Groq large-v3 are
different baselines; do not label either comparison simply “Whisper” in results.
Qwen's model card lists the requested languages and additional Chinese varieties
[@qwen_asr_candidate_20260921]. Fine-tuning open Whisper weights is possible with
paired speech/transcript training data [@whisper_finetuning_candidate_20260921];
a dozen test phrases are an evaluation seed, not a training dataset. A public
checkpoint's claimed benchmark quality does not establish quality on this learner.

## Experiment decisions and interpretation

- Reuse exact WAV bytes across conditions; retain SHA-256 and explicit language,
  model and cleaning settings. Browser capture/resampling differs from native
  desktop capture, so this first pass isolates recognizers on workbench audio;
  it is not end-to-end parity with the production app.
- Never include the target answer in a baseline prompt. Vocabulary hints and
  native variety prompts deserve a separately labeled later experiment because
  they can bias a recognizer toward the expected answer.
- Keep short phrases and longer context, with three natural attempts per phrase.
  Evaluate per language; Spanish success cannot establish Arabic/Mandarin quality.
- Report request failures alongside successful transcript differences. Language
  confidence is provider metadata, not an independently verified correctness score.
- Use character distance for Mandarin; use character and word distance elsewhere.
  Review dialect spelling, script variants and genuinely different spoken words
  manually. These scores are not phonetic diagnosis or learner assessment.
- No automatic production fallback: it changes latency, cost and behavior. Decide
  language-specific routing only after repeated recordings show a useful difference.

## Verification

- TypeScript check and six offline tests passed, including all 14 request
  conditions, byte identity/no target leakage, WAV validation, multilingual
  scoring, redaction and useful failure metadata, origin/token protection,
  persistence/reopen and export excluding keys.
- Local workbench started on loopback port 8771. Browser inspection confirmed
  Arabic RTL input, romanization, installed Majed Arabic voice, disabled missing-key
  conditions and available Groq conditions. Listen was exercised without a surfaced
  playback error; this is not a native-speaker pronunciation validation.
- Actual microphone capture and live recognition comparisons await learner use.

## Next evidence needed

A few saved Arabic and Mandarin attempts, including the reported failure phrases,
compared with English/Spanish controls. Review original audio before attributing
errors to pronunciation. If forced-language verbatim Scribe still fails and another
model consistently succeeds on the same takes, propose a language-specific route
using those results. If all fail, inspect capture and phonetic confusions together.

## Provider read-aloud follow-up

Implemented after the learner requested app-quality reference speech. Listen now
uses ElevenLabs Eleven v3 (app accent cue, voice configuration and normalization
setting) or the app's OpenRouter GPT Audio Mini speech instruction. The latter
uses the already available local OpenRouter key. ElevenLabs still requires its
key locally; the tool does not extract production secrets. System TTS is removed.
OpenRouter's PCM stream is validated through its completion marker and wrapped
as 24 kHz WAV; ElevenLabs returns MP3. Generated reference audio is cached for
replay and the speed control changes playback, not the request. Stop or phrase
changes invalidate pending playback without automatically retrying generation.

This is a tool adapter matching the application's request semantics, not an
invocation of Tauri commands or the deployed hosted service. Native application
settings remain unchanged. Provider API references: [@workbench_provider_speech_20260921]
[@elevenlabs_tts_20260917]. Nine offline tests and TypeScript checks pass.

Live follow-up verification: the configured OpenRouter route generated reference
audio successfully for the starter Arabic and Mandarin phrases. Browser playback
controls became available; Arabic replay returned the cached-audio state without
a second synthesis request. This verifies generation/playback plumbing, not a
native-speaker assessment of pronunciation. ElevenLabs was fixture-tested only
because its key is not configured in this local workbench.

Starter corpus expanded to nine phrases per language: greetings, comprehension,
bathroom directions, prices, tea without sugar and a longer market sentence.
New rows are appended so all existing phrase IDs remain stable.

## Read-aloud fidelity report and ElevenLabs activation

The learner reported that OpenRouter read-aloud for “ممكن تحكي شوي شوي؟”
produced a nine-second clip with additional unrelated speech. Previous live checks
established generation and playback only, not spoken-word fidelity. Treat that
route's reference accuracy as unverified; do not infer it from HTTP success.
The learner added ELEVENLABS_API_KEY to server/local.env. Restarted the local
workbench to load it; ElevenLabs now becomes the default read-aloud provider and
Scribe comparison conditions are enabled. No key value is recorded here.

ElevenLabs generated the reported phrase successfully. A one-off Groq
Whisper large-v3 check of that cached synthetic MP3 (forced Arabic, no answer
prompt) returned “ممكن تحكي شوي شوي؟”, with reported duration 1.92 seconds.
This supports wording fidelity for this clip; it is not a native-speaker accent
assessment or a guarantee for other generated phrases. No learner audio was sent
in this check.

## Agent-operated comparison and take removal

The learner records and selects the takes to keep; Codex executes comparisons and
analyzes them. Manual execution controls are collapsed, and results refresh in the
recording UI. The compare.ts runner snapshots active takes and skips every already
attempted take/condition pair, including failures. A new batch requires invoking
the runner; no background agent wakeup or automatic provider submission is implied.

Remove marks a take as removed durably. The take and its results disappear from
active study/export; Restore recovers them. Original audio is not erased. The
server refuses removed-take submissions and removal during an active comparison.
Offline tests cover remove/restore, export exclusion and submission refusal.

First review: nine Arabic takes, three intended phrases. Ran 48 additional provider
requests to complete six conditions per take; six first attempts already existed
for the quiet take. Other earlier repeats remain retained. Counting only the first
attempt for each pair: forced-Arabic Whisper matched the normalized target in 5/9,
forced-Arabic Scribe verbatim in 3/9, forced-Arabic Scribe cleaned in 0/9. These are
intended-text matches, not human-verified speech labels or pronunciation scores.
Scribe cleaning changed dialect wording; auto-detection produced wrong-language
outputs on several short clips. The quiet final greeting had approximately -45 dBFS
RMS, versus -14 to -9 dBFS on other takes; Whisper returned unsupported-looking text
there and Scribe mostly failed. Three takes exceeded 1% near-full-scale samples.
These observations support explicit-language verbatim comparisons and better
capture consistency, not a universal winner or production routing change.

Nine offline tests and TypeScript passed after the removal changes. No real learner
take was removed by the agent. All recordings/results remain in the private local
study directory. No commit or deployment.

## Second batch — twelve kept Arabic takes

After the learner removed the two greeting takes and added two price-question
and three market-sentence takes, the active cohort contains twelve recordings
across four phrases. Completed 30 missing comparisons, producing 72 first-attempt
results across six conditions on the current cohort, with no request failures.
No previously attempted pair was resent. Report generation is reproducible via
`node tools/benchmarks/transcription/report.ts`; full private results are in
`.local/transcription-workbench/comparison-latest.md` and the summary JSON beside it.

Mean per-take character error against the intended reference: forced Whisper
10.9%, forced Scribe verbatim 17.8%, forced Scribe cleaned 43.8%; automatic variants
were worse (48.4%, 58.3%, 76.8% respectively). These are descriptive values on a
small selected corpus, not independent speech truth or general benchmarks.
The longer sentence exposes formal-register rewriting by cleaned Scribe; verbatim
retains substantially more dialect wording. Short price questions expose
wrong-language automatic detection and legitimate orthographic variation, so exact
match counts alone understate usefulness. The three new long takes each have
approximately 1.6–1.7% near-full-scale samples; capture consistency remains a
confound. No inference of pronunciation correctness from model agreement.

Next proposed collection: two Mandarin phrases, three attempts each, with slightly
lower input level/stable microphone position. Compare forced-language Whisper and
Scribe verbatim first, retaining auto/clean controls for this next language. English
and Spanish controls follow. Production settings remain unchanged pending review;
no automatic fallback or fine-tuning has been introduced.

## Durable local corpus and Arabic sound drills — implemented

The active study now lives at `~/SkellySpeak Recordings/transcription-study/`,
outside Git and independent of the checkout. This supersedes earlier storage
paths in this investigation. `TRANSCRIPTION_LAB_DATA_DIR` accepts an absolute
override. The launcher imported 134 files, including all 14 recordings (12 active,
2 removed), with SHA-256 equality verified against both original and recovery
copies. Original ignored files remain untouched as a migration safety copy;
a marker prevents later reimport of stale records. The server was restarted on
port 8771 and both idle browser tabs refreshed against the new storage.

New audio and study records use flushed atomic writes to primary and recovery
copies. Every startup produces a verified snapshot. Copies share the local disk;
independent backup remains the owner's backup system, and snapshots are not
automatically pruned. The learner can continue recording into this corpus; Codex
runs comparisons on request, skipping previously attempted conditions.

Added 18 authored Arabic exercises (27 Arabic options; 54 total), covering ص/س,
ط/ت, ض, ظ, ح/ه, ع/ء, خ, غ, ق/ك and ث. Twelve additions use Levantine phrases;
six explicitly use Modern Standard Arabic, with the variety passed to synthesis.
Each includes English meaning, romanization and a focused pronunciation note.
Register and dialect distinctions were reviewed against
[@levantine_sound_drills_20260921]; exercises have not been native-speaker validated.
Original phrase IDs and recorded target snapshots remain stable.

Verification: TypeScript and 12 offline tests passed, including import idempotence,
conflict refusal, recovery/snapshot contents and phrase ID stability. Browser
inspection confirmed the new Arabic options, ElevenLabs selection, 12 saved takes,
existing results and the external storage path. No new paid model requests,
production routing changes, commits or deployment in this step.

## Interpretation correction — qualitative review

The learner correctly challenged treating exact matches or CER as usefulness.
Earlier percentages are character edit error, not success rates; 100 minus CER
is not semantic accuracy either. Punctuation and Arabic vowel marks were already
normalized, but spelling, dialect and legitimate paraphrase differences remain.
The report generator now labels exact matching as a secondary text diagnostic
and explicitly distinguishes it from success. This supersedes any interpretation
of earlier score rankings as task success or a definitive provider recommendation.

Reviewed all 72 saved first-attempt transcripts against the 12 intended targets.
Water requests remain understandable across all six conditions despite spelling
and register variation. The market sentence is broadly recoverable across methods,
with Scribe paraphrases and Whisper grammatical imperfections; changing “I want
to go” into “I will go” loses intent nuance. The slow-speech request includes real
corruptions and wrong-language outputs, alongside acceptable cleaned paraphrases.
Price requests include plausible dialect spelling as well as ambiguous/corrupt
outputs; auto-language often fails there. No audio listening review was performed
in this pass, so spoken fidelity and pronunciation cannot be inferred. A detailed
review is retained privately with the corpus. No new provider requests were made.

## Scientific visualization — implemented and verified

Added a TypeScript scoring export and Matplotlib plotting script. The 12-take,
72-result snapshot produces three private PNG/SVG figures: individual observations
with condition means, a per-recording heatmap, and paired changes for automatic
language and Scribe cleaning. Scoring reuses experiment.ts rather than implementing
normalization twice. Export verifies source WAV SHA-256 and result audio identity.
Means reproduce comparison-latest.json; all 72 condition slots contain transcripts.
Images were rendered and visually inspected; TypeScript passed. No provider calls.

These show character error, not semantic usefulness. Water paraphrases illustrate
why even 44% CER can preserve the message. No subjective success percentages or
inferential uncertainty intervals were invented. The JSON snapshot and methods
notes accompany private figures; regeneration code remains in tools/benchmarks.

## Expanded batch and combined dashboard — implemented

Completed 228 missing comparisons for 38 new takes. The active cohort now has
50 recordings: 30 Arabic, 13 Spanish, 7 Chinese. All 300 first-attempt condition
slots returned transcripts; no prior pairs were resent. Request success is not
recognition success. Plot export verifies audio/result hashes and separates
languages rather than presenting a pooled ranking. Arabic now includes eight
phrases, Spanish three and Chinese two.

A self-contained HTML dashboard combines the distribution and heatmap views, with
paired setting changes collapsed and explained. It is served locally at
`/dashboard/`, with a recorder link and allowlisted full-resolution chart routes.
Private HTML, PNG/SVG and scored data live under the study's `figures/latest/`.
This is a dated snapshot; Codex regenerates it after subsequent comparison runs.

Spot review of Chinese outputs found traditional/simplified differences such as
我聽不懂 / 我听不懂, alongside actual character substitutions and one auto-Whisper
Swedish output. The dashboard explicitly flags script variants as a scoring
confound. No phonetic assessment or semantic success rate is inferred.

TypeScript and all 12 tests passed, including dashboard missing-file behavior,
content policy, origin checks and refusal to serve raw scored JSON. Existing
recording pages were idle before restart and refreshed after activation. Browser
inspection verified all three language sections and collapsible third charts.
No commit or deployment.


## Interactive comparison dashboard — replaces the raster dashboard

User rejected the image-grid dashboard as illegible and asked for a decision
surface. Rebuilt with native HTML tables, 16px body/table text, 14px labels,
responsive SVG distributions and scrollable full-size outcome cells. Overview
and per-language tabs separate the overall recommendation from individual takes.
Ranking criterion is explicit: reviewed message retained, faithful wording, or
raw CER. Overall values weight languages equally; per-language values weight takes.
The prior raster dashboard is superseded, while standalone scientific exports remain.

Reviewed all 300 outputs against intended text under a four-category rubric:
faithful (accepted orthographic variants allowed), usable with changes, uncertain,
and changed/wrong language. Private review entries bind exact result/reference
text and IDs; the builder refuses stale reviews. This is assistant text review,
not an audio adjudication or pronunciation/recognition ground truth. Clicking an
outcome reveals actual output and the reason. Unreviewed outputs prevent ranking;
uncertainty is neither treated as accepted nor hidden. No new provider calls.

Under this rubric, supplied-language Whisper retains 17/30 Arabic messages versus
13/30 for supplied-language Scribe verbatim, but uncertainty is 3 versus 7, so the
difference is not decisive. Spanish is 13/13 versus 12/13, with one uncertain Scribe
output. Chinese ties at 5/7 after accepting traditional/simplified variants. Wording
fidelity favors Scribe in some comparisons. The dashboard recommends testing
supplied-language Whisper as a provisional default, keeping Scribe verbatim as a
comparison and avoiding a universal-winner claim. No production routing changed.

TypeScript and 15 tests passed, including equal-language weighting, separation of
utility from CER, unreviewed ranking refusal and CSP script hashes. Data, review
ledger and generated dashboard remain private outside Git. No commit or deployment.
