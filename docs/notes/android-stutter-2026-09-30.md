# Android streaming speech stutter, 2026-09-30

Status: the v2.9.4 debug APK with adaptive buffering and the latest highlight
geometry fix is installed and open on the reconnected phone. The user subsequently
confirmed that both audio and highlighting looked good during the latest chat.
No commit or release.

## Observations

- On the attached Android phone, saved audio replay sounded smooth; newly generated
  speech stuttered, and word highlighting looked erratic. This identifies the
  streaming path as the useful comparison, though it does not isolate one cause.
- A 40-second WebView capture during new speech found 35 long tasks totaling
  8.138 seconds, with the longest at 531 ms. Animation frames had 25 gaps over
  100 ms. The prior player only scheduled 160 ms ahead on the audio clock.
  A separate audio scheduling probe saw 102 starts and seven gaps in scheduled
  audio, with gaps of 221–289 ms. This supports both main-thread stalls and
  stream underruns as plausible audible contributors.
- The app's original native logger wrote 672,533 records (165 MB) in 291 seconds,
  nearly all dependency TRACE. A synchronous sink flushed each record. Filtering
  dependency logs to WARN/ERROR reduced an idle fresh-run log to 152 bytes and
  retained authored microphone INFO events.
- The isolated WebView emitted 1,349 tile-memory warnings during an interactive
  run after the logger fix. A temporary hardware-accelerated build removed those
  warnings, but the user reported unchanged or worse playback. The source
  manifest remains on the previous software-rendering setting because of a
  recorded graphics-context failure during microphone use.
- These experiments used an unoptimized Android debug build. No app crash or ANR
  was recorded in the observed run. The data do not prove whether network cadence,
  CPU load, rendering, or their combination dominates every audible gap.

## Implemented playback policy

- Queue incoming PCM and watch arrival cadence. After two arrivals at least
  250 ms apart, calculate source-audio seconds delivered per wall-clock second.
  This is a minimum measurement window, not a fixed playback delay.
- Use cumulative partial character timestamps only when they anchor exactly to
  the displayed source text. Estimate total duration from the timed grapheme
  weight and the remaining text, with a 25% duration margin. If timestamps are
  absent, ambiguous, or too sparse, do not claim an estimated length.
- Compare queued audio with a target based on observed arrival gaps, playback
  speed, delivery rate, and remaining estimated duration. A stream slower than
  playback starts early only when the estimated remaining delivery can be
  covered; otherwise it waits for the complete recording. An unexpected underrun
  waits for completion before resuming, avoiding repeated short gaps.
- Schedule 750 ms ahead on the audio clock, beyond the longest captured WebView
  task. Show a buffering status once streamed audio has arrived. Streamed PCM
  may only be scheduled through the last word with confirmed timing. This keeps
  the highlight data available before the matching audio is heard; the complete
  recording releases the final tail with final timing or visual fallback.
- An audit confirmed completion bypasses every arrival-rate and alignment gate
  synchronously in the player. A test now covers completion before any useful
  rate or word timing is available. The existing UI read loop can add up to
  80 ms when the stream cursor is caught up. Populated chunks now advance the
  cursor immediately, and an empty caught-up read no longer reappends or reruns
  word segmentation. This preserves ordered partial delivery without adding a
  post-completion buffer.
- The highlight overlay previously animated word geometry and opacity over
  120 ms. Short final words could end before that transition settled. The
  visual transition was removed so each confirmed word appears at its measured
  position immediately. Geometry now remeasures when an ancestor bubble resizes
  or the text host moves without resizing; the latter is checked using the host
  box while a word is actively highlighted.
- Estimates cannot guarantee uninterrupted playback if network cadence worsens
  or the estimated spoken duration is too short. The player still preserves all
  validated audio for completion and replay.

## Verification

- Fifty focused UI tests passed, including early start, slow-stream
  completion fallback, immediate completion before a rate estimate, first and
  last word following, empty caught-up reads, and overlay positioning.
- The UI production build, fast repository checks, logger policy test, and
  native Clippy check passed. The final Android v2.9.4 debug APK built and
  installed successfully with app data retained.
- The user found the adaptive-buffer build smoother and the timing-coupled
  build mostly correct, with a final visual transition still appearing late.
  The transition and transport polling cleanup was installed. The user then
  observed the overlay drifting when a message bubble moved during hydration.
  The latest source observes bubble ancestor resize and tracks the host position
  during active highlighting. It passed checks and Android packaging. After the
  phone reconnected, installation succeeded with app data retained and the app
  was opened. The user subsequently confirmed that audio and highlighting looked
  good during the latest chat.

## Build environment

One final packaging attempt failed because the development drive had only about
645 MB free. Clearing the generated host Rust incremental cache freed roughly
900 MB; the retry built successfully. No source or app records were removed.
