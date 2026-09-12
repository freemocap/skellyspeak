# Audit remediation — 12 September 2026

This tracks implementation following [the audit](audit-2026-09-12.md). The audit remains a record of the reviewed checkpoint; this report records subsequent fixes. Other tasks' prompt and phone-layout edits remain in the working tree. No Git writes, deployment, paid inference or real-data reset were performed by this remediation task.

## Implemented fixes

| Audit item | Result |
| --- | --- |
| A01 · reset ownership | Reset and refused-workspace export require exclusive ownership; reset retains the stable lock after SQLite closes and while files are erased. |
| A02 · cleanup destinations | Deferred records accept a symbolic `logs` destination resolved from trusted native configuration. Arbitrary paths and invalid records fail closed. |
| A03 · provider errors | Remote refusal text cannot enter persisted errors. Client-authored status/code guidance and validated request IDs remain available. |
| A04 · persona inference lifecycle | Bounded begin/run/cancel ownership, captured authority checks, durable metadata receipts, restart recovery and usage/activity reporting are implemented. The authorized schema 11 → 12 upgrade preserves existing conversations. |
| A05 · settings/session races | Only the current projection read can adopt state; newer reads retain outstanding write invalidations. |
| A06 · evidence races | Desired language/revision owns the request and trailing reload; returning to cached evidence abandons other scope's work. |
| A07 · late speech | Suspension revokes a playback permit, including audio still loading when focus is lost. Returning does not revive abandoned playback. |
| A08 · list edit loss | List changes enter the parent draft immediately and participate in close/save handling. |
| A09 · invalid draft trap | Explicit discard restores saved details; all exit paths use the same save policy. |
| A10 · export reuse | Unique staged exports cannot inherit stale sidecars; failure does not publish an incomplete backup. |
| A11 · invalid emoji bases | Native and frontend validation share a sequence grammar and adversarial fixtures. Selectors cannot make arbitrary text an emoji. |
| A12 · docs parser loops | A pinned local bounds patch covers every relevant CJS/ESM bundle, with install/build/direct-CLI integrity gates and hostile-input subprocess tests. Upstream advisories remain open. |

Detailed evidence: [storage](audit-fixes-storage.md), [frontend](audit-fixes-frontend.md), [persona editing](audit-fixes-persona.md), [provider errors](audit-fixes-provider-errors.md).

## Completed generation lifecycle and authorized upgrade

The user approved the narrow data-preserving upgrade. Recognized schema 11 now upgrades transactionally to schema 12 by adding only the generation receipt table. Fresh workspaces use the same table definition. Application identity, integrity, foreign keys and every released base schema object are validated before migration; failures roll back, and other versions remain refused. Tests preserve all existing rows during the upgrade and verify repeated reopening. Normal preexisting startup reconciliation remains separate. [Migration evidence](audit-fixes-schema12.md).

Native begin/run/cancel commands enforce bounded, single-use ownership. Pause, credentials, connection revisions, destination/model and access holds are rechecked across asynchronous work and before adoption. A terminal write failure cannot return a successful proposal. Provider completions with non-stop finish reasons are rejected; reported usage remains retained for rejected/invalid proposals. Refusals populate durable holds and block new generation until explicit recovery. Cancellation and restart never replay inference.

Receipts contain identity, language, route/model, authority revision, lifecycle timestamps/state, reported token counts and safe errors. They contain no brief, credential or generated text. Pre-dispatch cancellation is cancelled and excluded from usage; interrupted dispatched work is unknown, with absent usage preserved as unknown. Known token/model metadata cannot be overwritten by duplicate late completion. Recent activity is bounded to 50 rows; numeric totals include all retained dispatched generations. Global/language usage is independent of existing conversations/personas. The AI panel shows a separate global generation receipt section with explicit loading/error/retry state. [Lifecycle evidence](audit-fixes-generation-lifecycle.md).

This is source implementation with automated verification. No actual user database was opened or reset; the update applies the upgrade on next native launch. Future coaching schema references were moved to planned version13 to avoid colliding with this implemented receipt schema; no future coaching feature was implemented as part of this change.

## Additional integration findings

- Pending Vibe input now joins the form flush contract. Keyboard dismissal and native form submission cannot silently discard a composed emoji; invalid input remains visible and explicitly discardable.
- A mounted AI activity dock/pop-out now follows native conversation selection, rejects old scope results, and resumes when an empty workspace gains a conversation. [Evidence](audit-fixes-activity-scope.md).
- Blocking credential reads retain admission until the actual OS call returns, even when its caller cancels. Repeated cancellation cannot accumulate unbounded detached keychain work. [Evidence](audit-fixes-credential-reads.md).

## Verification

Final integration passed **516 frontend tests and 257 native tests**. Strict native Clippy and formatting passed. Documentation tests (28), parser security tests (7, including 104 bounded parser subprocesses), launcher/log tests (4), stylesheet validation, tooling typechecks and generated-contract verification passed. Application and docs production builds passed; the docs build ran with integrity gates enabled. Server source was unchanged by this remediation pass; the audit's prior server/emulator results are not represented as new runs.

The docs fix is a local mitigation, not an upstream package upgrade or advisory suppression. [Parser patch evidence and maintenance](audit-fixes-docs-parser.md).

README and architecture claims have been reconciled with the source: production application identity, connected activity graph, mobile capture/Android secure storage, speech/evidence, the actual Zustand stores and user-chosen release versions. Device verification and unwired execution controls remain identified separately.

## Practical limits

Automated filesystem tests use disposable workspaces, including real separate-process locking and SQLite WAL reopening. Mock network responses exercise the provider boundary without paid inference. Native-device reset, keychain, mobile focus and playback checks are not replaced by those tests. The docs build completed despite an unrelated update-notifier config-permission warning. The existing main bundle size warning remains a performance follow-up, not a demonstrated regression fixed in this pass.
