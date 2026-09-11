# R1 reading-assistance gates — read-only design review

Base: `5e006989a2f5d9376952a3cf55f6d713aee6e9f3` plus the current integrated,
uncommitted root source. Reviewed execution/gloss/turn-plan lifecycle, existing
native tests, adapter version construction, and reading presentation tests.
Only this report changed. No code edits, new capacity rules, Git writes, runtime
launches or provider calls. This is source review, not a new test execution result.

## Existing coverage to retain

- `execution.rs::g2_partial_result_survives_scoped_retry_failure_and_restart`
  already proves same operation/new attempt, retained accepted partial output after
  failed retry, ignored old completion, saved translation, restart retention and no
  ready work. Do not add another equivalent persistence test.
- `g2_success_orders_preserve_source_and_reads_do_not_schedule` accepts partial
  output as succeeded, preserves captured explanation language despite settings
  mutation, and checks both completion orders and read purity.
- `g2_siblings_finish_independently_and_failure_keeps_usage` covers helper failure,
  independent translation success and retained accounting.
- `g2_retry_checks_source_archival_and_attempt_budget`,
  `g2_deleted_source_rejects_late_result_and_retry`,
  `g2_cancel_and_revocation_block_publication_and_retry` and
  `g2_restart_retry_admits_only_gloss_on_paused_turn` cover existing authority,
  budget and restart isolation. Keep their behavioral assertions.
- Speech tests cover first/last arrival, helper failures, read-only cache,
  operation-scoped retries, interruption and room for the next reply. These are
  evidence of the current shared scheduler; they do not require a new capacity rule.
- `TurnView.test.tsx` already verifies explicit same-operation retry, duplicate-click
  suppression and continued reading while retry awaits. `SavedGlossText.test.tsx`
  covers occurrence anchors, Unicode, uncovered source and zero inference on reads.
  `conversation-view.test.ts` preserves saved partial output separately from a failed
  latest attempt. Avoid replacing these with implementation snapshots.

## Targeted additions or extensions when implementation is assigned

| Gate | Exact scenario and required observations | Proposed owner/location |
| --- | --- | --- |
| Durable retry replay | Extend the existing scoped-retry lifecycle scenario through `Store::execute(Action::RetryGloss)` and its real command receipt. Replay the same command ID before dispatch and after completion: only one admitted retry, same gloss operation, fresh attempt, unchanged reply/translation/speech attempts. A distinct retry command while ready/running must not admit another attempt. | Reliability, `execution.rs` associated lifecycle tests; Integration if shared command contract changes. |
| Successful partial is distinct from latest failure | Extend the partial-retention test: accepted partial has succeeded operation and partial coverage; during retry the accepted view remains readable; failed retry adds latest error without deleting or relabeling the saved coverage. If the proposed design adds assessment/quality state, assert its independence from transport/validation success only after Language defines it. | Reliability native projection; Interaction extends existing `TurnView` scenario for failed retry and displayed retained content. |
| Retry alongside speech | Add one combined scenario with speech still running, translation already accepted and partial gloss accepted. Explicit gloss retry dispatches independently of speech completion; resolving speech and retry in either order preserves their own publication and usage. Assert no second partner reply, translation or speech attempt and no regeneration from playback/reveal. Reuse existing speech helpers and capacity; no wall-clock performance assertion. | Reliability, `execution.rs`, with Interaction only if presentation behavior changes. |
| Retry cancellation and restart boundaries | Extend existing partial-retention/restart tests with a retry queued before dispatch versus running at restart. Accepted content survives both; automatic work does not replay; running attempt becomes unknown under current recovery policy. Explicit recovery admits just the gloss operation. Cancel a running retry and deliver its late result: no replacement publication, actual usage remains accounted, accepted source-bound content remains subject to the settled cancel semantics. | Reliability; Integration confirms whether new reading controls cancel one attempt or the whole turn before finalizing UI assertions. |
| Captured reading configuration | Once the capture policy below is settled, mutate reading configuration after Send but before child dispatch, and between first attempt and retry; reopen storage between phases. Assert the approved captured configuration is used, persisted result provenance matches it, and source/credential revocation still defeats publication. One parameterized lifecycle test plus pure Language validation cases is enough. | Integration owns shared settings/context schema; Reliability tests capture/admission/publication; Language owns config/version validation. |

These are extensions where practical, not a request for five new suites. Exact
operation identity, attempt counts and no-dispatch assertions are meaningful
contracts; exact incidental snapshot sequence values and private DOM class layout
are not the focus of this round.

