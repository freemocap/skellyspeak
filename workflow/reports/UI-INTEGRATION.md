# Native UI connection candidate

The active candidate is in the user-created `rebuild-interaction` worktree, based on
51ec700. It has not been checkpointed or merged into rebuild. The released main app
is untouched. The user explicitly authorized copying main's UI and adapting its
connections; the copied presentation is the implementation, not an alternate UI.

## Implemented and verified

- Startup loads the actual native language registry, including direction and
  romanization metadata. Visible startup failure replaces a blank window.
- Chat reads native conversation snapshots. Explicit Send uses execute_command;
  no whole-conversation replacement saves or mount-triggered greetings remain in
  the active controller. Failed acceptance preserves a subsequently edited draft.
- Partners resolve through conversation/relationship ownership. New partner/chat
  creation and selecting an existing partner use native commands.
- Coach reads private native messages and explicit submission uses AskCoach.
- Settings use native scoped practice/display choices and separate credential
  commands. Saved secret values do not cross into ordinary preference saves.
- Recording uses conversation-bound native recording IDs. Explicit Stop requests
  transcription; waveform rate comes from the actual capture sample rate.
- Word details render an explicit unavailable state without obsolete inference on
  mount. Unsupported lesson/evidence controls do not fabricate results.

Measured on this candidate: 339 frontend tests passed; frontend build and generated
contracts passed; 79 native tests and Clippy passed. This worktree does not yet
contain the separately integrated R1/L1 foundation, so these native results must not
be represented as the 109-test combined rebuild result. Reconcile the contributions
through user-operated Git and retest before claiming combined completion.

Signed native launch succeeded using `node scripts/macos-dev.ts launch`. Native
accessibility inspection showed the copied chat screen, real saved Arabic text and
saved passage translation, and no startup fault banner. No inference was requested
by the coordinator during this smoke check. User testing of Send/translation,
coach, access settings and microphone remains required. The launcher remains attached
for logs; only one native app with this identity may run at a time.

## Remaining work

- Basic chat/translation/coach smoke and read-only attempt verification are complete; microphone and all-route coverage remain separate checks.
- Checkpoint and integrate this candidate with current rebuild; reconcile generated
  contracts and native waveform metadata, then run combined checks.
- Copied stylesheet is not yet reconciled with the strict style checker. Do not
  claim all quality gates pass. Preserve appearance while resolving the violations.
- Live annotation/detail pipeline, sentence assistance, evidence/XP, lesson editing,
  complete AI graph, partner editing, and unsupported audio/presentation preference
  persistence remain parity work. Missing capabilities are not scope removals.
- AI panel must not mount unsupported diagnostic commands during this candidate.

No commits, merges, pushes, tags or deployment were performed by agents.

## User runtime verification

Read-only durable-attempt inspection after user testing confirmed two main-chat
exchanges, each with exactly one successful partner reply and one successful
translation, plus two successful private coach requests with one inference attempt
each. No unfinished operations or new launcher errors were observed. This establishes
the selected-route basic chat/translation/coach path, not all routes or microphone QA.

## Checkpoint review

The Language pure adapter passed an independent 12-test focused run. It is ready
for a scoped checkpoint, not live gloss inference. UI CSS audit is recorded in
Interaction `workflow/reports/U1-css-audit.md`: 71 checker violations remain.
Removed two package commands pointing to nonexistent Android scripts. The navigation
test now asserts the actual unavailable graph state rather than a mocked diagnostic
panel. Next: user checkpoints, combined integration checks, then CSS cleanup and
the reviewed whole-message gloss execution seam.

## Combined verification — 2026-09-11

Integrated at rebuild `002afd4` (Language adapter and conversation UI). Measured on
this combined source: 342 frontend tests across 74 files, 121 native tests, frontend
build, generated-contract check, Rust formatting and Clippy all passed. Native local
HTTP tests required loopback permission; the sandbox-only run failed nine binds,
then all 121 passed with that permission. No live inference requests were made.
Fixed the recording metadata initializer formatting. README's current capability
summary now distinguishes working chat from unconnected graph/report/evidence UI.

Style checks still fail on the 71 audited violations; this is not an all-gates-green
checkpoint. Interaction has been assigned its finite CSS cleanup in its worktree.
Reliability is preparing exact ownership/acceptance for whole-message gloss execution.
The merged source has not received a new native runtime smoke test; the earlier user
smoke applies to the UI candidate. No Git writes or deployment were performed.

## Structured transport preparation

Integration added server conformance tests without changing production endpoints:
named strict schema forwarding with server-owned routing, malformed envelope rejection
before any grouped claim/inference, exact UTF-8 schema-inclusive request size bounds,
and per-item finish/content/usage preservation. Focused contracts/grouped tests: 35
passed. Full server fixture suite: 209 passed, 7 Firestore-emulator tests skipped
because the emulator was not running. No live provider calls or deployment.

Reliability G1a is now a transport-only implementation assignment; Language reviews
schema/size compatibility. Production gloss declaration, durable publication and UI
rendering are not enabled by this work. Coordination documentation now records the
current owners and removes stale pending-integration instructions.

## Native inspection follow-through

The running Interaction native app exposed a Speech error from unsupported
get_conversation_partner after Speak reply. Integration removed the active read-aloud
button/shortcut wiring from GuidedPage, removed voice probing and dead speed-save
handlers, and made TurnView's playback action explicitly optional. Disabled voice
speed now explains that read-aloud is unconnected. This is an availability correction,
not a TTS implementation. Added a button-boundary regression. Root frontend checks:
343 tests passed; build passed. The running Interaction app has not yet received this
root source fix; restart from the combined source after user integration.

CSS source review and independent Interaction styles/build checks passed. Its handoff
records 342 frontend tests and broad static browser comparisons, with explicit native,
hover and device limits. No second native app was launched. The pure completion
validator was independently tested in Language: 15 focused adapter tests passed.
CSS and the validator remain domain working-tree contributions awaiting user Git steps.

## Round handoff

Reliability G1a source review accepted; independent full suite93passed. Full request
preflight is before HTTP, not yet before durable attempt creation. Mixed structured/
prose grouped results retain independent delivery and raw candidate strings/usage.
Language G1b and Interaction CSS are accepted as bounded contributions. Domain source
is frozen for user checkpoints. Root343frontend tests/build and server209tests pass
(7emulator skips). Combined integration/retest and a fresh native launch remain next.
