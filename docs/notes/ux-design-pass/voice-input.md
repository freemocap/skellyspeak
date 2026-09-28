# Voice input — one recorder for Chat and Practice

Status: **settled after the seventh review, 2026-09-27; not implemented.** Step 4
of the [build plan](build-plan.md). Part of the [UX design pass](README.md).
Review page sections Va and Vb: `/tools/design-pass-preview.html#dp-va`. The 1c
start screen and the Practice surface use the same panel. Practice was called
Drill until the sixth review; the findings below use the code's names.

## Why

Jon's review: the Drill recorder has outgrown the chat input, and the two should
be one component. The recorder is the primary interface: most input is spoken.
The record button feels out of place, and the record section wants to be a
full-size panel with the streaming waveform and spectrogram beside the control.
Chat must stay microphone-first, with typing as an override; the microphone
feeds a text box, and auto-send skips the check.

## Current state (observed)

- **VF1 One engine, two interfaces.** Both surfaces record through
  `platform/audio/useMicRecorder.ts`. Chat renders `ComposerInput.tsx`; Drill
  renders `features/drill/RecordDock.tsx` with `components/media/LiveRecording.tsx`.
- **VF2 Chat is text-first.** The text field is the widest element; Record is a
  pill beside it, and a small waveform appears inside the field only while
  recording.
- **VF3 Chat uses a simpler capture path.** Chat calls `mic_start` and
  `mic_transcribe`, which return the transcript text. Drill always runs a
  listening session (`mic_listen_start`, capture mode `auto`, `monitor` or
  `manual`), which is where the live spectrogram, level, threshold and takes come
  from. A listening take (`ListeningTake`) carries no transcript text back to
  the interface, so Chat cannot use it as is.
- **VF4 The Drill dock crowds its control.** A large pill button sits in a narrow
  column with the headline, take counts, level meter and a checkbox; the stream
  sits beside it without a visual link. Long instructions fill the headline area.
- **VF5 Auto-send is hidden and named three ways** (“Auto-send”, “Auto-send
  transcriptions”, “Send after stopping the microphone”), and it is only in two
  settings panels.
- **VF6 Stream direction follows the button.** `LiveRecording` mirrors the plot in
  left-to-right interfaces so new audio enters beside a button on the inline-start
  side (`styles/components/waveform.css:28-30`). Moving the button moves this rule.
- **Mobile parity is in place.** Phones stream browser-captured audio to the same
  native segmenter (`mic_listen_push`), so Auto works on both platforms; see the
  [mobile plan](../drill-mobile-plan-2026-09-23.md).

## Proposal

