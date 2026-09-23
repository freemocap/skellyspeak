# Continuous repetition — desktop checkpoint (2026-09-23)

Status: implemented, automated checks passed; live Mac microphone check pending.
This is the first desktop slice of original E7 / Milestone C, not completion of
all original continuous-mode and progression proposals. No commit made.

## Behavior to inspect

In Drill, enable **Repeat with pauses (desktop)**, choose the pause between takes
(default one second), and start recording once. Speech followed by the selected
quiet period becomes a separate take while capture continues. Each take uses the
same inspection, transcription, receipts, usage accounting, comparison, retention
and attempt publication as manual recording. Stop finishes the current qualifying
take. Discard current take drops only the unfinished audio and keeps listening.
Previously queued takes continue processing. Queued and processing counts are
shown separately; the headline distinguishes listening from recording a take.
Manual recording remains the default and uses the existing Start/Stop behavior.

Target and visit are captured natively at start and remain fixed throughout one
listening run. Every boundary revalidates that visit; changing visits stops capture.
The UI also cancels on owner changes. This deliberately prevents target switches
mid-listening rather than trying to assign late results to a newer visit.

Reference/attempt/token/Chat speech remains excluded through the existing capture
and speech authority while the microphone is active. The existing window lifecycle
now also notifies continuous capture on blur, hide, native suspension or close.
Opening a shared DetailDialog stops continuous capture. Resume requires an explicit
start; no focus event, dialog close or polling result restarts recording. Accepted
queued takes can finish after capture stops or the learner leaves the view.

## Shared architecture

- `speech/recording/audio.rs` is still the one desktop capture implementation.
  The native worker drains its bounded PCM buffer; the device callback does no
  segmentation, FFT, provider, file or database work. Live waveform decimation
  keeps its sample offset across PCM drains.
- `speech/analysis/fluency.rs` provides shared RMS energy and noise-relative
  threshold primitives to offline inspection and the live boundary detector.
- `speech/recording/segmentation.rs` adds streaming framing, onset debounce,
  pre-roll, quiet-period completion and bounded takes. It does not infer words,
  pronunciation, correctness or number of linguistic repetitions.
- `voice::transcribe` is extracted from the existing manual command and used by
  both manual and continuous recordings. There is no Drill-specific transcription
  executor, receipt state machine, provider adapter or attempt writer.
- `continuous.rs` owns the bounded volatile queue and listening lifecycle. Native
  status includes completion revision, failure details and processing counts. A
  completion refreshes history even if publication preceded a cleanup error.
- The existing `useMicRecorder` handles both modes, with the same owner fences and
  playback exclusion. UI does not create/save attempt rows or submit transcripts.

## Policy and limitations

`continuous_policy.rs` owns policy version 1 and exports
`CONTINUOUS_RECORDING_POLICY` to UI controls:

- Pause choices: 0.6, 1, 1.5, 2 or 2.5 seconds; default 1.
- At most three takes outstanding in total, including one processing take.
- Maximum take: 30 seconds. An overlong unfinished take is discarded with an
  explicit reason; it is not silently truncated or automatically resubmitted.
- Maximum listening run: ten minutes / 100 submitted takes.
- A disconnected view loses its native listening lease after ten seconds.

Queue saturation stops capture and reports that unqueued audio was discarded;
already queued takes finish. A transcription failure stops further capture and
retains the shared structured error; existing admission/holds govern queued work.
Start is refused while the previous run still has queued/processing takes.

Energy is a heuristic. Brief clicks are filtered; quiet speech may be missed and
loud background noise may look like activity. The detector uses 20 ms frames,
120 ms onset debounce, 200 ms pre-roll and a 160 ms minimum voiced duration.
This needs real microphone testing, including short words and ordinary hesitations.
The display's offline speech regions do not become an authoritative repetition count.

Queued audio remains bounded in memory until dispatched, so closing/crashing the
whole application can lose undispatched takes. Existing dispatched-receipt recovery
and durable published attempts are reused. No second persistent queue was added.
No schema change or additional development reset is required for this slice.

Mobile continuous capture is **not implemented**: its existing worklet delivers a
completed WAV, and it needs sequenced PCM streaming/backpressure into this same
native segmentation policy. The continuous command fails explicitly there; manual
mobile recording remains available. Auto-advance, pronunciation grades, tap-auto,
automatic playback/re-arm and the original cut-off-and-save policy are not included.

## Mac checkpoint

1. Rebuild with `npm run macos:dev`. Enable Repeat with pauses, start once, say the
   target three times with roughly one-second gaps, then Stop. Expect three
   separate attempt rows, individual replay audio and individual usage receipts.
2. Pause briefly within one sentence (shorter than the selected gap). Expect one
   take. Try a short single-word target and quiet speech; note missed onsets.
