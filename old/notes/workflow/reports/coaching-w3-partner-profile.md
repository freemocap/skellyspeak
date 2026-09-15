# Wave 3: partner-scoped learning evidence

## Scope

This bounded slice adds a Partner filter to the explicit learning-evidence view
and groups construct rows by their configured lens. It does not change partner
conversation prompts, introduce a proficiency score, or complete Wave 3.

Native code resolves partner ownership from retained conversations, filters
observations before the estimator fold, and returns evidence, estimates, scope,
partner options and lens metadata in one locked read. Archived contacts remain
inspectable. Invalid partner/language selection is an explicit error.

The frontend verifies returned scope, discards stale reads, and preserves source
inspection and revision-checked exclusions. Practice XP and existing profile
choices remain language-wide, as do View YAML and Save YAML. Excluding an attempt
still changes its contributions globally; selecting a view does not mutate data.

## Verification

Integration checks passed: 595 frontend tests, 309 native tests (one live test
ignored), build, formatting, Clippy, generated contracts, and 28 documentation /
7 documentation-security tests. New tests cover partner identity, pre-fold counts
and source quotes, exclusions, archived/renamed partners, invalid scope, unchanged
language-wide exports, stale responses and late exclusion errors.

The UI agent inspected the production profile in the browser with mocked IPC:
desktop light, dark at 360px, long partner names, grouped rows, source inspection,
exclude/restore and archived-empty-partner recovery. YAML buttons were grouped to
stay adjacent after a long-name layout defect was observed. Final focused tests
(13), styles and whitespace checks passed. See `partner-profile-visual-qa.md`.
Native application access remains limited by the locked Mac; these rendered
component checks do not claim native persistence or device verification.
No live inference, database reset, deployment or Git writes are part of this
round. The previous checkpoint is `8aa14b4`; its one-time Git permission is spent.

## Remaining work

Fluency, session goals/reviews, coach openers, complete learner-choice export and
remaining reward effects/milestones remain planned. The observed conversation
self-answering remains unresolved; transport checks are not semantic validation.
