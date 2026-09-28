# Stage 2 — Chat: message bubbles, audio inspector, coach edge

Status: **reviewed with Jon and implemented, 2026-09-28, uncommitted; see
[Implemented](#implemented).** Part of the [UX design pass](README.md). Addresses C1 and C4;
C2, C3 and C5–C8 remain open for a later round of this stage.

- Proposal: the Design canvas “SkellySpeak · Chat bubbles (Stage 2)”, built on the
  SkellySpeak design system. Rows 1–3 are today against the proposal; rows 4–6 are
  the second iteration (Narrow tier, inspector states, coach open in dark).
- Current: `messages/TurnView.tsx`, `components/reading/TargetMessage.tsx`,
  `PhraseActions.tsx`, `TokenAudio.tsx`, `coaching/MessageFeedback.tsx`.
- Sample content: Spanish, partner Lucía.

## Build rule: reuse existing architecture

This stage changes how Chat looks and where its controls sit. It does not change
what the app does, and it does not build a second version of anything that exists.

- **Every control in the proposal already exists.** The work moves, merges and
  restyles today's controls. Nothing new is invented on the interface side.
- **The audio inspector is Practice's inspector, mounted inside a bubble.** No new
  audio drawing, analysis, playback or storage code. The parts:

  | Need | Existing part |
  | --- | --- |
  | Spectrogram | `Spectrogram`, `SpectrogramFrequencyScale`, `sharedScale` (`components/media/Spectrogram.tsx`) |
  | Tracks and durations | `InspectionTracks.tsx`: `ActivityTrack`, `SegmentMarkers`, `WordTimingNote`, `useSeconds` |
  | Words, play cursor, time axis, time scale, stored waveform | The single merged parts from “Duplication to remove first” |
  | Playback and scrubbing | `createScrubPlayer` (`platform/audio/scrub-player.ts`) for every recording; `speech-player.ts` only where it already produces the partner's speech |
  | Analysis data | `AudioInspection` from native, as Practice reads it (`useAttemptAudio`, `inspectDrillAudio`) |
  | “Removed” wording | `AttemptInspection`'s existing strings |
  | Errors | `ErrorNotice` |

- **Shared chrome.** Icons come from `ToolbarIcon` (add `waveform` and `edit` in its
  stroke style). The ⋯ menu uses the existing popover pattern
  (`popover-support.ts`, `styles/components/popovers.css`). Widths use the existing
  tiers (`useWidthTier`: Narrow is 400px and below); no new breakpoint.
- **Where the native side cannot do something yet,** the control is built as
  intended and disabled with “Coming soon”, with a `BACKEND:` comment at the control
  and a Deferred item (the 2026-09-28 rule). Never a parallel implementation.
- **No duplication, including duplication that exists today.** Chat and Practice use
  the same machinery for the same task. Where they do the same task with different
  code now, this stage merges them onto one implementation **before** adding the
  bubble inspector. Leaving a duplicate in place is not an option.

## Duplication to remove first

Checked against the source on 2026-09-28. The native data is already shared: Chat's
`TranscriptionInspectionResult.inspection` and Practice's `inspect_drill_audio`
both return the same `AudioInspection`, with `RecordingOwner` covering a
conversation or a card. The duplication is in the interface.

Chat's Recording inspection dialog (`speech/TranscriptionInspector.tsx`) and
Practice's comparison (`drill/DrillComparison.tsx`) do these tasks separately:

| Task | Chat dialog today | Practice today | One implementation |
| --- | --- | --- | --- |
| Playback clock, play, pause, seek | Its own `HTMLAudioElement` with a frame loop | `createScrubPlayer` (`platform/audio/scrub-player.ts`) | `createScrubPlayer` |
| Play cursor and scrubbing | Its own playhead `div` and range input | `PlaybackCursor` | `PlaybackCursor`, moved to `components/media/` |
| Words on the time axis | `TimedWordTrack` | `WordOverlay` | One component with both abilities (select a word and its detail; match outcomes and time mapping), in `components/media/` |
| Time axis ticks | Its own axis | `tickStep` in `DrillComparison` | One axis component in `components/media/` |
| Time scale | Zoom slider, Fit, Follow playback | Fit, Same scale, Align words | One scale control; each surface offers the modes that apply to it |
| Stored waveform | An SVG path drawn inside the dialog | None | Moved to `components/media/` as the one stored-waveform track |

After the merge, three surfaces are built from the same parts and differ only in
size and which parts they show:

1. **Practice's comparison:** reference and attempt, as today.
2. **The Recording inspection dialog:** one recording, every track, as today.
3. **The bubble inspector:** one recording, compact (spectrogram, waveform,
   words, cursor).

Every behaviour of the dialog and of Practice's comparison is kept (see “What does
not change”). A test per surface checks that it still mounts the shared parts, so a
private copy cannot come back unnoticed.

