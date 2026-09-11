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
