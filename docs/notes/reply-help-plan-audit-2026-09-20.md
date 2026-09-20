# Reply help plan audit — September 20, 2026

Follow-up: the [integrated implementation plan](reply-help-implementation-plan-2026-09-20.md)
addresses these findings. This audit describes the earlier inspected snapshot;
the follow-up is a plan, not evidence that the implementation issues are fixed.

Status: assessment of the pasted three-layer redesign proposal and the current
working tree. This is not implementation approval or a completed feature report.
The tree contains extensive concurrent reading, conversation UI, native execution,
and server changes. Findings describe the inspected snapshot, not attribution of
every change to one agent. No application source was changed for this audit.

## Assessment

The product direction is coherent: make the brief prominent, disclose grammar and
reply assistance independently, and keep word help attached to words. Separating
presentation from scheduler changes is useful. The proposal correctly identifies
that reply assistance and explanations currently run automatically.

It is not yet a safe implementation specification. Its most consequential mistake
is treating two differently produced reply fields as interchangeable. Request
lifecycle, empty results, failure handling, and the new brief executor also need
explicit treatment. The existing implementation is an incomplete presentation
attempt; genuine on-demand assistance has not been implemented.

## Observed completion

| Area | Current evidence | Assessment |
| --- | --- | --- |
| Phase 0 restoration | ComposerHelp files remain deleted; ReplyHelp is untracked; stale imports and type errors remain | Restoration gate not satisfied in this snapshot |
| Phase 1 component, CSS, locales | Three-layer JSX, stylesheet, ten tests, seven locale updates, and page wiring exist | Substantial draft, not integrated or verified |
| Phase 1 previews and documentation | Reading preview/test still import ComposerHelp; conversation preview supplies only replies, which the component's early return hides; no ReplyHelp design-system entry | Incomplete |
| Phase 1 acceptance | Build and preview type checks fail; focused tests fail | Not ready for acceptance |
| Phase 2 native execution | Both operation kinds remain in PLAN and OPENING_PLAN; no reply_brief or RequestExplanations implementation found | Not implemented |
| Related assistance prompt correction | Field-specific v6 assistance prompt exists, with a separate investigation note | Separate work; does not implement this redesign |
| Queue tracking | Conversation UI cleanup note has tasks 1–7, without proposed task 8 | Not integrated into that queue |

## Findings requiring correction

### 1. The proposed reply-field switch loses the active generator's replies

`native/src/learning/coaching/conversation_support.rs` generates and publishes
`reply_assistance`, including `replies` of type AssistedReply. Its publisher writes
only that named context field. In contrast, `execution/snapshots.rs:118` reads
`coachReplies` for `suggestedReplies`; `learning/coaching/mod.rs:465` writes that
field for the separate coach_suggestions operation. That operation is retained,
not scheduled in the current automatic plans.

`ui/src/domain/conversation/conversation-view.ts:33` maps suggestedReplies to
scaffolds.replies. The new page uses only scaffolds.replies and drops
assistance.replies. A fresh ordinary turn therefore loses its two full reply
choices; frames and starters can still appear. Pressing Suggest a reply requests
reply_assistance again, which cannot populate the field the panel reads.

This is not merely optional contract cleanup. Preserve the active producer's
replies in Phase 1. Before Phase 2, decide and implement the actual producer-to-view
mapping, preserving available reading information without inventing gloss anchors.

### 2. Request acceptance is not generation completion

`useRequest` in ReplyHelp.tsx:108 tracks only the callback promise. The production
callback calls execute_command, which returns a command receipt while scheduling
continues separately. Its spinner can stop before content exists. Reopening then
calls the action again because there is no requested latch. Native operation reuse
currently prevents this from necessarily creating duplicate inference, but it
does not satisfy the promised UI lifecycle or at-most-once callback contract.

Use durable per-operation state for not requested, queued/running/held, succeeded
with content, succeeded empty, failed, and cancelled. Keep disclosure state local.
Define deliberate retry separately from opening a panel, preserving the existing
no-automatic-retry policy. Test command completion before snapshot delivery,
reopening while generation is pending, remounts, errors, and turn changes.

### 3. Pending, empty, and failure states are wired incorrectly

ConversationPage.tsx:503 derives briefPending from explanationsState even though
the brief comes from reply_assistance. It can stop indicating work too early or
show continued work after assistance has failed. Grammar errors are not passed to
ReplyHelp; only suggestions errors are. Converting empty mechanics to undefined
discards a legitimate successful result: the grammar schema allows zero cards.
The resulting empty disclosure cannot show the intended “Nothing to flag” state.