**Storage naming.** `DrillStorage` and `DrillStorageView` become the app's one
recording store (A16), so the interface component is renamed for what it is, a
recording store, and moves out of `features/drill/`. Native command names stay until
A16 changes them.

## Findings addressed

- **C1 Bubble chrome equals content.** Two rows of controls on the learner's bubble
  (a boxed cluster, then a footer), a corner speak button and a footer on the
  partner's, two different Play buttons, and emoji as icons.
- **C4 Scores on every learner bubble, with emoji** (`✍️ 10/10 🗣️ 6/10 ↗`).

## Proposal

### 2a One tools row on both speakers (canvas row 1, chosen board)

- **One row inside the bubble, same order for both speakers:** Play, Inspect audio
  (a waveform icon, not the microphone), a divider, then Translate, Word by word and
  Analysis as quiet text, then ⋯ at the end.
- **⋯ holds the rest:** Edit message (learner only), Add to Practice, Pronunciation.
- **One Play button.** Both speakers use the same look; each keeps its current
  speech action (the partner's speak toggle, the learner's read-aloud through
  `ReadingContext`). The 🔊 corner button and the boxed cluster go.
- **Tools always shown** (decided; the hover-or-tap variant was not chosen).
- **The partner's avatar sits beside the bubble,** at its bottom edge, not on its
  corner.
- **Narrow tier (400px and below):** Word by word and Analysis move into ⋯; the row
  keeps Play, Inspect, Translate and ⋯. Controls are 44px there.

### 2b Feedback line under the learner's bubble

- The scores chip and the XP button become one quiet line under the bubble:
  “Grammar 10/10 · Conversation fit 6/10 · +12 XP ›”. It is today's feedback button
  and `MessageXpButton`, with words in place of emoji; it opens the same feedback
  dialog. States (pending, failed, unavailable) keep today's wording.

### 2c Audio inspector inside the bubble (canvas rows 2 and 5)

- The waveform button opens the inspector **inside the bubble, under the words**,
  for both speakers (decided; the strip under the chat header was not chosen).
- It shows the spectrogram with its waveform, the words aligned under it, a play
  cursor, the time, speed and an expand button. The inspected bubble is outlined,
  and the word under the cursor is highlighted in the message text.
- **Open and close (decided 2026-09-28):**
  - The waveform button is a toggle: pressed while the inspector is open. It is the
    only way to open or close it.
  - By default only the **latest message with audio** is open; every earlier one is
    closed. When a newer message with audio arrives, the one that opened by default
    closes.
  - An inspector you opened yourself stays open until you close it.
  - Lucía's reply opens by default only once it has been spoken (by auto-speak or
    Play). Opening an inspector never asks for speech by itself.
  - Open or closed is screen state only; nothing is saved.
- **Expand (⤢)** opens today's **Recording inspection** dialog
  (`speech/TranscriptionInspector.tsx`) unchanged: waveform, spectrogram, activity,
  timed words, zoom, follow playback, word timing overlays and diagnostics. Nothing
  new is built; the dialog is where the full analysis already lives.
- **Availability today and later:**

  | Message | Today | After the Deferred items |
  | --- | --- | --- |
  | Your latest recording | Works: today's in-memory recording inspection moves into the bubble | Same |
  | Lucía's reply | “Coming soon” (A15) | Works once the reply has been spoken |
  | Your older recordings | “Coming soon” (A16) | Works while kept; “Removed · freed by the storage limit” after |

- States drawn on the canvas: preparing, analysis failed with Retry
  (`ErrorNotice`), Coming soon, Removed.

### 2d Coach edge: a full-height rail (canvas rows 3 and 6)

