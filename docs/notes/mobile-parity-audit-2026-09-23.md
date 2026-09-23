# Mobile parity and duplication audit — 2026-09-23

Status: source review, with selected existing regression tests. This is a focused
inventory, not a complete clone detector or device certification. Mobile Drill
implementation was paused at the user's request to perform this audit. Its partial
UI edits remain uncommitted; native capture has not been changed.

## Scope

Reviewed active `ui/src`, native platform conditionals, recording and playback
pipelines, application navigation, responsive feature composition, settings,
hosted sign-in, updates, diagnostic export, and authored Android diagnostic code.
Excluded archived `old/`, generated contracts and vendored implementations.
Compared viewport branches with actual platform-capability branches. Existing
uncommitted changes from other work were preserved.

## Findings requiring cleanup

### 1. Continuous recording is coupled to desktop capture (high)

`native/src/speech/recording/continuous.rs:109` refuses mobile outright; start and
the entire listening/segmentation coordinator are desktop-gated. The UI offers
Auto on every platform (`features/drill/RecordDock.tsx:15`). Browser capture only
delivers a finished WAV (`platform/audio/browser-recording.ts`), and
`useMicRecorder.ts:77` skips native polling whenever a browser recorder exists.

This is a confirmed capability gap, not a duplicate Drill implementation.
Manual mobile and desktop recordings do converge on the same Rust transcription,
inspection and publication path in `voice.rs`. Chat and Drill also share
`useMicRecorder`; there are not two independent feature recorders.

Cleanup: keep platform microphone acquisition behind adapters, feed both into one
bounded native segmentation/session pipeline, and test both adapters against that
pipeline. Removing the mobile refusal alone would not implement this correctly.
WAV encoding and duration policy also exist in both browser and native capture;
consolidate what becomes unnecessary with streaming rather than adding a third path.

### 2. Diagnostic archive policy is implemented twice and has drifted (medium)

`native/src/diagnostics/archive.rs` and Android's
`native/gen/android/app/src/main/java/com/freemocap/skellyspeak/DiagnosticArchive.kt`
both select log files and copy snapshots into ZIPs. Rust accepts run folders with
`native-`, `app-`, or `process-` prefixes; Kotlin only accepts
`native-[0-9]+-[0-9]+`. Their manifest assembly is separate too.

The differing rules are confirmed. This review does not claim that a current
Android installation actually loses a particular log: platform log-root contents
were not sampled. Android-specific device/graphics metadata and share/document
pickers are legitimate adapters; shared file inclusion and archive policy need
one owner. Preserve Android metadata and privacy protections when consolidating.

### 3. Responsive presentation changes recording behavior (medium)

`features/activity/AiViewPanel.tsx:82` uses `DetailDialog` only below 860 px.
`components/dialogs/DetailDialog.tsx:13` unconditionally calls `suspendCapture()`.
The wide docked panel does not. `useMicRecorder.ts:173` responds by cancelling a
continuous run (manual capture deliberately ignores this callback).

Consequently, the code makes opening AI activity during Auto recording cancel
capture in a narrow desktop window while leaving it running in a wide one. This
is a source-confirmed call path; no live microphone reproduction was performed.
The activity content itself is shared. The defect is recording policy hidden in
a presentation wrapper, not duplication of the activity feature.

Cleanup: make capture interruption an explicit navigation/action policy. Dialog
geometry must not choose that policy. Add a regression comparing both widths.

### 4. Unreachable iOS microphone remnants (low)

`recording/mod.rs` compiles `audio.rs` only on desktop, and Cargo declares cpal
only for non-Android/non-iOS targets. Nevertheless `audio.rs:153` and `:270`
contain iOS-only calls to `ios_session::prepare/teardown`; no definition was
found in active source. They cannot execute under the current build gates.

Cleanup: remove or deliberately replace these obsolete branches after reviewing
the capture boundary; do not read them as implemented native iOS support.

## Additional consolidation candidate in the interrupted work

My new, uncommitted `DrillLayout.tsx` reuses all feature components, but its
`DrillSheet` repeats native-dialog opening/backdrop handling already found in
`DetailDialog` and `SettingsDialog`. It avoids DetailDialog's capture suspension
so a report can remain open while listening. Before completing this work, extract
shared modal mechanics with explicit capture policy instead of keeping another
feature-owned copy. Settings' shortcut-capture exception must survive.

## Shared implementations confirmed

- Conversation: one page, one composer value and shared help/coach components;
  mobile relocates them and switches visible surfaces.
- Settings: one row definition and settings writer; narrow layout changes grouping.
- Skills: one SkillsPage, shared evidence and learner state.
- AI activity: same AiView, different host containers.
- Reading help and speech playback: shared components/player and playback authority.
- Hosted sign-in: different callback delivery (desktop loopback vs mobile deep
  link) shares proof creation, exchange and validation helpers. No duplicate
  account model identified.
- Updates, credential storage and file destinations have platform adapters with
  platform-specific duties. Their existence alone is not a cleanup finding.

`useIsMobile` means viewport width, not operating system. Reviewed feature uses
mostly select presentation. New hardware capability checks must not use it.

## Verification and limits

- UI TypeScript compilation passed after the partial Drill layout edits, before
  this audit. That does not verify mobile behavior or visual quality.
- Existing focused audio, lifecycle, dialog and navigation tests were run; see
  result below. No live device or provider requests were made during the audit.
- No implementation cleanup was performed during the audit, and no commit,
  deployment, data reset or native app restart was made.
- This review found specific shared-owner problems, not evidence of a second
  mobile application or wholesale duplicate business logic. Broader duplication
  across unrelated domains would require a separate, more extensive review.

Focused regression result: **31 tests passed across 5 files** (`useMicRecorder`,
`browser-recording`, `playback-lifecycle`, `DetailDialog`, `App.navigation`). These
existing tests do not cover the narrow/wide AI activity interruption difference
or prove mobile continuous recording works. The first command used root-prefixed
filters and found no files; rerunning with UI-workspace-relative filters produced
the result above.


## Follow-up implementation

The mobile Drill implementation resumed after this audit. See the implementation
record in [the mobile plan](drill-mobile-plan-2026-09-23.md): the continuous-capture
parity gap, AI activity capture-policy difference, dead iOS capture branches and
new Drill/DetailDialog mechanics duplication were addressed. Diagnostic archive
consolidation remains outstanding. The original findings above describe the
pre-fix source state.
