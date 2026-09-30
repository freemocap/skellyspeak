# Greek and Thai language addition

Status: source implementation and automated verification complete; fluent-speaker
review and live native speech checks remain outstanding.

## Scope and format review

The current contract was checked against `content/README.md`, the generated
language schema, Rust document loading/linking/validation, and the existing
Russian, Indonesian and other language files. The registry discovers files;
there is no new hardcoded language list or interface translation.

- Greek → Greece: contemporary standard Modern Greek, monotonic spelling.
  Ancient Greek and separate regional profiles are not included.
- Thai → Thailand: standard Thai with context-appropriate pronouns and polite
  particles. Regional languages are not represented as standard Thai variants.
- Each file owns identity, canonical integration tags, scoped writing and reading
  definitions, explicit defaults, one variety, courtesy hints, all twelve skill
  guides, greeting, partner and all six practice banks (52 phrases per language).
- Each skill has a language core, two translated examples and an explicit variety
  section. Explanations are authored drafts, not claims of expert review.
- All six shared topics have target/explanation labels and matching romanization
  entries. Existing speech capabilities already cover `el` and `th` for recognition
  and synthesis; no routing preference overrides were introduced.
- Shared foundations gained Greek and Thai script capabilities and the Kra-Dai
  family. Thai declares unspaced words and tones. Script scale remains 1.0.
- This is bundled teaching content, with no persisted workspace shape change.

## Writing and reading policy

Greek preserves source accents, diaeresis, sigma forms and punctuation. Its
ALA-LC scheme uses the Modern Greek table, including its contextual consonants
and historical rough-breathing rule. The aid omits stress and is not phonetic
transcription. [@ala_lc_greek] [@unicode17_europe]

Thai preserves its source spacing, vowels and tone signs. The selected Paiboon
convention represents lexical tone with five possibilities: unmarked mid,
grave low, circumflex falling, acute high and caron rising. Vowel doubling marks
length. The exact consonant/vowel convention is declared in the configuration,
with examples covering all five tones; it does not combine Paiboon `g/dt/bp`
with another convention's aspirated `kh/th/ph`. This is a pronunciation-oriented
aid, not reversible spelling or evidence of the learner's actual pronunciation.
[@thai_paiboon_conventions] [@unicode17_southeast_asia]

No matching normalization or language-specific executable rules were added.
The existing Unicode matching and reading machinery remains responsible for
source preservation. Idiom evidence and review limits are recorded in
[the shared source ledger](practice-idioms-sources.md).

## Fonts and presentation

Greek uses the existing bundled Noto Sans fallback. Thai adds complete Noto Sans
Thai from the existing pinned font repository revision, converted to WOFF2 with
fontTools 4.66.1 without subsetting or shaping-table edits (108,220 bytes).
License, source URL and hashes live beside the asset in `ui/public/fonts/`.
The shared font stack includes the range-restricted face at the root and nested
language boundaries. No language-specific font scale is necessary for this pass.

The existing font preview now includes Greek composed/decomposed accents and
Thai stacked marks, tone-marked reading aids and an unspaced Thai saved-gloss
example. That fixture verifies rendering and opening an authored annotation;
it does not prove generated word segmentation quality.

## Verification

- `npm run languages:check`: passed; 20 languages, 24 varieties, 51 configuration
  tests, including all target/explanation pairs, topics, greetings, full skill
  coverage, practice sets, speech capability coverage and bundled/disk equality.
- Added Greek and Thai to production registry and courtesy retrieval regression
  tables, including canonical decompositions and cross-language negative cases.
- `npm run contracts` then `npm run contracts:check`: passed. The expected
  generated change is the content-derived skill catalog version; no type shape
  changed. Generated files were produced by the existing Rust exporter.
- `npm run styles:check` and `npm run previews:check`: passed.
- Font cmap checks cover all Greek/Thai source text and reading aids, including
  canonical decompositions: 54 Greek/mark, 50 Thai and 43 aid codepoints. Thai
  GPOS and GSUB tables remain present.
- Browser preview: inspected Greek/Thai at 100% and 200% reading size, wrapping,
  stacked marks, reading aids and Thai saved-gloss expansion. Font loading reports
  include Noto Sans Thai. This was a component preview, not a running native chat.

## Remaining review

All linguistic content remains `needs_review`. Fluent speakers should review
idiomatic register, Greek agreement/aspect examples, Thai particle selection and
the authored romanizations. Paid generation, transcription and synthesis were
not exercised. Native device/webview behavior and actual generated segmentation
require their own live checks. No commit, release or deployment was performed.
