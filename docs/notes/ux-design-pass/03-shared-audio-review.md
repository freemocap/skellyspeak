# Chat and Practice audio review

Follow-up: [implemented shared media and reading controls](05-shared-media-and-reading-controls.md) supersedes the pending-work status below; this note preserves the earlier review.

2026-09-28. Implemented source changes and verification; not a release or a
running-native-app verification. Supersedes the reply-audio deferral (A15),
transcript-containment matching and pending duplicate-file deletions in 02-chat.md.

Follow-up: [04-media-model-audit.md](04-media-model-audit.md) identifies repeated
analysis in both surfaces and a second-read failure when generated audio is only
in the one-time delivery buffer. The verification below does not establish shared
media lifetime or caching correctness; the branch is not ready on those criteria.

## Findings and changes

- The disabled reply inspector was a wiring gap. Practice already used native
  `inspect_wav` and `attach_words`; Chat already received the generated WAV and
  optional speech alignment. No second synthesis or transcription pipeline was
  needed. The new command reads the retained speech operation, validates the
  session and attempt identity, releases the store lock, and calls those same
  analysis functions on a worker. Unavailable speech retains its diagnostic data.
- Reply bubbles now use `CompactInspection`, `RecordingTrack`, `PlaybackProgress`,
  `PlaybackCursor`, `TimedWords`, `Spectrogram` and `useAudibleScrub`, as Practice
  does. Their expanded view reuses `TranscriptionInspector` and the bubble's
  playback clock. No new stylesheet, spectral algorithm or audio player was added.
- Inspection is optional and starts closed. Opening it before audio has been read
  starts the existing explicit speech action. Once audio is present, inspection
  is local only. The bubble keeps one Play control. Playback, seeking and scrubbing
  still use the shared platform playback exclusion and speech-follow machinery.
- Chat retains only its most recently loaded reply audio in UI memory. Switching
  replies releases that reference; an older open inspector reports audio unavailable
  until Play loads its source again. Native audio retention remains unchanged.
  This is not a new unbounded UI audio cache.
- Removed the seven obsolete Practice copies of cursor/progress/scrub implementations,
  their duplicate tests and WordOverlay after verifying runtime callers use shared
  owners. The shared tests remain.
- Shared recording playback now applies speed and volume changes during playback.
- Learner recordings are attached using the accepted turn receipt and recording ID,
  rather than transcript equality or containment. Repeated text cannot move a
  recording to a later message. This remains session-only, latest-recording behavior.
- Regenerated the two stale icon assets and native command contracts.

## Verification

- Full UI suite: 217 files, 1,415 tests passed.
- Native audio inspection: nine tests passed, including frequency grids, timing,
  bounded audio and fixture equivalence. Rust library check passed.
- Production build, preview type check, style validation and design-system
  freshness check passed. The build still reports the existing large bundle warning;
  DOM tests report their existing missing canvas implementation notices.
- After the final IPC adapter extraction, all 25 speech/command-registration
  regression tests and the Rust library check passed again.
- Browser fixture inspected at desktop size and 390 × 844, including the reply
  bubble spectrogram and expanded dialog. The fixture uses sample analysis and
  intentionally has no audio generation or microphone access.
- No commit, push, pull request, merge, deployment or workspace-data reset.

## Remaining checks and scope

Rebuild the native application before checking the new command. Play a real reply,
open its inspector, seek/scrub, expand it, change speed, switch to Practice and back,
and confirm microphone capture excludes playback. Source and fixture verification
do not establish device playback behavior.

Optional retranscription of learner audio was discussed but not implemented.
Chat already transcribes captured speech; obtaining or retrying missing word timing
should reuse the existing transcription owner and receipt, with an explicit action
and visible cost/failure behavior. Never treat synthesized text as a transcript of
a learner's recording.

The independent anatomy demonstration changes were preserved, not reviewed here.
This pass concentrated on shared audio, message tools, ownership, styles and their
regressions; it is not an exhaustive approval of every earlier branch change.
