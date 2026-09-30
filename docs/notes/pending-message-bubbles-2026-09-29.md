# Pending message bubbles — 2026-09-29

Status: agreed with the learner on 2026-09-29 and being implemented; not committed.
The learner approved building from this note without a separate plan review.

## Problem

After Send, nothing appears in the conversation until native storage accepts the
message and the snapshot delivers the turn. With a recording, that wait also
includes transcription, so the learner watches only the status line's
"Transcribing…" for a few seconds.

## Agreed behaviour

- The moment the learner sends, their bubble appears where it will live. How
  they sent does not matter: Send, Enter, Auto-send when a recording stops, or
  an edit. For an edit, it is the bubble being edited.
- The bubble grows into place, already shaped like the message, with a spinner
  in its footer. It fills in as its data arrives: typed text at once, and a
  recording's text when transcription returns (until then its footer says
  "Transcribing…").
- When the message goes out as a request, the partner's bubble grows in under
  it with its existing spinner, then fills as the reply streams, as today.
- When native storage has the turn, the real turn replaces both placeholders in
  the same place. The landed bubbles do not replay the grow animation.
- No animation moves anything from the recording panel. (Proposed and dropped.)
- Failure: the bubble stays and shows the app's usual error with Retry.
  - Retry re-sends the same text, or the same audio for a failed transcription.
    Nothing offers to record again; Edit already exists for changing a message.
  - Sending or recording something new replaces a failed bubble.

## Decisions made while building

- Placeholders are display-only. The page holds one pending message and draws
  it; nothing is written to conversation data, so a failure cannot leave a
  saved phantom message. Native snapshots still own messages.
- A new message's draft clears when it is sent (the text is in the bubble). A
  rejected send keeps its text in the failed bubble with Retry instead of
  restoring the draft. A draft typed while waiting is kept.
- Edits keep their own composer mode. The edited bubble shows the new text
  pending until the revision lands. A rejected revision keeps today's flow (edit
  mode, draft and error stay, so the learner can adjust, resend or cancel), and
  the bubble shows its original text again.
- With Auto-send off, a recording's transcript still goes to the draft; the
  bubble appears when the learner presses Send.

## Native retry for a failed transcription

Today `mic_transcribe` takes the recording out of the capture slot, and a failed
transcription discards its audio. Each attempt is one `transcription_attempts`
row keyed by its id ("Duplicate invocation cannot authorize another network
request"), so a retry cannot reuse the id.

- `mic_transcribe` keeps the failed take's request and WAV in memory.
- `mic_retry_transcription(recordingId)` runs the same transcription as a new
  attempt with its own id. The failed attempt stays recorded for AI activity.
- Transcription results are cached by the audio and request identity, so a
  retry after a paid provider result that failed later is not charged again.
- A new recording discards the held take; success releases it. The audio is
  lost on restart.

## Reused, not rebuilt

- The partner's pending bubble (`ReplyStatus`) supplies the shared pending shell:
  bubble shape, reserved reading line, spinner footer, and hydration of arriving
  text. The learner's pending bubble uses the same shell.
- The grow animation is Practice's card-open keyframe, moved to the shared
  motion sheet and used by both.
- The recorder's pending-take tracking (`pendingRecordings`, Practice only today)
  also runs for conversations.
- Failures use the existing error details and `AiRetry` Retry.

## Tasks

1. Shared pieces: move the card-open keyframe to `motion.css`; lift the pending
   bubble shell out of `ReplyStatus`.
2. Page: pending message state and rendering for typed and auto sends and for
   edits; swap on landing; failed send with Retry; tests.
3. Recorder: pending takes for conversation owners; "Transcribing…" bubble from
   recording stop with Auto-send; tests.
4. Native: hold failed audio, retry command, registration, contracts; tests.
5. Recorder `retry`, page Retry for failed transcription; tests.
6. Verify in the conversation preview and the desktop app; update this note.
