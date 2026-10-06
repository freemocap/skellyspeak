# Existing language variety cleanup

Date: 2026-10-05. Status: implemented; automated verification recorded below.

## Agreed scope

Regularize existing variety coverage first, then stop for review. Chinese grouping,
new Mandarin profiles, script selection and Cantonese are a separate design pass.
This work does not change language/variety identities, learner selections, stored
history, provider routing, release versions or database format.

## Audit observations

The catalog has 20 languages and 24 varieties. Arabic, English, French and Spanish
each offer two alternatives. Their variety guidance was empty; labels and broad
descriptions did most of the work in general conversation. Skill assessments and
guides already have independent variety dispositions and sometimes concrete
supplements. Selected skill conversations also consume guide supplements.

Resolution composes shared policy, traits, orthography, language and variety
guidance. Target and explanation contexts are independent and captured for later
operations. This structure is retained. Prompt composition is additive; it does
not detect semantic contradictions in authored prose.

## Implemented behavior

- All 24 varieties receive common writing/assessment policy. Bare descriptions
  have been replaced with stated coverage. Existing specific single-variety
  descriptions are retained rather than adding redundant linguistic overrides.
- The eight alternatives in multi-variety languages now have cited target and
  explanation writing guidance: US/UK spelling and vocabulary, Mexican/Spain
  plural address, France/Canada lexical preferences, and Levantine/MSA usage.
- Concrete contrasts are examples, not exclusive dictionaries. Broad profiles
  preserve valid regional alternatives and do not prescribe one accent.
- The selected target variety governs new text even when a partner biography
  describes another region. Existing personas are retained. Names, identifiers,
  quotations and learner evidence are not rewritten to match generation policy.
- Arabic orthography still requires full vocalization as an app teaching policy.
  Dialect-versus-MSA grammatical vocalization now belongs to variety guidance.
- Private correction/analysis prompts now include target writing guidance, as
  suggestions already did. Coaching and Drill label each guidance scope so target
  and explanation rules are distinguishable, including two varieties of the same
  language. Existing conversation, reading and persona prompts retain their
  field/scope-specific assembly.
- Coaching prompt recipe identifiers distinguish these instructions in newly
  captured diagnostics. Release versions and old captured records are unchanged.
- Runtime validation rejects a description that only repeats the display name,
  and rejects multi-variety alternatives missing either writing scope. Source
  citations remain required for guidance. No schema or serialized field changes.

## Why local guidance is justified

Shared rules can express consistency, appropriate register, quotation preservation
and fair treatment of variation. They cannot determine whether a selected profile
uses US or UK spelling, which plural address system to generate, or whether Arabic
output should be spoken Levantine or MSA. Those actual distinctions therefore stay
declarative in the existing variety guidance fields. All `overrides` maps remain
unchanged. No language-name checks, Unicode matching exceptions or script ranges
were introduced in executable code.

## Sources and review limits

The shared variation policy builds on [@asha_language_variation]. Its application
to model instruction consistency and persona precedence is a product decision,
not a claim of experimentally established prompt effectiveness.

US/UK contrasts use only selected spelling/vocabulary facts from
[@british_council_english_variants20261005], not that page's broad grammar or
historical generalizations. Plural address uses [@colmex_ustedes20261005] and
search-indexed passages from [@aml_plural_address20261005]; the latter page returned
403, recorded as abstract-only review. French uses [@oqlf_weekend20261005], whose
Quebec preference is not treated as a description of every Canadian community.
Arabic uses [@lingualism_levantine_verbs2026],
[@lingualism_levantine_writing20261005], selected vocabulary comparisons from
[@playaling_levantine_usage20261005], and the existing MSA reference [@ryding2005].
All variety content remains `needs_review`; original instructions/examples have
not received independent native-speaker review.

## Verification

Passed locally on Windows:

- `npm run check:fast` on the final code/content state.
- `cargo test --manifest-path native/Cargo.toml --lib`: 827 passed, 5 intentionally
  ignored. After updating the diagnostic recipe identifiers, the four execution
  language-context tests and two new coaching variety tests passed again.
- `cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings`.
- `cargo check --manifest-path native/Cargo.toml --bins`.
- `npm run contracts:check` and `npm run languages:check` (69 configuration tests).
- `npm run docs:links` and a scoped `git diff --check`.

Regression coverage exercises all current conversation varieties, independent
target/explanation rules, correction/suggestion writing coverage, invalid missing
coverage and Arabic orthography ownership. The selected 121-pair prompt snapshot
was regenerated through the native inspector; a comparison asserted that every
non-guidance context field and persona stayed equal before writing it.

The larger existing configuration/coaching coordinators received focused changes;
their unrelated responsibilities were not decomposed in this language-behavior
pass. New behavior suites are separate, colocated files. Unrelated UI/audio edits
in the shared checkout were preserved. No commit, deployment, live inference or
running-application validation was performed. Automated coverage does not certify
the generated language or audio quality.

## Follow-up after this pass

Stop before designing Chinese/Cantonese. In that pass, distinguish learning
identity, regional variety, writing convention, register and reading scheme.
Keep existing Mandarin history intact regardless of browser grouping.

Speech remains separately qualified: synthesis currently sends an accent label,
not this text-generation guidance, and provider voice/model support is not proven
by text prompt tests. The current catalog lists `yue` for transcription but not
Eleven v3 synthesis. Do not substitute a generic Chinese tag to claim Cantonese
support. Live model/voice comparisons and linguistic review remain unperformed.

The later authorized Cantonese implementation supersedes this follow-up boundary; see [routing, content and verification limits](cantonese-speech-support-audit.md).
