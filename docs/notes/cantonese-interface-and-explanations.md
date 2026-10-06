# Cantonese interface and explanations

Implementation and verification record, 2026-10-05. Continues the
[Cantonese speech implementation](cantonese-speech-support-audit.md).

## Agreed scope

Cantonese is a peer of Mandarin, both as a learning language and as a learner's
interface/explanation language. The Cantonese edition uses Hong Kong Cantonese
wording in Traditional characters. Mandarin retains its current Simplified
edition; Taiwanese Mandarin and additional script preferences remain deferred.

The user explicitly requested direct Codex authoring of this material. No runtime
provider authored these translations. An initially proposed external translation
request was blocked before any text was sent and was abandoned. Local scripts
only assemble directly authored strings, validate coverage and write the bundle.

## Implemented behavior

- The interface includes 廣東話 (`cantonese`, `yue-Hant-HK`), with all 1,440
  message keys, interpolation fields and plural forms covered.
- The primary app-language control sets the interface and explanation language
  together, selecting `cantonese-hong-kong`. The existing secondary explanation
  override remains available. Saved preferences survive reopening and seed new
  conversations through the existing preference flow.
- Mandarin's interface label explicitly identifies Mandarin and Simplified
  characters (`zh-Hans`). Language/script matching is shared and uses
  `Intl.Locale`; it does not infer Cantonese from a Hong Kong region alone.
  An explicit `yue` or `yue-Hant-HK` preference selects Cantonese. `zh-HK` does not
  silently become either Cantonese or Simplified Mandarin.
- Eight shared concept guides and 168 language-specific guides provide all eight
  skills for every one of the 21 learning languages. These files load directly
  from the bundle without on-demand translation. Existing assessment definitions
  and earned-credit behavior are independent of the explanation edition.
- Explanations, example meanings, notes and variety supplements are authored in
  Cantonese. Target-language example text, subskill identity and variety
  applicability are retained from each declared source edition. Mandarin examples
  retain Simplified characters even though their explanations use Traditional
  Cantonese. The Mandarin and English editions include relevant Cantonese learner
  contrasts rather than treating Chinese script as language identity.
- Existing declarative Cantonese explanation-writing guidance reaches coaching
  across learning languages. No Cantonese-specific runtime branch, provider call
  or persisted-schema change was added for these editions.

## Content status

The guide files record direct AI authorship, their source paths/revisions and citations,
and `needs_review`. Exact backend model metadata was not recorded, so the generation
record is explicitly null rather than inventing a provider model ID.
Direct authoring and self-review are not independent linguistic
review. Existing source limitations remain explicit. The interface catalog has
been checked for keys, placeholders and plural entries; automated validation
cannot certify translation naturalness.

## Verification

Coverage tests require a Cantonese edition for every learning language, compose
every selected variety's guide, preserve source examples, and check that
assessment requests do not depend on the explanation language. UI tests cover
selection, locale negotiation, interpolation and formatting. Native tests cover
preference persistence and Cantonese instructions in coaching prompts.

- `npm run check:fast`: passed on the final content state; eight complete interface
  catalogs, 1,440 messages each, no unused-message candidates.
- UI suite: 1,809 tests in 272 files passed with
  `node ../node_modules/vitest/vitest.mjs run --maxWorkers=2` from `ui/`.
  The ordinary full run exposed two stale learner-message button selectors;
  they now select the existing Coach button and retain their editing/feedback
  assertions. A subsequent unrestricted run hit an unrelated preview timing
  timeout under load; the complete two-worker run passed without changing that
  test or its timeout. The test environment still emits canvas-not-implemented
  notices from existing microphone rendering tests.
- `npm run build`: passed (TypeScript and production bundle). Vite retains its
  existing large-chunk advisory.
- `npm run languages:check`: passed, including all 71 configuration tests.
- `npm run content:check`: passed. The final authored corpus has 344 learner
  guides. The audit still lists 336 previously optional Spanish/Arabic translation
  files as unauthored; none of these are Cantonese gaps.
- An additional final-file comparison checked all 176 Cantonese documents,
  all 930 unchanged target examples, source revision provenance and explicit
  `needs_review`/unrecorded generation metadata.
- `cargo check --manifest-path native/Cargo.toml --bins`: passed.
- `cargo test --manifest-path native/Cargo.toml --lib --quiet`: 833 passed,
  five existing explicit live/experiment tests ignored, no failures, on the final
  content state.
- `cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings`:
  passed on the final content state.
- `npm run contracts:check`: passed; generated contracts match their sources.
- `npm run docs:links` and `git diff --check`: passed.

No live application or expert linguistic review was performed for this
interface/content change; the earlier live speech results remain documented
separately.

No deployment or commit is part of this work. Other working-tree microphone
changes are outside this feature's scope.