3. Discard during a take, then repeat again. Only the discarded take should be
   absent. Stop during speech and confirm the current qualifying take finishes.
4. Try reference playback through speakers. It must be blocked while listening;
   after stopping, it should work without generating another take.
5. Change views/open a detail dialog or move focus away. Capture must stop and
   must not restart on return. Completed queued takes retain their original item.
6. With slow processing, reach the queue limit. Expect a visible stop reason,
   bounded pending counts and explicit start only after pending work finishes.

Automated verification covers three separate takes through a real local HTTP
transcription fixture and the production receipt/attempt pipeline, queue saturation,
cancellation without dispatch, changed visits, pause authority and view-lease expiry.
Pure PCM tests cover silence, brief clicks, short hesitations, repeated utterances,
chunk fragments and overlong speech. UI tests cover continuous command wiring,
queue/status changes, current-take discard, source change and lifecycle suspension
without automatic resume. Full suites: 604 native passed (6 existing ignored),
1,155 UI passed. Clippy, fmt, contracts, TypeScript, styles, previews, language/content
validation and build passed. No paid provider calls or physical microphone run were
performed by the agent.

## Implemented: visible cuts, live spectrum and reference playback (September 23)

Native segmentation now publishes each take's recording/receipt ID, retained PCM
start/end and detection time, followed by queued/processing/completed/failed state.
The shared recording timeline places those actual bounds over the waveform and
spectrum. An arrival animation and processing card appear at the cut; the same
card becomes the saved attempt, joined by transcription receipt ID. This does not
infer new cuts from the inspector's activity regions.

The existing FFT/filterbank was extracted into one shared analysis kernel used
by completed inspections and live capture. Resolution increased from 64 to 128 mel
bands and from a 400 to a 1,200 frame offline cap. Frames advance every 20 ms until
that cap requires a wider hop. A minimum 50 ms power-of-two FFT window improves
frequency resolution (at 48 kHz: 4,096 samples, 85.3 ms, 11.7 Hz FFT-bin spacing).
The longer window trades some transient sharpness for frequency detail. Frequency
bounds, unavailable bands, dB reference and paired color scales are unchanged.
Canvas scaling no longer forces nearest-neighbor pixelation.

Live analysis runs in the capture worker, outside the microphone callback and
capture lock. It caches its filterbank and keeps 12 seconds of spectral frames.
The UI requests only frames newer than its cursor, at most five times a second,
and maintains the same bounded history. The existing waveform uses that native
clock. No second capture implementation, browser FFT or provider request was added.

Reference speech prepares its existing inspection before playback. The shared
player exposes actual media time and seeking; the reference spectrum has a vertical
playhead and seek slider, available before any learner attempt. Existing word tracks
render real timings when present. **Reference word timestamps are still unavailable
with the current inspection path**; no alignment service or invented word placement
was added. The UI explicitly reports that absence.

### Verification

- Native: 606 passed, 6 existing ignored. Local fixture servers required running
  the suite outside the network sandbox; the restricted run failed at socket bind.
- UI: 1,161 passed across 171 files. New coverage includes stable cut-to-result
  cards, failed takes, native-clock boundaries, delta merging and scope clearing,
  real media clock/seeking cleanup, and interruption during reference preparation.
- Clippy, fmt, contracts, TypeScript/build, styles/dead styles, previews and language
  checks passed. Build retains its existing bundle-size advisory.
- Offline production-component preview: `/tools/drill-live-preview.html`.
  Browser checked the reference cursor, both spectra, clipping overlays and immediate
  queued/processing cards. Fixture audio is synthetic native analysis, not evidence
  of microphone or speech-recognition quality.
- Local unoptimized benchmark: 20 seconds of 48 kHz PCM analyzed in 1.606 seconds;
  a 200 ms delta serialized to 21,093 bytes in 0.622 ms. This measures analysis and
  serialization, not end-to-end frame rate, power use or phone performance.

### Next running-app check

Rebuild with `npm run macos:dev` (no reset/schema change). Hear the reference and
scrub its spectrum. Enable Repeat with pauses, say three repetitions, and check
that each highlighted clip produces a pending card while the microphone keeps
running. Stop and check that those cards become playable attempts. Switch phrases
and ensure the live timeline and reference cursor do not carry across. Physical
microphone, real provider playback and mobile performance remain unverified here.

## September 23 overwrite recovery

The DrillPage wiring was overwritten by a stale clone and has now been restored
from the surviving shared machinery. Required props and page-level regression tests
now cover the previously silent omissions. See
[recovery verification and scoped cleanup](drill-overwrite-recovery-2026-09-23.md).
The prior API-route preservation/upgrade design was removed at the user's direction.