- The folded coach tab becomes a rail down the whole edge of the conversation:
  a neutral surface, a 3px coach-green edge facing the chat, the soft green glow, the
  coach icon, “Coach” and the count of new notes. The whole rail is one button.
- Open, it is today's coach panel, unchanged inside, including “Ask about a
  message…”.
- On phones the coach stays a button in the chat header that opens the sheet, as
  settled in [Stage 4](04-shell-and-modes.md).

### 2e Also decided in this review

- **Top bar, Narrow tier:** the Chat and Practice tabs show icons only, with their
  names as accessible labels, so the language picker fits at 320px.
- **Conversation start:** once there is recorded practice, the start defaults to
  the coach's choice instead of “Lucía starts”. This uses the existing coach
  choices; if it needs data the start card does not have, it goes to Deferred.

## What does not change

Everything in the build plan's Chat list stays: translation, word by word, word
help, analysis, feedback and scores, edit and resend, recording inspection, Add to
Practice, rewards and XP, pronunciation, speech errors and retry, the partner's
reaction chip, gloss status and retries, evidence highlights, and the coach panel's
contents. The composer is the voice panel from build step 4 and is not part of
this stage.

## Implementation sketch, after approval

0. **Merge the duplicated media parts** (see “Duplication to remove first”) onto one
   implementation in `components/media/`, with Practice and the Recording
   inspection dialog switched to it and no behaviour lost. Verified on its own
   before step 1.
1. `ToolbarIcon`: add `waveform` and `edit`.
2. One tools-row component in `components/reading/`, used by `TurnView` (learner)
   and `TargetMessage` (partner), holding today's buttons; ⋯ on the existing
   popover pattern.
3. `MessageFeedback`: the badge becomes the line under the bubble; same dialog.
4. Chat styles: avatar beside the partner's bubble; the Narrow tier rules.
5. Inspector: mount the shared parts from step 0 in the bubble for the latest
   recording. The partner and older-recording cases
   are disabled with `BACKEND:` comments.
6. Coach rail: restyle the existing folded edge tab from build step 3.
7. Top bar: icon-only tabs at the Narrow tier.