One `VoicePanel` component, identical in Chat and Practice: same size, pad, words,
icons, colours, toggle and settings. Revised after each review (see [Review](#review)).

- **Layout: a 2 × 2 grid.** Top row: the stream face (waveform over spectrogram,
  the production `LiveRecording`) and the microphone pad at its “now” end, the
  same height as the face. Bottom row: one line of controls under the face, and
  the Tap / Hold / Auto toggle under the pad, the same width as the pad. The voice
  flows away from the pad; in left-to-right interfaces the plot is no longer
  mirrored, in right-to-left interfaces it is.
- **The pad is only ever the microphone.** A microphone icon and no word. Colour
  carries the state: ready is a calm blue (the “you” tint, line and ink), live is
  solid red with a red outline and a glow, and waiting is faded. Red means
  recording and nothing else. Press it again to stop; in Hold, let go. The stream
  face takes the red outline while live.
- **One sentence, one arrow.** The empty stream is a single arrow across its whole
  width, pointing at the pad, with “Press the microphone to start” in the middle.
  The words are the same in every mode and on both surfaces.
- **Live state is a chip in the stream:** the time while recording, the same on
  both surfaces. “Transcribing…” covers the stream while Chat waits for text.
- **One control row, never wrapping, in the same order everywhere:** recording
  settings, the level meter (Auto only), then Chat's Type and Auto-send, or
  Practice's Detect attempts (Auto only).
- **Chat's draft sends itself.** The transcript appears where the stream was, as
  editable text with Discard and Send inside the box, so Send never borrows the
  microphone. Pressing the microphone again adds more. Enter sends; Shift+Enter adds
  a line. Auto-send skips the draft.
- **Chat Auto:** stays in the toggle so the controls match Drill, dimmed; pressing
  it shows a small “Coming soon” tag in the word-help popover style and keeps the
  current mode. The target behaviour (each pause adds a line, or sends it with
  Auto-send) needs native work (A9).
- **Practice** has no draft, Type or Auto-send. Its Auto is today's Live mode with
  “Auto detect takes” on: each pause cuts an attempt, labelled in the stream, and
  the attempt list appears once there is one. **Detect attempts** is today's
  checkbox under its new name; turned off, the stream and meter keep running and
  no attempts are made (capture mode `monitor`), and it can change mid-session as
  today. Cards fold into an edge tab on the left with a violet edge, matching the
  coach edge in Chat.
- **Recording settings keep today's options:** microphone; in Auto, “End an attempt
  after a pause of” and “Stop listening after silence of”; in Practice, “Ignore
  sounds shorter than”. The mode choice moves out of this dialog to the toggle
  under the pad.
- **No standing instructions on either surface.** Today's dock headline and detail
  lines go; the queued and ignored counts move next to the attempt list.
- **Phone.** The same grid at smaller sizes.

The page drives the real `LiveRecording` with synthetic audio built from
`ui/tools/spectrogram-fixture.json`; transcripts and take scores are samples.

## What is interface work, and what needs native work

Interface work, no native change:

- One `VoicePanel` component replacing `ComposerInput` and `RecordDock`, with
  `useMicRecorder` unchanged.
- Chat: Tap and Hold modes, the draft face, Type, Auto-send, waveform while
  recording.
- Practice: the new layout for its existing modes, meter, Detect attempts and
  settings, and the card list folding to an edge tab.

Needs native work (deferred, see the README):

- **A9 Chat Auto and hands-free talking.** Deliver each listening take's
  transcript to the interface, route it to the draft or send it, and coordinate
  with partner speech: capture and playback are one authority, so read-aloud
  must pause listening.
- **A10 Spectrogram and level meter in Chat.** *Spectrogram done 2026-09-27 at
  Jon's request, by a different route than proposed here; see “Implemented”
  below.* The level meter belongs to Auto, so it waits for Chat's Auto (A9).
- **A11 Remember recorder settings** (mode, timing, auto-send placement) as
  learner preferences; today Drill's mode and timing are page state (A2).

## Implemented (build step 4)

Implemented 2026-09-27, uncommitted. Source:
`ui/src/components/media/VoicePanel.tsx` and `ui/src/styles/components/voice.css`;
Chat's `ComposerInput` and Practice's `RecordDock` render it. `useMicRecorder`
still owns recording, and Practice keeps every control in the build plan's
preserve list.

- **Chat.** Type opens the draft; Enter sends and Shift+Enter adds a line (both
  are tooltips now, not a hint row). Hold works in Chat. Recording settings holds
  the microphone choice. While recording, the face shows the same `LiveRecording`
  as Practice: the waveform over the spectrogram, a time chip and Discard
  recording.
- **Practice.** Timings moved into Recording settings. The session's counts
  (“Attempt n · n queued · n ignored”) sit beside the attempt list.
- **Chat's spectrogram (A10).** The proposal above was to move Chat onto the
  listening session. That session trims silence, ignores short bursts and caps
  takes at 30 seconds, so Chat's recording would have behaved differently. Instead,
  a single recording keeps its own live analysis: the same `LiveAnalysis` a
  listening run uses. Native `mic_spectrogram` analyses the desktop capture's new
  samples when polled; on phones the browser recorder sends ordered copies with
  `mic_push`. The recording, its WAV and transcription are unchanged. The
  spectrum is a small external store (`domain/audio/spectrum-feed.ts`), so only
  the stream re-renders per frame, not the chat page.
- **Resizing (Jon's request).** One grip style for every divider
  (`components/panels.css`). Chat's recording panel has a grip above it; a dragged
  height goes to the face. Practice has a grip under the reference plot at every
  width, one under the attempt plot when stacked, and the recording panel's grip
  at every width. Stacked, the attempt list fills the space between the plots and
  the recording panel and holds every take, scrolling, instead of stopping at two.
  Heights are kept per device (`useStoredSize`); a double click resets one.
- **Removed at Jon's request:** the unstyled “Inspect recording” button above the
  Chat panel. The microphone icon on the message bubble opens the same inspector.
- **Found in the browser and fixed:** hover masked the recording red after a
  press, because the pointer is still over the pad; the waveform drew its own
  “● rec” clock under the panel's time chip; the prompt showed while the pad was
  disabled, and while recording before the stream arrived.
- **Still to check:** a real recording in the desktop app (native capture feeding
  the spectrogram), and phones.

## Review

2026-09-27, Jon, on the first proposal: the text input direction and the coach
edge work. Requested and made: every control on one row; Tap / Hold / Auto
visible under the record control; an arrow in the empty stream; Drill phrases
collapse to a side panel like the coach; no static copy in the main surfaces.

2026-09-27, Jon, on the second proposal: “Press here to talk” beside an arrow
pointing elsewhere is a cue conflict, because “here” reads as the words. Varying
the words by mode or surface (“say hola”, “start listening”) and labelling one
button “Talk” in Chat and “Listen” in Drill are cue conflicts too. Requested and
made: one full-width arrow with the same sentence in the middle everywhere; a
microphone icon and no word on the pad; red outline and red glow while live, not
blue; “Auto-send” as the checkbox label; the two panels made identical.

2026-09-27, Jon, seventh review: the ready microphone should be a neutral blue and
turn red only while recording, the usual pattern for record buttons. Made. The
mockup's Practice panel had dropped today's “Auto detect takes”; it is back as
Detect attempts, with today's recording settings.

Decided 2026-09-27: Chat's Auto stays visible and shows “Coming soon” (fifth
review). No open questions remain for this panel.

2026-09-27, Jon, during step 4: Chat must show the spectrogram as well as the
waveform; the recording panels, Practice's history and reference must resize
vertically; the “Inspect recording” button above the Chat panel is vestigial. All
made; see “Implemented” above.

## Words (decided 2026-09-27)

In Practice each recording is an **attempt** (“Attempt 3 · 86% match”), the voice
you copy is the **reference** (“Play reference”), and what you practise is a
**card**. Drill is now called **Practice**. The stream's region label changes from
“Take n” to “Attempt n” in `LiveRecording`. The modes are **Tap, Hold, Auto**
(were Tap, Hold, Live), and “Auto detect takes” becomes **Detect attempts**.
