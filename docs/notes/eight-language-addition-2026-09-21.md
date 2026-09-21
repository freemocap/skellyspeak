# Eight-language addition — 2026-09-21

Implemented, uncommitted. Korean, Japanese, Vietnamese, Indonesian, Turkish,
Russian, Ukrainian and Cherokee use the existing language document schema and
registry. Each includes a default variety, orthography, explicit romanization
mode, courtesy material, greeting, starter partner and all six shared topics.
Shared script/family entries were added only where absent. Bibliography entries
record the reviewed orthographic and romanization sources. No schema relaxation
or special language loader was introduced.

The Indonesian startup error was an authoring-order error: `eyd-v` referenced
`indonesian_eyd_v` before its bibliography entry existed. The full content check
also caught uncited draft guidance. References were supplied and incomplete draft
guidance removed before final validation. All 20 languages now load through the
same strict validator. Existing invalid-reference tests remain intact.

Cherokee uses Oklahoma Cherokee, the syllabary and traditional reading aids.
Sources include the Cherokee Nation verb handbook/lexicon, first-500 vocabulary,
Shiyo and Unicode; exact URLs and scoped claims are in references.bib. Speech
continues through the existing ElevenLabs service: Scribe v2 receives ISO codes
from language identity, including `chr`; Eleven v3 retains the existing speech
context path. The separate OpenRouter transcription mappings remain separate.
No language-specific warning screen was added.

Complete Noto Japanese, Korean and Cherokee fonts are bundled with licenses,
checksums and upstream provenance. Japanese/Korean Han forms follow explicit
text-language boundaries. Existing Latin/Cyrillic fonts cover the other additions.
The style checker permits only font-role overrides at these boundaries, in the
existing token owner. Language badges, pickers and unannotated reading retain
language tags. The font inspector reads the same scoped stack.

Turkish courtesy matching now respects dotted/dotless I after NFC normalization;
source text is not rewritten. Tests cover canonical decompositions and Cherokee
case, plus each new language's identity, writing, romanization and partner fields.
The registry-wide audit automatically includes all new target/explanation pairs.

Verification:

- `npm run languages:check`: 20 languages; 33 configuration tests passed.
- Five focused UI suites: 84 tests passed, including Gaelic switching, script
  graphemes, reading components and font resolution.
- ElevenLabs adapter suite: 49 passed, including outgoing Scribe v2 language codes
  for all eight additions. These are mocked provider tests, not live speech calls.
- `npm run build`, `npm run styles:check`, `npm run previews:check`: passed.
- Browser font preview visually inspected for all eight scripts/orthographies,
  including decomposed Hangul, Japanese dakuten, Vietnamese marks and Cherokee
  upper/lowercase. This is browser rendering verification, not a native app run.

No commit or deployment performed.

## Cherokee reply-assistance failure and correction

The 15:11 UTC failed assistance attempt used `google/gemini-2.5-flash`.
Both romanization fields copied the Cherokee reply text, while pronunciation
contained Latin text. Its request already contained the correct captured scheme.
Validation correctly rejected U+13A3 in replies[0].romanization. This was a model
field-assignment failure, not a missing language definition or a speech failure.

Reply assistance v8 now explains the source/reading direction and Latin-lookalike
check. The existing response field description includes the captured romanization
scheme for every non-Latin language; no language-specific schema or retry path
was introduced. Cherokee's existing scheme instructions now explicitly pair field
values with source examples. Validation remains strict. A regression retains the
observed bad reply fields and verifies their rejection and corrected acceptance.

A single live test used the production prompt/schema with a synthetic Cherokee
sentence, empty history and no learner source. OpenRouter request
`gen-1790003773-0JgVHcP9qirUdwP9BX8B` returned model
`google/gemini-2.5-flash`, finish `stop`, 879 input / 233 output tokens,
reported cost $0.0008462. Both romanization values used Latin letters. The response
passed the actual native assistance validator. This is one successful model test,
not a guarantee of every future model response. No private conversation was sent.
The temporary export/validation instrumentation was removed afterward.

Contracts were regenerated from Rust and `contracts:check` passed. The design
system token inventory and CSS bundle were regenerated; its check passed.