Verification as in the [build plan](build-plan.md#verification-per-step).

## Deferred from this stage (native)

To be added to the README's Deferred list:

- **A15** Inspect the partner's spoken reply: run Practice's existing audio
  inspection on the reply's speech audio, the way it already runs on a reference.
  A small generalisation of the existing call, not a new analysis.
- **A16** Keep Chat recordings in **one app-wide recording store with one total
  limit**, freeing the least recently used audio first. It grows out of Practice's
  existing store and limit (`DrillStorage`, `DRILL_RECORDING_MAX_MB`); Chat joins
  it, and there is no second store. Until then, older learner messages have no
  Inspect control (see [Implemented](#implemented)).

## Implemented

2026-09-28, on branch `ux-design-pass`, uncommitted.

**Step 0, one media machinery.** New or moved into `components/media/`:
`PlaybackCursor`, `PlaybackProgress` and `useAudibleScrub` (moved from
`features/drill/`), `useRecordingPlayback` (Practice's attempt playback, lifted out
of `DrillPage`), and in `InspectionTracks.tsx` `TimedWords` (replaces both
`TimedWordTrack` and Practice's `WordOverlay`), `TimeAxis` and `StoredWaveform`.
`RecordingTrack` is one recording's plot: spectrogram, frequency scale, words
laid over it, and the playback cursor. Practice's reference and attempt and the
bubble inspector (`CompactInspection`) each draw one `RecordingTrack`; the
Recording inspection dialog is built from the same parts. The dialog's own audio element, frame
loop, playhead, range scrubber, axis and waveform path are gone; it now plays
through the shared speech player, so it follows voice speed and volume and stops
other speech, as Practice's attempts do. Practice's two segmented controls and its
recorder choices use `SegmentedChoice` (which gained per-option `disabled`).
`tests/architecture/shared-media.test.ts` fails if a surface stops using the
shared parts or anything outside `platform/` creates an audio element.

**Bubbles.** `components/reading/MessageTools.tsx` is the one tools row, used by
`TargetMessage` (every target-language bubble, including Practice's card and
passages) and by the learner's bubble in `TurnView`. Row order: Play, Inspect, Translate, then
Edit (learner) and Add to Practice as always-visible icons, then ⋯ holding Word
by word, Analysis and Pronunciation. `useReadAloud` is the one
read-aloud toggle, shared by the row's Play and the word speaker (`TokenAudio`).
`MessageFeedback` supplies the Analysis tool to the row and draws the quiet
feedback line (scores in words, then XP) under the bubble. The partner's reaction
chip sits beside the reply. Icons `waveform` and `edit` are in `ToolbarIcon` and
the design system. One new string, “More actions”, in all seven dictionaries.

**Scores on the feedback line.** Grammar and Conversation fit sit in one
coach-coloured pill under the learner's bubble. Each score shows the same
ten-step bar as the feedback card (`ScoreBar`, shared from
`ConversationFeedbackCard`), and the whole pill opens the feedback. At narrow
widths the two scores wrap onto two lines.

**Saved topics can be deleted.** Each saved topic on the start screen has a
trash control on its top corner. It shows on hover or focus, and always on
touch screens. It deletes through the existing `saveTopics` action, then
re-reads the saved list.

**Coach and top bar.** The folded coach is a full-height rail at Full and Compact.
At the Narrow tier (≤400px, the existing `useWidthTier` boundary) the Chat and
Practice tabs show icons only.

**Where the build differs from the canvas, and why**

- **Older learner messages have no Inspect control,** rather than “Coming soon”:
  the interface cannot tell a spoken message from a typed one, so a disabled
  control could appear on typed messages. `BACKEND:` comment in `TurnView`; A16.
- **Lucía's replies show Inspect as “Coming soon”** (A15).
- **The inspector starts closed.** The waveform button opens and closes it.
- **One Play per bubble.** On the learner's spoken message the row's Play plays
  the recording (through `useRecordingPlayback`, as Practice's attempts do); on
  other messages it reads the text aloud. The inspector has no Play of its own.
- **The latest recording is matched to its message by containment,** so a
  transcript appended to a draft or edited before sending still finds its bubble.
- **The recording is kept only while Chat is open.** Leaving Chat clears the
  latest recording (existing behaviour), so its inspector disappears. A16.
- **No new-notes count on the coach rail:** there is no such data today.
- **The start default (2e) is not built;** it was not in the implementation
  sketch. Say if you want it.

**Checks.** In a copy of `ui/`: `vitest run` passes (1407 tests) except
`admin-bundle.test.ts`, which needs a generated server asset the copy did not
have; `tsc`, `vite build`, the previews check, the style checker, the localization
test and the design-system check pass; the unused-style report matches the
baseline. Screenshots of the conversation preview at 1280, 900, 700 and 320px,
Practice, the dialog and the bubble inspector were checked. Not yet run in the
desktop app.

**Files to delete by hand.** The move needs these old copies removed (the session
could not delete files): `ui/src/features/drill/PlaybackCursor.tsx`,
`PlaybackCursor.test.tsx`, `PlaybackProgress.tsx`, `PlaybackProgress.test.tsx`,
`useAudibleScrub.ts`, `useAudibleScrub.test.ts` and `WordOverlay.tsx`.

## Review

The subsequent [shared audio review](03-shared-audio-review.md) supersedes the
reply-inspection deferral, transcript-containment association and duplicate-file
cleanup list above. Its verification results apply to the shared checkout.

2026-09-28, with Jon:

- Tools always shown; one row. Edit and Add to Practice are always-visible icons;
  Word by word, Analysis and Pronunciation go in ⋯.
- The learner's inspector starts closed; one Play per bubble; the words sit over
  the spectrogram exactly as in Practice.
- The feedback line under the learner's bubble, as drawn.
- The audio inspector inside the bubble, under the words, for both speakers.
- Keep Chat recordings in one app-wide store with one total limit, least recently
  used freed first.
- Coach: the full-height rail.
- The coach's choice leads the start once there is recorded practice.
- Narrow phones: tab icons without words; Word by word and Analysis in ⋯.
- Scope: interface only. No new functionality; Asking the coach from the composer
  was proposed and withdrawn. C3 stays open.
- Build rule: reuse existing parts; never duplicate.
- No duplication anywhere, including today's: Chat's Recording inspection dialog and
  Practice's comparison move onto one set of media parts before anything is added.
