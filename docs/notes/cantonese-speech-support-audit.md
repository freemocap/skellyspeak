# Cantonese and speech support

Status: source implementation, 2026-10-05. Cantonese is bundled as a peer of
Mandarin Chinese. Automated and live provider verification is recorded below; native playback UI,
linguistic listening review and deployment remain unverified. Earlier investigation below
is historical and is superseded by the implementation section.

## Agreed decisions

- Cantonese will be a peer of Mandarin, initially Hong Kong conversational
  Cantonese, Traditional characters and Jyutping.
- No partially supported learning languages: conversation, learning/reading
  assistance, transcription and synthesis must work before a language is offered.
- Taiwan Mandarin and independent script choices are outside this addition.

## Historical findings before implementation

The active catalog has 20 languages and 24 varieties. A read-only inventory of
every variety's effective language tag against the configured candidate models
found listed transcription and synthesis routes for all 24. Irish requires
Scribe v2 for transcription; the other 19 languages have a Whisper large v3
route. All 20 have an Eleven v3 synthesis route. This is configured capability
coverage, not a live service check or a linguistic quality certification.

`native/src/configuration/speech_tests.rs` already contains
`every_offered_language_has_listed_recognition_and_synthesis`, which rejects
unlisted/custom-model attempts as evidence of supported languages. Its current
loop covers language defaults, not each resolved variety. Extend that coverage
when implementing the addition.

The draft Cantonese profile resolves to `yue`, which is listed in the app's
Whisper and Scribe tables, but has no synthesis route in the current catalog.
It was moved out of `content/` when the user clarified that partial support is
unacceptable. No Cantonese content remains in the offered language catalog.

ElevenLabs' current model page explicitly lists Cantonese (`yue`) for Eleven v4
and v4 Turbo; the v3 list includes Mandarin but not Cantonese.
[@elevenlabs_models20261005]

The v3 setup predates v4: local integration notes date to September 17–18 and
the bibliography's v3 language-list review is September 23. ElevenLabs dates
the v4 launch September 28. No inspected note or configuration explains staying
on v3 as a deliberate v4 cost/latency tradeoff. The evidence supports an existing
integration not yet updated, rather than an evaluated rejection of v4.
[@elevenlabs_v4_launch20261005]

One server-configured voice serves all languages. The native request prepends
an accent cue and sends `language_code: null`; the server uses timestamped TTS
streaming with 24 kHz PCM. Provider guidance recommends voices trained in the
intended language/accent. Listed language support does not establish that this
one voice reliably differentiates every advertised regional variety.
[@elevenlabs_voice_language20261005]

## Original implementation boundary (superseded)

Verify v4 compatibility with the existing timestamped streaming endpoint,
source alignment/highlighting, configured voice, input limits, usage receipts
and allowance estimates. Current official documentation mentions Text to
Dialogue for v4 while the product page demonstrates Text to Speech, so endpoint
compatibility must be verified rather than inferred from the model name.
Preserve all existing languages when choosing the model catalog; do not assume
that a new model's larger total language count contains every older language.

Then integrate a supported speech route and finish Cantonese's language file,
eight assessments, eight source guides, topic labels and regression coverage.
Exercise conversation, recording/transcription, reply playback and reading/Drill
audio, including short ambiguous Han text. Review Cantonese pronunciation and
language drift with appropriate linguistic evidence before advertising support.
Hosted rollout needs separate explicit deployment authorization.

## Historical investigation limits

This turn inspected source, local history, model capability tables and official
provider documentation. No provider inference, account/voice inspection, live
audio evaluation, model switch or deployment occurred. The existing 20-language
catalog remains active. The Windows sandbox shell began failing with account
lock error 1909; read-only shell inspection succeeded through approved escalation.

## Implemented routing and content

