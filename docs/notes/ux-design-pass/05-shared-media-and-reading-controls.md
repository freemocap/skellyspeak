# Shared media and reading controls

Status: implemented and automatically verified, 2026-09-28. This follows
[the media audit](04-media-model-audit.md). Native device playback still needs a
manual check before merge; the browser review used a local fixture.

## Implemented media ownership

Captured and generated WAV audio now use the same content digest and signal
analysis path. Waveform, spectrogram and activity belong to the audio signal;
transcription, word alignment, request provenance and owner authorization remain
separate. Each inspection composes the shared signal with the current evidence.
Identical audio does not make two transcription receipts equivalent.

The workspace analysis gate deduplicates concurrent computation. Retained signal
results persist with an algorithm revision and references to existing recording
or inference owners. Deleting one owner preserves data referenced by another;
deleting the last owner releases it. Derived data counts against the associated
retention budgets. Disabled retention uses bounded live memory only. Failures are
not cached, and stale analysis revisions are discarded. Recalculation remains
possible after eviction, workspace closure without retention, or revision change.

This does not introduce another audio-byte repository. Generated response blobs
and retained recording WAV files keep their existing storage policies. Their
shared content identity and derived analysis bridge those owners without copying
audio. No storage reset or format migration was performed.

Chat inspection uses the audio already delivered to its player, validated against
the successful attempt and a stored payload digest. It no longer consumes the
one-time delivery buffer a second time. Both Chat and Practice use a common UI
inspection resource that deduplicates pending work, retains completed results,
retries failures and clears with workspace changes. Practice deletion invalidates
its hydrated resources. Signal cache results never carry another owner's timing.

## Implemented interface behavior

- Chat generated speech uses the shared compact spectrogram and expanded inspector.
- Inspectors appear above their controls and remain mounted while closed. The
  clicked control is anchored during expansion; stable scrollbar space prevents
  a horizontal jump. Reopening a retained result has no loading placeholder.
- Grammar and Conversation fit retain labels and numbers without bubble score
  dots. Detailed feedback meters remain in the feedback dialog.
- Coaching original/corrected passages, analysis sentences and partner excerpts
  use TargetPassage/TargetMessage and shared reading actions. Learner quotes keep
  their speaker styling. Inline phrases remain inline and expose the existing
  reading-help dialog rather than nesting full bubbles in tables or sentences.
- Optional reading tools use measured container and control widths. Tools that
  fit appear inline; only the remainder goes into More. Shared toolbar styles
  belong to the existing reading component sheet and use existing design tokens.

Optional user-triggered retranscription and durable storage of every Chat learner
recording were not added. Current recording ownership and inference receipts stay
intact; these remain separate product decisions from sharing signal analysis.
The existing audio-inspection source remains a cohesive algorithm and its tests;
its size was not addressed through unrelated file splitting.

## Verification

- Full UI suite: 1,419 tests passed. Final focused controls, coaching, analysis,
  speech inspection and resource-cache checks: 28 passed.
- Full native suite: 680 passed, four ignored. Final audio-focused checks after
  schema cleanup: 53 passed.
- Production build, generated contracts, preview typing, diagnostics, stylesheet
  ownership and generated design-system checks passed.
- Browser fixture reviewed at desktop and narrow widths: shared correction
  controls, inline/overflow behavior, no horizontal document overflow, and repeat
  inspector toggles without loading. Inspect control x remained 101px and y
  differed by only 0.5px across toggles after stabilizing scrollbar space.

These checks do not claim real microphone/device playback verification. Before
merge, exercise native Chat generated speech and Practice recording inspection,
including reopening after restart with retained audio. No commit, push, pull
request, merge or deployment was performed. Unrelated working-tree changes were
preserved.
