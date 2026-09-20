# Language behavior boundary audit

Status: implemented and targeted checks passed, 2026-09-20. No commit.

## User decision

Language-specific behavior belongs only in language configuration and language
handling. Product features consume shared capabilities; a rendering fix must not
special-case Arabic or another individual language.

## Findings and implementation

- Reading's three-script shaping whitelist moved out of `domain/reading` and was
  replaced by `domain/language/script-text.ts`. Joining characters use Unicode 17
  joining properties; combining/conjunct clusters use Unicode grapheme segmentation
  through `Intl.Segmenter`. Shared scripts and mixed text use the same mechanism.
  The joining table has source provenance, a bibliography entry and Unicode license.
- MixedText's script-run recognition and LanguageBrowser's script-sample selection
  now belong to the same language owner. Badge samples preserve whole graphemes.
- Native coaching's configured-script matching and romanization-letter rules now
  belong to `language/script_text.rs`. Coaching calls semantic helpers. Existing
  validation policy, including the unknown-script tolerance, is preserved.
- Audio transport's content-free Unicode/script profiling moved from
  `ai/transport/speech_diagnostics.rs` to `language/text_diagnostics.rs`. Transport
  and diagnostic callers use that owner; serialized metadata remains unchanged.
- A UI architecture test rejects Unicode script matchers outside language handling.
  UI and native READMEs document the ownership boundary.

## Audit scope

Reviewed active UI, native, server and tooling for language identifiers, script
matchers, character ranges and language-dependent branches. Remaining named
languages in localized strings, configuration, font asset mappings, test fixtures
and preview scenarios are data, not feature-specific behavioral exceptions.
Server font declarations are generated asset coverage; no runtime language branch
was identified there. Deprecated `old/` material was excluded.

This records the reviewed code and fixes, not a claim that a text scan proves all
possible future violations absent. The architecture guard covers UI script
matchers; other forms of identity-dependent logic still require code review.

## Verification

- UI agent: 117 tests passed across nine files, including multilingual shaping,
  saved reading, gloss grouping, MixedText, TurnView and the boundary guard.
- Native: 66 language tests, seven coaching execution tests and 52 speech tests
  passed. Speech fixture tests required local loopback access after sandbox bind
  errors. No live AI calls. One separate paid live coaching test remained ignored.
- Full UI typecheck remains blocked by existing ConversationPage/ReplyHelp type
  mismatches and a removed ComposerHelp import in ConversationReadingProvider's
  test. Those concurrent changes were not altered for this audit.
- Diff whitespace check passed. No native application launch or deployment.

Browser grapheme coverage follows the runtime's `Intl.Segmenter` Unicode support;
joining-property coverage is pinned to Unicode 17.
