# Patch release readiness audit

Status: original findings, 18 September 2026, followed by user-approved cleanup.
The user chose complete removal of mystery personas and fixes for items 2 and 4.
Mystery UI, commands, contracts, storage and discovery XP are now removed, resolving
items 1 and 3 by removing the feature. Creator save errors are separate from draft
validation errors, so explicit retry and view switching remain available. Preview
now says “Opening request preview · no conversation history or model call.”
Verification of this follow-up is recorded below. Original findings are retained
as audit history, not outstanding feature requirements. Scope: the conversation prompt redesign,
its learning/reward interactions, and release tooling/current patch delta. This is
not a complete security, device or live-provider audit.

## Recommended before release

### 1. Mystery XP breaks progress statistics — reproduced

Native `learning/learner/progression.rs` includes mystery credits in `profile.xp`.
UI `domain/learning/statistics/practice-statistics.ts:39` requires skill-domain XP
alone to equal that total; line 53 repeats the mismatch for skill credit records.
`ProgressSummary` invokes this during rendering. A valid mystery reward therefore
throws rather than producing the progress report. This mismatch predates the
lesson removal.

Verification: a temporary Vitest reproduction cloned `skillDemo`, added one
mystery credit `{personaId: 'p', conversationId: 'chat', field: 'location', xp: 1}`,
and set profile XP to 1. It confirmed the exact error `Domain XP does not reconcile
with profile XP`. The temporary test asserting broken behavior was removed after
the audit; a repair should add permanent coverage of correct reconciliation.

Recommendation: reconcile skill and mystery credit totals separately and add them
for overall XP. Keep discovery rewards distinct from language-skill evidence and
preserve provenance validation. Include mixed skill/discovery regression coverage.

### 2. Failed creator Apply blocks straightforward retry — code inspection

`ConversationPromptCreator.tsx:20,45,61` uses one error state for native preview/YAML
validation and failed persistence. A failed Apply retains the draft, but disables
Apply; in YAML view it also disables switching to Form/Preview. A user has to edit
the draft or reopen the dialog instead of retrying a valid configuration.

Recommendation: separate validation errors from save errors. Allow an explicit
retry for a valid draft, retaining staged topic edits. Handle revision conflicts
explicitly; do not silently overwrite newer settings or automatically retry writes.
Existing failed-Apply coverage establishes retention, not successful recovery.

### 3. Prompt transparency exposes mystery answers — product decision

`ConversationPromptCreator.tsx:51` displays the full persona in an expandable
background view, including when persona prompting is disabled. With persona
prompting enabled, the prompt preview also contains those values. Meanwhile
`MysteryPartnerPanel.tsx:62` hides fields until guessing/reveal, and
`PersonaForm.tsx:75` promises that behavior. Full prompt transparency was requested;
these two product behaviors need an explicit reconciliation, not a hidden redaction.

Recommendation: an explicit spoiler reveal before showing hidden persona data in
either inspector. Decide whether inspecting those answers should affect discovery
XP, or whether inspection is an accepted bypass. Do not remove truthful request
inspection or invent a separate misleading prompt preview.

### 4. Label preview as an opening request — small clarity fix

Native `conversations/conversation_prompt.rs:137` previews the opening prompt with
no conversation history. The creator can also be opened during an ongoing chat,
but its label only says “Draft preview · no model call.”

Recommendation: explicitly label it an opening-request template without history.
Actual captured requests remain available through the existing diagnostics. This
does not need another prompt-generation subsystem.

## Release verification still needed

- Schema 23 intentionally rejects the previous schema. Release notes and a native
  smoke test should cover the explicit development workspace reset flow. No
  migration or silent deletion is proposed; no app-data reset was performed here.
- Run the actual app through Arabic/Levantine and German starts, topic/tense/
  difficulty changes, persona omission, saved-topic reuse after restart, and an
  ongoing conversation settings update. Automated composition checks do not prove
  model adherence or native UI quality. No live-provider or device smoke test was
  completed in this pass.
- Review and commit the intended patch scope before tagging. The shared working
  tree contains unrelated work, and HEAD changed during this audit (last observed
  `b64b774`). Do not sweep unrelated changes into a release commit. No release
  script, version bump, push, tag or deployment was performed by this work.

## Recommended to defer

- `ui/src/types.ts` retains unused legacy `TeachingPlan`, `ObserverDocuments`,
  `RequestContext` and `RecordedRequest` declarations and obsolete source comments.
  Narrow dead-contract cleanup is worthwhile; it is not necessary for this feature.
- `native/src/model.rs` and `ConversationPage.tsx` remain large mixed owners.
  Follow the agreed one-file-at-a-time refactor process separately from this patch.
- Production build reports the existing large JavaScript chunk (about 1.08 MB raw).
  Measure startup/loading before choosing bundle splitting; this audit established
  a build warning, not a measured runtime regression.
- The separate AI-view/streaming implementation note is a proposal, not a completed
  feature or a prerequisite for this release. Keep that work outside this patch
  unless explicitly selected.

## Checks completed

See the [implementation report](conversation-prompt-implementation-2026-09-18.md)
for full scope and test details: native 391 passed/1 ignored; frontend 744 passed;
final changed UI suites 40 passed; final opening regressions 5 passed; Clippy with
warnings denied, formatting, generated contracts, content, localization, styles,
documentation links and production frontend build passed.

Additional release checks: release-tool tests 15 passed; iOS contract check passed;
iOS tooling tests 2 passed; server transaction/deployment tests 17 passed. These
are tooling and focused server checks, not a signed application build, device run,
full server suite or production deployment verification.

## Approved cleanup verification

The complete mystery-persona removal includes persona mode selection and metadata,
guess/reveal/nudge commands, discovery tables, snapshot and generated types, XP
projection and ledger UI, tests of the retired feature, styles and unused localized
labels. Active guides no longer prescribe discovery behavior. Historical notes and
the archive retain their historical record. A repository source scan (excluding
those historical notes) found no remaining mystery-persona references.

The schema is now 23. Existing development workspaces require the explicit reset
flow; this work did not reset data. Source changes do not introduce migration code.

Native library suite: **389 passed, 1 ignored**. Frontend suite: **117 files / 744
tests passed**, including explicit retry with preserved staged edits, valid YAML
view switching after a save error, invalid-YAML blocking and opening-preview
labeling. Clippy with warnings denied,
generated-contract freshness, Rust formatting, TypeScript, production build,
styles, seven locales / 957 keys, documentation links and whitespace checks passed.
The existing large-bundle warning remains. No release, deployment or live-provider
test was performed.

Subsequent user testing identified word-gloss fragility. The user-approved
[recovery and bounded repair implementation](word-gloss-recovery-2026-09-18.md)
addresses harmless punctuation gaps and preserves valid annotations, with a single
fast-model repair for unresolved regions. Speech-recognition quality and the
separately identified upstream-error classification remain deferred; neither is
claimed fixed by annotation recovery.