## Configuration/version decision needed before tests can be prescriptive

Current Send context stores `settingsRevision`, target/explanation language,
resolved target and existing reply-template/routing identifiers. Gloss dispatch
constructs `SourceIdentity.analysis_version` from the current compiled
`linguistics::ANALYSIS_VERSION`. The prompt uses current adapter code, and
`gloss::validate` writes current `FORMAT_ID` / `TEMPLATE_ID` / boundary-policy
constants into the accepted projection. This does not demonstrate durable capture
of an independently mutable reading-assistance configuration.

There is no approved runtime reading-config contract in the reviewed slice. Do not
label that future capture mechanism implemented, or invent a legacy version loader.
Integration and Language should decide whether retries retain the initially captured
reading configuration, or explicitly select the current one with new attempt
provenance. Specify capture time (Send, accepted source, or first reading request),
which fields affect identity, and how an unavailable captured configuration fails.
The same gloss operation requirement need not imply identical attempt configuration,
but any allowed change must be visible and deliberate. Local legacy migration is
outside this round; preserving released server endpoints is unrelated.

## Finite verification for implementation handoff

Run the touched native lifecycle filters and Clippy; run the touched reading
component/projection tests. Language runs its existing adapter/core tests plus any
new configuration cases. Integration runs combined README gates after accepting the
bounded changes. Synthetic completions establish lifecycle and validation behavior;
linguistic usefulness and actual speech/reading experience require separately
coordinated QA. No paid evaluation is proposed by this report.

## Authorized implementation: one combined regression

Integration subsequently authorized exactly one test in execution.rs test section.
Added `gloss_retry_runs_alongside_speech_without_regenerating_siblings`, parameterized
only by speech-first versus retry-first completion. It uses the existing production
Store action/dispatcher and speech helpers with synthetic completions.

The test proves partial gloss acceptance followed by explicit `Action::RetryGloss`
while speech remains running: same gloss operation, fresh attempt, two simultaneously
running durable children, no additional dispatch, and retained readable partial
until new publication. Both completion orders preserve independent speech/audio and
gloss publication. Final checks preserve reply/source/translation, count exactly
one reply/speech/translation attempt and two gloss attempts, retain both providers'
usage, and leave no ready work. This is durable admission/publication evidence, not
a live HTTP transport timing or audio-device claim.

Focused native test: 1 passed, 176 filtered out. Clippy --lib --tests -- -D warnings:
passed. No production logic changed or bug demonstrated. No other tests added;
configuration-version extensions remain deferred. No Language file edits, Git
writes, runtime launch/restart or paid inference. Submitted for independent Code
Quality review and frozen pending that review.

Independent Code Quality source review completed with no actionable findings. Review
covered only the new combined regression and confirmed the stated behavioral scope;
reviewer did not rerun the focused test or Clippy. Integration was notified by the
reviewer. The test remains frozen with owner verification recorded above.

## Read-only wire-format transition review: inclusive first/last grapheme IDs

Conclusion: no execution-layer compatibility loader or runtime format-switch guard
is needed for a coordinated native rebuild/restart. No demonstrated path transports
an old in-flight response into a new compiled decoder. The new Language adapter was
still being edited during this review; this conclusion covers execution ownership,
not a claim that the new decoder implementation has passed validation.

Evidence:
- `Dispatch` owns operation/attempt identities, prompt messages and `gloss::Source`
  (source identity plus exact source text). The async transport task retains that
  same Dispatch until completion. Direct completion and grouped indexed callbacks
  both call `Store::finish` with the originating Dispatch.
- Prompt construction, schema selection and completion validation use Rust adapter
  functions/constants in the same running binary. Frontend HMR cannot replace the
  native decoder. Recompiling disk source does not replace functions in an already
  running process. There is currently no mutable runtime format registry.
- `Store::finish` checks matching running attempt and operation plus active turn
  before validating successful output. Gloss validation additionally checks the
  exact message ID/text and captured target/explanation languages. Terminal old
  attempts cannot publish into a new retry merely because the operation ID matches.
- Startup reconciliation marks previously running attempts/operations unknown and
  removes permits. Outstanding network tasks/Dispatch values are not serialized or
  resumed. Explicit retry reuses the gloss operation but constructs a fresh prompt,
  source and unique attempt using the newly running binary. The workspace file lock
  also prevents concurrent native database owners.
- The server's duplicate response returns attempt state, not a stored provider body
  for decoding; new retry attempts have distinct identities. Saved WordGlossView is
  already validated/renderable data, not raw old wire output passed to the adapter.

