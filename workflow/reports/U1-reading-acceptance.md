# U1 — reading assistance acceptance proposal

Design/review only. No implementation, new UI, model calls, runtime changes or tests run in this pass. Existing reference styling and compact in-place error/retry presentation remain the baseline. Language/AI owns meaning quality and configuration/prompt proposals; Reliability owns operation retry/accounting guarantees.

## Smallest acceptance checklist

1. **Exact source and occurrence.** Use one saved reply containing repeated words, punctuation, whitespace/newline, an accented grapheme, emoji and RTL text. With glosses closed, the displayed source must match exactly. Tap/Enter/Space reveals only the selected saved occurrence; literal/unresolved text stays passive. A phrase annotation must preserve its original span. No extra spacing or reordered punctuation introduced by annotation wrappers.
2. **Independent arrival and absence.** Reply text is readable immediately; translation, saved word meanings and speech can arrive independently. Partial meanings keep covered words useful and uncovered words readable. Absence, in-progress and failure must not imply a completed result or a permanently running operation. Translation visibility preference and per-message Translate operate on saved data only.
3. **Explicit retry, retained context.** On a partial/failed gloss, keep the same message visible while Retry word meanings is pending. One deliberate activation admits at most one operation request; repeated activation during admission does not duplicate it. Reject/cancel/unknown outcome must retain source and saved partial result and expose the real state. Reveal, collapse, reopen, preference changes and error dismissal admit zero work. Native receipts/attempts, not a spinner, establish the request count. Reliability supplies the lifecycle matrix and retry accounting evidence.
4. **Voice-first coexistence.** New eligible replies may play their already-created speech operation once; opening history stays silent. Reading a gloss or translation never generates speech. Explicit replay targets the selected native message; Stop/mic/navigation/new turn cancels pending speech or stops audio and suppresses late output. Readability and saved assistance remain usable after speech failure. Actual microphone/output QA is separate from mocked lifecycle tests.
5. **Existing visual and input conventions.** Inspect the same saved content at desktop and narrow width, reading scale 100%/150%, keyboard focus and RTL. Inline word meanings use existing w/wu/wg rules; translation and retry/error controls use their existing classes. No horizontal page overflow or clipped composer; error details remain dismissible. No new pane, explanatory paragraph or behavior toggle is part of this acceptance pass.
6. **Meaning quality, separately.** Language/AI reviews gloss meaning in context, phrase grouping, repeated-word distinctions and explanation-language consistency on the same saved examples. Structural Complete means the decoder covered the source according to its schema; it does not establish correct/useful meanings. Record semantic failures independently from UI/source anchoring failures.

## Existing evidence and demonstrated gap

Source reviewed: SavedGlossText.tsx/test; GlossAssistance.tsx; relevant TurnView.tsx/tests; conversation-view.ts; useMessageSpeech.ts; native snapshot translation/gloss mapping in execution.rs. Existing tests (inspected, not rerun here) cover exact UTF-16 occurrence anchors, punctuation/whitespace/graphemes, passive unresolved/literal spans, Space reveal, zero native requests on reveal/remount, explicit partial retry locking with retained visible gloss, and independent saved translation toggles. Prior voice handoff records lifecycle tests; this pass does not repeat or broaden their claim.

**U1-READ-001 — translation state is discarded.** Native ChatMessage includes translationState and execution.rs populates it from reply_translation operation state. conversation-view.ts projects only translation text into GuidedTurnResult; TurnView renders translation/button only when text exists. Thus a translation failure without text is indistinguishable in this reading surface from disabled/not-requested translation, and in-progress translation cannot be assessed here. This is a source-demonstrated presentation gap, not a claim about failure in the latest live examples. Smallest next decision: retain authoritative state in the projection and reuse the agreed compact status/error treatment after Integration/Language confirms failure metadata; do not invent error causes or a new retry action/contract.

No additional demonstrated styling defect established in this source-only pass. Real desktop/narrow reading screenshots and meaning review remain acceptance work, not completed findings.

## Runtime evidence boundary

Integration reports the latest three saved glosses as Complete, with one additional request on the second turn. That report is not independently reclassified here as semantic success. This pass did not inspect private learner message bodies or query durable learner records.

Read/inventoried every existing shared run under the absolute root .local/logs path before filtering: two app runs (14:50:36 and14:54:32 UTC), two server runs (14:50:32 and14:54:28 UTC) and the emulator/process run (14:50:13 UTC), all dated2026-09-11. Across these, all29 JSON/JSONL files were read and parsed (including five manifests and all empty streams); no malformed records in that observed snapshot. Normal and error streams were included. No private log content copied here. This inventory establishes capture availability, not a correlation of the reported three gloss results or proof of meaning quality. Files are live; later appended records and cloud logs are outside this pass. Current redacted frontend events cannot establish arbitrary provider-error text; use native durable records with Integration for exact retry/result correlation.

## Ownership/next step

Integration merges Language/AI semantic/configuration proposal and Reliability retry-gap report with this six-point checklist. U1 owns only a bounded presentation correction if assigned. No new controls or style system are proposed; defaults-only requests remain defaults-only. Any material departure from reference interaction requires a concrete user decision before implementation.

## U1-READ-001 implementation handoff

Integration authorized the bounded correction after the proposal. Implemented optional translationState in GuidedTurnResult and copied the native value unchanged in conversation-view. TurnView uses existing ActivityIndicator for ready/running/waiting_dependencies (Translating…), and existing trans styling for failed/unknown/cancelled/invalidated short state labels. Null/not-requested and succeeded add no status. No error cause invented, retry action/IPC/control or CSS added. Saved translation and its existing visibility control remain independent; gloss and speech behavior unchanged.

33 focused projection/render tests pass and build passes. New tests cover exact state projection without source mutation, saved translation retained across every pending/terminal state, no work from render/preference/translation toggling, no-request vs failure, and pending clearing on successful arrival. Existing reading/gloss/replay tests pass in the same run. No native/provider calls or app restart performed by U1. Source frozen for Code Quality/Integration review; real native presentation and semantic quality claims remain separate.

Owned files: src/lib/conversation-view.ts/test, src/components/chat/TurnView.tsx/test, optional frontend projection field in src/types.ts. No native contract or root stylesheet edits.

Final combined frontend verification: 80 files / 396 tests passed.
