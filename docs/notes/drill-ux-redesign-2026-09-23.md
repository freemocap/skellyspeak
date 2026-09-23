# Drill page UX redesign — implementation note (2026-09-23)

Status: implemented, automated checks passed; not yet checked in the running Mac
app or with a physical microphone. No commit made. Mockup: the "SkellySpeak Drill
redesign" Design canvas (two artboards: the page, and the three recording modes).

## What changed

- **Chat/Drill switch** is a large centred pill in the top bar with icons.
- **Layout.** Three columns: phrases | practice stage | report. The stage is a
  full-height column (target phrase, comparison, record dock) sized so a
  1440×900 window needs no scrolling in the middle; the report column scrolls.
  The target phrase is set at 1.7× reading size.
- **Comparison** (`DrillComparison.tsx`): the reference and the selected take on
  one time scale and one dB colour scale, with word tracks where timings exist,
  a seek slider, and a shared time axis. A **Time → / ← Time** toggle mirrors both
  tracks (text is turned back to read normally). It defaults to right-to-left for
  right-to-left scripts and keeps the learner's choice for the session.
- **Report column**
  - `PhraseProgress.tsx`: best / latest / mean of last three / exact count, a
    match sparkline (a take that could not be measured breaks the line), a
    word × take grid (same / letters differ / not heard), and the word that
    differed most often when it differed more than once. Takes whose comparison
    split the target differently are left out of the grid, and the card says so.
    Pure logic lives in `domain/drill/progress.ts`.
  - `AttemptInspection.tsx` is now the full report for the selected take (default:
    newest): word chips (target over heard), match, words, length, speaking time,
    pace (target words per second of detected sound), pauses between detected
    regions, recording retention, and the comparison details. Speaking time, pace
    and pauses are computed from detected activity (`domain/drill/timing.ts`) and
    are labelled as such.
  - `AttemptLog.tsx` lists every other take as a compact row with one mark per
    target word; selecting a row moves it into the full report and the comparison.
- **Record dock** (`RecordDock.tsx`): three modes.
  - Tap to record: the previous Start/Stop behaviour.
  - Hold to talk: pointer or Space/Enter held on the button. A hold shorter than
    "Ignore sounds shorter than" is cancelled, not transcribed; releasing before
    the microphone finished starting also cancels.
  - Auto-detect: continuous listening. A level meter shows native's live level,
    measured room noise and effective threshold; the threshold offset, pause length
    and shortest take can be changed while listening without restarting capture.
    The dock counts takes, queue and ignored short sounds.

## Native changes

- `continuous_policy.rs`: policy version 2 adds threshold offset bounds
  (4–30 dB, default 10) and shortest-take options (160/300/600/1000 ms, default
  300). New `ListeningSettings { pauseMs, thresholdOffsetDb, minTakeMs }` with
  validation.
- `segmentation.rs`: the threshold is `noise floor + offset`, clamped to
  −70…−10 dBFS (the inspection threshold in `fluency.rs` is unchanged). A take
  needs `minTakeMs` of voiced frames; shorter ones are counted as ignored.
  `tune()` applies new settings from the next frame. The detector reports level,
  noise floor and threshold.
- `continuous.rs`: `mic_listen_start` takes `settings`; new `mic_listen_tune`
  command; `ListeningStatus` adds `settings`, `levelDb`, `noiseFloorDb`,
  `thresholdDb`, `ignoredTakes`. Contracts regenerated.

## Removed

`components/media/AudioSpectrumPlayer.tsx` and its styles (replaced by the
comparison), the "Repeat with pauses" checkbox and pause select, and the catalog
messages only they used.

## Verification

- Native (Linux container, same sources): `cargo test --lib speech::recording`
  23 passed, including new tests for ignored short bursts, threshold offset and
  tuning validation; `cargo fmt --check` and `cargo clippy --lib --tests` clean for
  the changed files; `export-contracts` regenerated `contracts.ts`.
- UI: full Vitest suite 173 files / 1,167 tests passed; TypeScript, previews,
  styles check, dead-style prune (0 unused), localization tests passed. New tests
  cover progress/timing logic, hold-to-talk (short press cancelled, long press
  transcribed), time-direction default and toggle, live threshold tuning, and the
  phrase summary.
- Visual: `ui/tools/drill-live-preview.html` now renders the whole page from
  fixtures; screenshots at 1440×900 checked in light and dark, RTL and LTR, all
  three modes.

## Not verified / open

- Real microphone: whether 300 ms shortest take and a 10 dB default remove the
  ghost takes seen on the Mac, and how the meter reads there.