The tray's useState initializer does not react when a brief arrives after its
first render. The page key changes per turn, but can remain unchanged while that
turn progresses from no assistant to a published reply and then assistance. Define
arrival behavior without overriding a learner's deliberate collapse.

### 4. The presentation implementation currently breaks integration

- ReplyHelp passes a third initial-state argument to a two-argument useRequest;
  opened is therefore ignored at runtime and rejected by TypeScript.
- Page mechanics have optional quote fields and cannot be passed as generated
  ReplyExplanation[] without an appropriate typed projection.
- ConversationReadingProvider.test.tsx and reading-preview.tsx still import the
  deleted ComposerHelp module.
- The component returns null for replies-only data, hiding its existing
  conversation preview instance.
- Starters nest interactive TargetText inside an insertion button. The shared
  reading system makes words independently interactive; this needs separate
  insertion and word-help targets, consistent with the current UI README.

The tests cover useful basic interactions but miss these production data and
lifecycle cases. The existing once-only test supplies results immediately after
the click, bypassing the important command-receipt/snapshot delay.

### 5. Phase 2 omits parts of the new operation's execution path

Adding a declaration and a prompt is insufficient. conversation_support::owns,
schema selection, validation, publication, exported result types, snapshot fields,
UI projection, diagnostics, and relevant accounting/admission classifications all
need review for reply_brief. dispatch.rs rejects operations without an executor.
The partner-publication SQL also needs to release reply_brief from its dependency
wait, not merely remove the other two kinds as the proposal specifies.

Removing absent operations from the release SQL alone is not what creates
on-demand behavior: that UPDATE cannot create operations. Their creation in the
automatic plans is the primary issue. Conversely, a newly declared brief left out
of the release SQL can wait forever.

Test opening and normal turns; no unrequested assistance operations; exactly one
operation per explicit request; completed empty grammar; cancellation, replacement,
archive, failures and explicit retries; metadata preservation; and downstream
Analysis behavior when explanations no longer arrive automatically.

### 6. Some plan claims are stronger than the evidence

Fewer automatic operations is supportable; “cheap” is not established merely by
a shorter output schema on the standard role. Specify input/output limits and
measure usage before claiming cost savings of a particular size. “Only reply_brief
ran” should mean only among these three assistance operations: translation,
glosses, speech and other configured work can still run.

The source comments already claim the requests are never precomputed and an
unopened tray costs no tokens. Both claims are false for the current backend; an
automatic brief would also still cost inference after Phase 2.

The proposed Phase 0 rollback cannot safely assume HEAD contains the pre-agent
versions in a shared dirty tree. An audit cannot prove earlier cleanliness from
today's diff. Coordinate a narrow repair or restore from a known pre-edit snapshot;
do not blindly execute the pasted rollback instructions.

## Verification performed

- `npm run build`: failed during TypeScript checking with the mechanics type
  mismatch, two hook-arity errors, and deleted ComposerHelp test import.
- Focused ReplyHelp and ConversationReadingProvider tests: nine tests passed,
  one failed, and the reading-provider suite could not load. The grammar test's
  text matcher fails across reading-renderer elements; this alone is not evidence
  that the grammar text is absent from the DOM.
- `npm run previews:check`: failed on hook arity and the deleted preview import.
- `npm run styles:check`: passed.
- `npm run design-system:check`: passed for registered components. ReplyHelp is
  not registered, so this does not verify its promised design-system preview.
- Build precheck: seven locales and 1,085 messages per locale passed validation.
- `git diff --check`: passed at inspection time.

No full UI suite, native suite, live inference, browser visual review, or native
application launch was performed. Existing compilation failures and targeted
evidence are sufficient to reject a completion claim. No commits or deployment.

## Recommended completion sequence

1. Coordinate ownership and restore a compiling UI through narrow changes.
   Preserve concurrent reading work and the separate v6 prompt correction.
2. Complete Phase 1 against the active reply data: typed cards, correct pending
   and error states, empty grammar, independent word/insertion targets, working
   previews and production-shaped fixtures. Review the actual visual artifact.
3. Amend Phase 2 around explicit durable request states and a complete brief
   operation path. Resolve reply data ownership before implementing it.
4. Implement and verify on-demand scheduling, then inspect actual operation
   records after opening a turn and pressing each action. Report automated,
   browser-fixture, and native/runtime evidence separately.

There is useful presentation code to retain. Neither phase is complete, and the
core on-demand behavior remains to be built.