Required integration gate (Language + root, no compatibility behavior):
1. Change prompt/catalog, schema, decoder field names and format/template provenance
   together in one native build. Keep old start/end boundary-wire examples rejected,
   not translated or accepted through aliases. Update lifecycle synthetic fixtures
   to the new wire format, while keeping the core/projection contract unchanged.
2. Language should have one strict rejection case for old start/end+b IDs and a
   mixed old/new object. Existing strict unknown-field machinery can cover this;
   do not introduce a second parser. Test inclusive first==last on one grapheme and
   multi-grapheme last-to-exclusive-core conversion in the pure adapter tests.
3. Reuse existing restart/scoped-retry and old-completion no-op regressions, plus
   the combined gloss/speech regression. No new execution test suite or production
   execution edit is warranted solely for this immutable compiled-format change.

An operation may have an accepted projection from a previous attempt and a new
attempt produced by a later binary; that is retained accepted data, not decoding
one response under two formats. Future mutable reading configuration would need
its own explicit capture policy, already deferred in this report. No Git writes,
execution edits, app restart, provider call or test execution in this review.

## Captured writing guidance regression and new synthetic wire fixture

Integration authorized execution.rs test-section changes after its production
prompt-guidance edit. Added one parameterized test:
`writing_guidance_keeps_target_and_explanation_languages_independent_and_captured`.
Target/explanation combinations zh/en, es/zh, zh/zh and es/en run through partner
and coach Send/dispatch. Chinese target guidance is independent of Chinese coach
explanation guidance. Settings changed after Send cannot replace the captured
coach explanation or deferred translation destination. Traditional quotation/source
text remains byte-for-byte intact; this tests prompt construction, not generated
script quality. No production prompt or language-registry edits by Reliability.

At Integration's explicit request, changed the synthetic `gloss_reply()` fixture
from start=b0000/end=b0004 to first=g0000/last=g0003 for the same Hola span.
No recorded or real provider response was translated, relabeled or made compatible.
Language's new grapheme-v2 / prompt-v4 adapter was present for the fixture checks.

Verification: writing-guidance test1passed; existing g2 lifecycle8passed; combined
gloss-retry/speech test1passed. Clippy FAILED on Integration-owned production
execution.rs:305 nested coach/guidance condition (collapsible_if); reported to
Integration without editing production code. Owned rustfmt and git diff --check
passed. No new broad suite run. Submitted to Code
Quality for independent source review; execution test section frozen. No runtime
restart, provider calls or Git writes.

Code Quality's bounded review of the new writing-guidance test and synthetic fixture
closed with no actionable findings. Reviewer also verified Integration's nested-if
source correction; Integration owns final Clippy verification. Reliability has not
rerun or claimed that final gate. No further tests requested; source remains frozen.

## Authorized five-level difficulty contract

Integration assigned model.rs Difficulty, languages.rs default, associated store
synthetic tests and generated src/contracts.ts after approving Beginner as default.
Implemented AbsoluteZero/Beginner/Intermediate/Advanced/Fluent with exact snake_case
wire values absolute_zero/beginner/intermediate/advanced/fluent. No aliases, legacy
variants, fallback decoding, migration or database mutation. HelpAmount::Balanced
is a separate setting and remains intact. Store copy/persistence fixtures now use
Advanced and Beginner; these are synthetic fixtures, not saved-data conversion.

Added one strict contract test for all five round trips and explicit rejection of
old gentle/balanced/challenging plus noncanonical zero in full PracticeSettings.
Added one default test covering every registered language. Existing independent
conversation-settings copy/reopen test passes with the new values.

Verification: each of those three focused tests passed (1 each,187 filtered out).
Final Clippy --lib --tests -- -D warnings passed. Contract generation and subsequent
--check passed. Owned rustfmt and git diff --check passed. Interaction was notified
of generated contract ownership/completion. Root owns execution prompt wiring and
AI Operations owns conversation_prompt.rs; neither edited by Reliability.

Integration reports the user explicitly approved a local development database reset;
Integration alone owns shutdown/reset/relaunch and preservation of all log runs.
Reliability performed no runtime launch/restart, database reset, key changes, paid
inference or Git writes. Source frozen and submitted to Code Quality review.

Independent Code Quality source review of the frozen difficulty contract/default/
generated slice closed with no actionable findings. Reviewer verified scope and
strict wire behavior in source plus diff check; focused tests/Clippy/contracts/fmt
remain Reliability's executed evidence, not reviewer reruns. Integration notified.
Prompt/wiring/UI and approved reset remain separate owner scopes.