- Mode, threshold, pause and shortest take are kept in page state only; they
  reset when the app restarts. Persisting them as learner preferences would be a
  native settings change.
- Reference word timings are still unavailable from the current inspection path,
  so the reference track often has no word labels.
- Add phrases dialog and difficulty generation were not touched.

## Second pass (same day), after the first run on the Mac

- **Dock is one row.** Button, status, a thin level meter, discard (icon), mode
  switch (Tap / Hold / Auto) and a settings button. Threshold, pause length and
  shortest take moved into a panel that opens above the dock. The live timeline
  keeps the waveform and a 28 px spectrum strip; no axis row. The comparison
  keeps at least 16 rem of height.
- **Stop in Auto-detect sends the sound in progress.** `Segmenter::finish_on_stop`
  closes the current take on Stop even when it is shorter than the shortest take
  or has not passed onset debounce; stopping in silence sends nothing.
- **"Recording is no longer active" after Stop** was a race: a listening run drops
  the microphone before it reports that it stopped, so a waveform poll in between
  failed. `mic_wave` now returns an empty chunk for the current listening run
  (the capture lock is released before the listening lock is taken).
- **Clearing takes.** New native commands `delete_drill_attempt` and
  `clear_drill_attempts(itemId, since)` delete takes and their audio; the phrase
  stays. `since` must be a stored-form UTC timestamp, so the comparison is exact.
  The report column has "Clear takes…" (last 5 minutes, last hour, all) and a
  delete button on every take.
- **Target phrase** uses Chat's partner bubble (`TargetMessage layout="bubble"`),
  with Translate / Word by word / Analysis inside it; Hear it sits beside it.
- **Report column** tightened: smaller paddings, three-column tiles, compact word
  chips and word grid.
- Verification: native full `cargo test --lib` 560 passed (6 existing ignored);
  UI full suite 1,168 passed; styles, dead styles, localization and previews
  checks passed. Still not checked with a real microphone.

## Third pass: density

- Target bubble shrinks to its text; its reading aids sit directly under the words.
- Comparison has a **Fit / Same scale** switch. Fit (default) stretches each
  recording across the width, so a short reference no longer leaves an empty
  band; Same scale keeps the shared time axis. Spectrograms grow with the window.
- Dock: the level meter takes the free width; tighter vertical spacing.
- Report: stats are one inline line; the per-word cards became inline word marks
  in the phrase's own direction (heard form shown only under words that differed);
  the heard transcript uses the shared `TargetText` reading component; the
  measurement tiles became one You / Reference table. The normalization note moved
  into Comparison details.
- UI full suite 1,168 passed on a clean run (one run had a single failure in
  "takes a typed phrase…" that did not reproduce in four reruns).

## Fourth pass: one surface, media rows, aligned words

- The phrase bubble, reference playback and both timelines are one surface
  (`DrillComparison` takes the bubble as `target`). Each recording has a media row
  directly above its timeline: play, seek slider (reference), time, and the
  Fit/Same scale and time-direction switches on the reference row.
- The report aligns target over heard, one column per compared word, in the
  phrase's direction; each column is tinted by outcome. Target words use the
  shared `TargetText` component.
- Measures are a transposed table: one column per measure, rows You and Reference.
- Earlier takes sit in their own sunken, labelled panel; each take is one line
  (number, word marks, heard text, short time, match, delete). Full timestamp and
  word counts are in tooltips.

## Fifth pass: resizable panes, visible record control

- New shared `components/layout/ResizeHandle.tsx` (`ResizeHandle` + `useStoredSize`):
  drag, arrow keys, Home/End, double-click to reset; sizes stored per pane in
  `localStorage` (`skellyspeak_pane_*`); a corrupt stored size throws.
- Drill splits that resize: phrase list | stage | report (widths); comparison |
  record dock (dock height); spectrogram height (both plots); phrase summary |
  selected take | earlier takes (heights). Handles hide in the single-column layout.
- Record button is a labelled pill (Record / Listen / Hold / Stop); the ready dock
  has a strong accent border.

## Sixth pass

- Target and heard are two separate table rows with aligned columns (one per
  compared word, phrase direction); each cell is tinted and underlined by outcome.
- Before a phrase's first take the record section takes the free height: large
  centred Record button, headline, instructions and mode switch. The record
  button is larger in normal use too.

## Seventh pass: threshold

- Default threshold raised from 10 to 16 dB above room noise (policy v2 default).
- The threshold marker on the Auto meter is a slider: drag it, click the meter,
  or focus it and use arrow keys / Home / End. It is always shown in Auto mode;
  before the room is measured it sits above the −60 dBFS native assumes. The
  settings panel no longer duplicates the threshold control.
