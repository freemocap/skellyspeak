# Arabic romanization fixture ownership

Status: deferred follow-up requested by the user, 2026-09-15. No files moved or
runtime/test behavior changed.

Review the placement and duplication of
`native/src/language/fixtures/arabic-romanization-prompt.txt`. The user wants Arabic
behavior content consolidated with its language definitions under `content/`.

Current observation: this text file is an expected-output snapshot used by
`arabic_gloss_prompt_snapshot_has_explicit_scheme_and_preserves_source` in
`native/src/language/languages_citation_tests.rs`. Runtime guidance is already
configured through `content/config/languages/romanizations.yaml`, referenced by
`content/config/languages/languages/ar.yaml`.

Later, review whether to relocate the snapshot into a clearly marked content test
fixture area or replace duplication with focused assertions. Keep editable Arabic
rules in the language YAMLs. Do not turn the expected-output test into a comparison
of the same source to itself or introduce a second editable runtime authority.