The catalog now contains 21 languages and 25 varieties. Shared capability routing
selects Eleven v4 Turbo by default and retains Eleven v3 for Irish. Cantonese uses
its own yue identity; an older server offering only v3 produces an explicit
unsupported-route error. Selection happens before submission; provider failures
never trigger an automatic retry on a different model.

The server advertises both models when its ElevenLabs key and voice are configured.
Turbo uses the documented Text to Dialogue timestamp endpoints with one input and
one configured voice; v3 retains Text to Speech. Both retain PCM 24 kHz audio,
alignment, redacted response metadata and requested model receipts. HTTP dialogue
inputs are limited to 2,000 prepared characters; v3 retains 5,000. The Turbo service
allowance is 40 microdollars per character, excluding temporary promotions; v3
retains its existing conservative 100. These are estimates, not provider invoices.
[@elevenlabs_dialogue_timing20261005] [@elevenlabs_api_pricing20261005]

Cantonese has a Hong Kong variety, Traditional writing guidance, Jyutping with six
tone numbers, a starter partner, six practice sets, six topic labels and all eight
assessment/English explanation groups. Colloquial grammar and register guidance
is separate from script and reading scheme. Authored content remains marked
needs_review; compilation cannot certify linguistic quality.
[@lshk_jyutping20261005] [@cuhk_cantonese_grammar20261005]

Mandarin keeps its stored language and variety IDs, Simplified writing and Hanyu
Pinyin. Only its display identity becomes Mandarin Chinese / 普通话. Taiwan
Mandarin and a separate script selector remain deferred.

Workspace format 52 explicitly changes existing bundled v3 model selections to
v4 Turbo and increments the configuration revision. Other custom model IDs and
historical receipts, conversation identities and learner records remain intact.
This includes manually selected v3 defaults, which cannot be distinguished from
an untouched bundled default; v3 remains selectable and is retained by capability
routing for Irish. Fresh workspaces start with the same Turbo default.

## Verification and rollout limits

Regression tests cover every variety's recognition/synthesis capability, both
provider payloads in streaming and complete modes, audio/alignment preservation,
per-model limits and allowance estimates, refusal diagnostics and no automatic
retry, and migration from every supported format with rollback/history checks.
Final checks: 830 native tests passed (five explicit live/experiment tests ignored),
Clippy with warnings denied passed, 586 server tests passed (seven Firestore emulator
tests skipped), 70 configuration tests passed, content inspection covered all 21
languages, generated contracts matched, fast validation and documentation links passed.
The full server suite required an isolated workspace pytest directory because the
shared Windows temporary directory was inaccessible.

## Live provider verification, 2026-10-05

After locating the existing private server/.env configuration, three short clips
were synthesized through the actual server adapter and configured voice, using the
same accent cue and null language-code contract as the native app:

| Test | Synthesis | PCM bytes / streaming frames | Recognition |
| --- | --- | --- | --- |
| Hong Kong Cantonese | eleven_v4_turbo | 192,000 / 8 | whisper-large-v3, yue |
| Mainland Mandarin | eleven_v4_turbo | 138,240 / 9 | whisper-large-v3, zh |
| Irish | eleven_v3 | 119,040 / 7 | scribe_v2, ga |

All returned audio and alignment. Transcription recovered each supplied sentence,
with punctuation differences. Cantonese retained colloquial 飲、今日、得唔得閒;
Mandarin retained 喝、今天、有空吗. The accent cue was not transcribed as spoken
content. This establishes real endpoint/model/voice interoperability for these
samples, including the Turbo timestamped dialogue route. It does not certify all
phonetic distinctions or all supported accents.

Test WAVs and throwaway probes are local-only under .local-server/cantonese-probe;
no credentials or account voice IDs are recorded here. No full native recording /
playback UI test, expert listening review or deployment occurred. Both the server
and native app need rollout. Changes are uncommitted.

The subsequent [Cantonese interface and explanation work](cantonese-interface-and-explanations.md)
adds directly authored interface text and bundled guides for Cantonese-speaking
learners of all supported languages.
