# R1 waveform performance verification

Baseline: rebuild `b68c64a`. Scope: independent capture/render cadence, bounded
history and cleanup review. Interaction owns WaveformStrip.tsx and its retained
tests. Reliability owns this report and temporary measurement harnesses, no UI or
native edits. No app/server restart, provider call, deployment or Git mutation.

## Method and minimal reproduction

Executed the actual TSX component transformed with installed esbuild, real React
mount/unmount in jsdom, and an instrumented canvas context/controlled RAF clock.
No copied renderer implementation. CSS width360, DPR3, height44, timeline10seconds;
WaveSource750samples/sec (48kHz native capture divided by64),75 synthetic samples
supplied every six60Hz frames. Warm up10seconds, then measure10seconds steady state;
follow with60frames containing no new samples, source replacement and unmount.

Baseline source copied before Interaction edits to
`/private/tmp/R1-WaveformStrip-baseline.tsx`, SHA256
`d79f6b96542046d5f70eb2736135ab281d5a282db5e12025b7f8a0582051a4fb`.
Temporary reproduction command: `node /private/tmp/r1-waveform-measure.ts <tsx-path>`.
The harness is `/private/tmp/r1-waveform-measure.ts`; its JSON output is temporary.
Interaction owns portable retained regression coverage in WaveformStrip.test.tsx.
These measurements count actual canvas calls and scheduled work, not GPU execution,
heap allocation bytes, frame-time percentiles or device FPS.

## Baseline measured results

| Scenario | Measured result |
| --- | --- |
| Full history,600frames with10Hz input | 4,500,600 lineTo calls;600 canvas fills;7,501 lineTo calls every frame |
| Full history,60frames with no new samples | 450,060 lineTo calls;60 canvas fills |
| Source replacement | One scheduled RAF and one resize listener; next frame only2 baseline lines (history reset) |
| Unmount | Zero scheduled RAFs, zero resize listeners, zero subsequent source reads |

History stops growing at7,500 samples for this rate/time window. The7,501 line calls
include7,499 waveform segments and two reference lines. Thus redundant identical
painting is demonstrated; unbounded history or leftover animation loops were not.

## Independent recorder-hook measurement

`node /private/tmp/r1-mic-cadence.ts` executes the real useMicRecorder hook with
instrumented native-call promises and controlled intervals. It observed:

- Poll interval100ms; ten ticks while one mic_wave promise remains unresolved produce
  exactly one native request (no overlap).
- Two8192-sample chunks without consumer drainage leave8192 newest samples.
- Second drainage returns zero samples; late result after cancellation is ignored.
- Unmount leaves zero intervals. Cancellation issued once; no transcription request.

These are synthetic lifecycle/capacity observations, not actual microphone timing.
Native source independently caps waveform backlog8192 and raw recording120seconds;
the waveform decimator uses every64th sample. No separate native fix is proposed.

## Bounded change under Interaction ownership

Interaction selected the smallest demonstrated improvement: keep RAF/source drainage,
exact history/sample path, style and semantics, but skip painting if no new samples,
no whole-second elapsed-label change and no resize invalidation. This avoids a ring
or downsampling redesign. Independent final-source comparison will be appended
when that slice freezes. Remaining full-history work per fresh input and concat/slice
allocations are candidates for later measured work, not blockers to this guard.

## Native/mobile QA and crash limits

No actual crash interval was investigated, so no logs were sampled or filtered.
For any future incident interval read all available stream files, not error lines
alone, and identify app build/device/OS/time first. Current `voice_mobile.rs` returns
"Mobile microphone integration is not available in this build" for microphone
commands. The current desktop/source harness cannot reproduce or explain recording
in a previously released mobile app. No white-screen crash attribution is supported.

After coordinated runtime permission: compare long recording, stop/cancel/restart,
orientation/container resize and background/foreground on the actual affected device.
Capture frame times/long tasks and memory high-water marks plus all relevant logs;
platform process-termination reports are required if the WebView dies without a JS
exception. Do not increase buffers or change recording/provider semantics speculatively.

## Independent verification of frozen Interaction patch

Reviewed the small needsPaint/paintedElapsed guard only. Source SHA256:
`83cdafe8e44d8a35ce1499d69df4f4dd1d761f94280ff5c9fa3d569efdc4c528`.
Same independent harness inputs produced:

| Scenario | Before | After |
| --- | --- | --- |
| 600 steady frames,10Hz incoming samples | 4,500,600 lineTo /600 fills | 757,601 lineTo /101 fills |
| 60 frames,no new samples | 450,060 lineTo /60 fills | 7,501 lineTo /1 fill |

Steady draw-operation count fell about83%; the one extra steady paint beyond100
sample batches is an elapsed-second boundary under the controlled clock. This is
not an83% native CPU/FPS claim. Each actual data paint retains the original sample
path; RAF reads continue so there is no lowered capture/drain frequency.

Additional independent checks: resize plus DPR3→2 and CSSwidth360→400 produces an
800x88 backing canvas and repaints on the next frame without new data. Changing
height44→60/timeline10→5 recreates the effect, updates backing height120, retains one
RAF/listener and skips the subsequent identical frame. Replacing source resets history.
Clearing source leaves zero RAF/listeners/further reads; unmount also leaves zero.
The parent conditionally removes the waveform while not recording. Clearing source
alone does not explicitly blank a retained canvas, matching prior behavior; this
patch does not add a new visible cancellation path. DPR-only changes without a
resize event still depend on the existing resize strategy, unchanged by this slice.

Independently executed retained `WaveformStrip.test.tsx` and `useMicRecorder.test.ts`:
12 tests passed. Coverage includes new batches, elapsed text, resize invalidation,
bounded visible history/one-sample peak, replacement/unmount and recording ownership.
No actionable regression found in the frozen guard. Interaction owns full frontend/
style/build evidence; Reliability did not duplicate those broader gates.

Report complete; sent Integration and Code Quality for bounded independent review.
Native/mobile runtime QA remains separate. Mobile capture unavailability is a source
limitation on reproducing the historical symptom, not a blocker for this desktop fix.
