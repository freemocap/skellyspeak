# WebView renderer crash, 2026-09-28

Status: **investigated; fix implemented and verified in the browser previews,
uncommitted; not yet confirmed in the running desktop app.**

## What happened

Jon's development app (`tauri dev`, debug build) stopped responding at 00:04–00:05.

- **Native logs** (`.local/logs/native-46da41cd-…/native.jsonl`) and frontend
  diagnostics (`diagnostics.jsonl`) stop at 00:05:27 with no panic or error. Native
  logging here is driven by the page's IPC, so silence means the page stopped.
- **WebView2 crash dumps**
  (`%LOCALAPPDATA%\com.freemocap.skellyspeak\EBWebView\Crashpad\reports`):
  - four renderer crashes, at 00:04:50, 00:04:55, 00:04:58 and 00:05:25;
  - all four are `0xC0000005` access violations, reading address `0xc` at
    `msedge.dll+0x77ec1f`;
  - WebView2 153.0.4234.48, NVIDIA driver 32.0.16.1060, scale factor 1;
  - no other dumps exist for this app.
- **Timeline:**
  - Practice listening started at 00:04:42 and an attempt was saved at 00:04:48.
  - The first crash followed at 00:04:50.
  - Each reload restored Practice and crashed again within about a second, as
    its reference and attempt spectrograms loaded.
  - The Rust process kept running until `tauri dev` rebuilt it at 00:08:30.
- **Earlier interruptions were not crashes.** Rust edits made `tauri dev` restart
  the app (23:32, 23:47), and UI edits reloaded the page during use (23:48, 23:57,
  00:00).

## Cause

The React development build (19.2.8, installed through `^19.1.0`) records a
`performance.measure` for every component render. Its detail lists every changed
prop, down to array elements (`addObjectDiffToProperties`), and the browser keeps
each entry until it is cleared.

The live spectrogram passed its frames through React props 20 times a second:

- **Practice:** `DrillPage` held it as state and passed it to `RecordDock`, then
  `LiveRecording`, then `Spectrogram`.
- **Chat:** the same path, since build step 4.

One `Spectrogram` render listed about 150,000 rows. Attempt and reference
inspections list each frame as JSON when they arrive.

This was reproduced in the Chat fixture:

- `DataCloneError: Failed to execute 'measure' on 'Performance': Data cannot be
  cloned, out of memory` from React's `logComponentRender`;
- about 450 renders each of `Spectrogram`, `LiveRecording` and `WaveformStrip`,
  with prop diffs, within minutes;
- 160 long tasks;
- React updates that no longer committed, so the recording could not be stopped.

The renderer's exact failing function is not identified: the dumps are not
symbolised (no debugger installed; WebView2 symbols are large). The failures
line up with these diffs: live frames at 20 Hz, then large inspection props on
each reload. Release builds do not record these entries.

The rest of the stream was checked for memory leaks and found bounded or released:

- native `LiveAnalysis` (12–33 s windows);
- listening previews (bounded) and takes (at most 100 per run);
- single recordings (120 s cap), and the browser `WaveBuffer` (12 s);
- the recorder's merged spectrum (12 s);
- canvases and their copies in arrival animations;
- scrub and speech players (contexts closed, object URLs revoked);
- the diagnostic buffer (400 entries).

The Practice inspection cache grows per card and is cleared on card change.

## Fix

- **The live spectrogram paints itself from the recorder's feed.** `LiveSpectrogram`
  and `LiveFrequencyScale` in `components/media/Spectrogram.tsx` do the painting;
  `LiveRecording`, `RecordDock`, `DrillPage` and `ConversationPage` pass the feed,
  not the frames. Nothing re-renders per frame except `LiveRecording`, and only for
  the clock that places the waveform and the attempts.
- **Painting reuses its canvas size and pixel buffer.** It resolves the
  spectrogram colours once per set of token values instead of reading them back
  from the painted canvas on every paint.
- **A development-only guard.** `platform/diagnostics/development-measures.ts`,
  installed from `app/main.tsx`, keeps React's render entries but lists at most 40
  changed props per entry and says how many it omitted. It also clears recorded
  measures every 5 seconds.

## Verification

Chat fixture, 10 seconds of live recording, before and after:

| | Before | After |
| --- | --- | --- |
| `Spectrogram` render entries | about 45 a second | none |
| Stored detail | megabytes per frame | 118 KB in total |
| Long tasks | 160 | 0 |
| Heap | 110–277 MB | 20 MB |

- Stopping a recording works again and releases both canvases.
- The Practice preview draws live and comparison spectrograms, with their labels
  and axis ticks.
- `npm test` 1,389 passed. `npm run build`, `previews:check` and
  `localization:audit` passed.

## Open

- **Confirm in the desktop app:** a long Practice session in Auto, and Chat
  recordings.
- **If a renderer crash recurs,** symbolise a dump (WinDbg with the Microsoft
  symbol server) before changing more.
