# Italian, Irish and Scottish Gaelic addition

Status: implemented; automated verification recorded below. This is a content and pathway
audit, not certification of generated language quality or speech support.

## Decisions and source ownership

- Three independent learning/explanation languages: `italian` (Italiano, `it`),
  `irish` (Gaeilge, `ga`) and `scottish-gaelic` (Gàidhlig, `gd`). Irish and Scottish
  Gaelic are not interchangeable, and Scots is a different language again.
  ISO identities are separate from provider capabilities. [@loc_language_codes]
- Reuse shared `latin` script and `indo-european` family. No new language-authoring schema fields,
  enum branches, script multipliers, renderer cases, migrations, or interface
  locales. Each language owns one local orthography, one explicitly scoped
  variety, six starter topics and a fictional partner. Lists of unused traits,
  extra dialects and new pronunciation schemes would add unsupported claims.
- Italian uses standard writing in Italy, without prescribing a regional accent.
  Irish uses the written Caighdeán with regional speech variation; it is not a
  fabricated uniform spoken dialect. Scottish Gaelic uses contemporary Gaelic
  Orthographic Conventions, with regional variation and historical source spelling
  preserved. Guidance for target writing and explanation writing resolves through
  the existing independent language roles. [@treccani_italian_accents]
  [@irish_caighdean_2017] [@irish_spoken_dialects] [@sqa_gaelic_orthography]
- All three disable romanization explicitly. They are already written in Latin
  script. Reading pronunciation remains a separate existing feature; spelling
  must not be replaced with invented English respellings. Italian acute/grave
  distinctions, Irish acute accents, Gaelic grave accents, initial mutations,
  apostrophes and hyphens remain source text, not normalization targets.
- Courtesy material includes Italian `grazie`, Irish `go raibh maith agat` /
  `go raibh maith agaibh`, and Gaelic `tapadh leat` / `tapadh leibh`. The initial
  proposal to omit phrases was rejected by the user. Shared retrieval now matches
  contiguous Unicode words, using a derived NFC/lowercase view and equivalent
  straight/curly apostrophes. Punctuation and whitespace delimit words; intervening
  words prevent a match. These are retrieval hints, never proof of mastery.
  [@speakgaelic_thanks] [@focloir_continuing]
- Fixed the optional-budget starvation at its owner: focus, due and mandatory
  function/interaction goals are retained, with up to 25 additional optional
  matches. Required goals no longer consume the optional allowance. This change
  applies to all languages and does not add or duplicate skill-assessment credit.

## Speech boundary

The configured microphone adapter uses Groq Whisper. Groq documents Whisper large
v3, while the upstream tokenizer includes `it` but neither `ga` nor `gd`.
Italian has `transcription: it`; Irish and Scottish Gaelic explicitly have
`transcription: null` because those codes are not in the model table. Recording
remains enabled for both, as explicitly requested by the user. Missing codes are
omitted from the multipart request, while native-language context is retained.
The server now accepts omitted codes but still rejects malformed supplied values.
The composer shows a compact warning naming the selected model and language,
using the effective mapping projected by Rust (including variety overrides).
There is no second UI support list or substitute language code.
[@groq_transcription_context] [@whisper_language_tokens]

Speech synthesis is separate: the existing provider receives the selected target
language name, and content has no per-model synthesis-support matrix. Read-aloud
quality for these languages has not been established here. The general TTS
transcript comparison remains diagnostic rather than acoustic validation. Improving
recognition for either Gaelic language requires evaluating an appropriate
recognizer and its adapter; the warning does not promise reliable automatic detection.

## Authored content and review limits

Starters preserve the six existing cross-language sample meanings; these are
originally authored short examples, not copied courses or claims of native review.
Irish rest wording was checked against Foras na Gaeilge's `want` and `scíth`
entries. Gaelic liking/music forms were checked against LearnGaelic, with modern
orthography checked against SQA. Italian accent/apostrophe guidance was checked
against Treccani. [@focloir_want] [@teanglann_scith] [@learngaelic_music]

| Topic | Italian | Irish | Scottish Gaelic |
| --- | --- | --- | --- |
| I would like tea. | Vorrei del tè. | Ba mhaith liom tae. | Bu toil leam tì. |
| This is my family. | Questa è la mia famiglia. | Seo mo theaghlach. | Seo mo theaghlach. |
| I want to rest. | Voglio riposare. | Tá mé ag iarraidh mo scíth a ligean. | Tha mi airson fois a ghabhail. |
| I like this park. | Mi piace questo parco. | Is maith liom an pháirc seo. | Is toil leam a’ phàirc seo. |
| Today I am at home. | Oggi sono a casa. | Tá mé sa bhaile inniu. | Tha mi aig an taigh an-diugh. |
| I like music. | Mi piace la musica. | Is maith liom ceol. | Is toil leam ceòl. |

The matching Irish/Gaelic family sentence is intentional, not a copied multilingual
courtesy list. `preview` and `translation` duplicate the local sample because the
existing resolver selects them from target and explanation documents respectively.
Native-speaker review is still needed for naturalness, labels, reason text and
model-generated pronunciation. Identities and varieties remain `needs_review`.
The default partners are fictional, with English biography fields consistent with
the existing persona authoring convention; they do not certify model dialect skill.

## Verification

Tests exercise bundled/disk parity, every configured
language/variety pairing, independent explanation writing, disabled romanization,
explicit speech mappings, multiword courtesy retrieval under the full production catalog, bounded optional
selection, and exact Unicode/UTF-16 spans.
Existing frozen baseline fixtures are not expanded with redundant cross-products.
No live provider calls, deployment, version bump or application-data edits are part
of this addition. Earlier translation fixes and unrelated release work in the
working tree are outside this commit.


Automated verification:
- Native language/content checks: all 12 definitions and every authored
  target/explanation pairing; 7 interface locales with 949 message keys each.
- Native configuration/phrase suite: 29 passed. Transcription suite: 4 passed,
  including optional-code multipart tests across direct, hosted and custom routes.
  Latin-focused suite: 5 passed, including Unicode boundaries and optional limits.
- Server upload/contracts suite: 51 passed, including optional versus malformed
  language codes.
- Composer and language-browser UI tests: 13 passed; recording remains enabled
  with a warning. TypeScript and native Clippy checks passed.
- Generated contracts and style ownership checks passed.

To exercise this in the app, rebuild/restart the native application and restart
its local server with the updated optional-language upload validator. A hosted
server requires a separately authorised deployment of that validator change.
No live transcription quality claim is made by these fixture tests.
