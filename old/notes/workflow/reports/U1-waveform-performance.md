# U1 — waveform redraw reduction

Base: rebuild b68c64a. Completed bounded source handoff; source frozen for Integration checks.

## Changed paths

- src/components/WaveformStrip.tsx: skip canvas painting when no samples arrived, the displayed elapsed second is unchanged and resize has not invalidated the canvas.
- src/components/WaveformStrip.test.tsx: five focused regressions covering idle redraw/timer, incoming batches, resize, bounded history with a one-sample peak, source replacement and unmount cleanup.
- This report.

Sample reads still occur on every animation frame. Incoming samples are consumed and history updated before the guard. Sample geometry, literal path, history bounds/copying, colors, 44px height, timer format, now edge and composer controls remain unchanged. No new sampling/downsampling/ring representation or scheduling system.

## Measured before changing source

Actual component mounted with instrumented canvas and controlled RAF/clock. Retained history7500 samples,750 samples/sec,10-second window,60 frames within one elapsed second:

| Scenario | Before paints / lineTo calls | After paints / lineTo calls | Source reads |
| --- | --- | --- | --- |
| No new samples | 60 / 450060 | 1 / 7501 | 60 before and after |
| 75-sample batches at10Hz | 60 / 450060 | 10 / 75010 | 60 before and after |

The second case removes83.3% of drawing operations while retaining each input batch. These are measured canvas-call counts, not CPU timing or FPS results. Baseline source captured before edits at /tmp/U1-WaveformStrip-before.tsx.

Reliability independently reproduced the reduction on600 steady-state frames:4500600→757601 lineTo calls,600→101 paints (timer transitions can add a paint). Its60-frame no-new-data interval dropped450060→7501 calls and60→1 paints. DPR/resize, source/config replacement, history reset, and RAF/listener cleanup passed. See R1-waveform-performance.md for independent method/results.

## Visual and regression verification

Explicit synthetic/no-microphone/no-inference fixture: http://127.0.0.1:1423/waveform.html. It renders the captured original and current actual components side by side with identical deterministic source batches. Desktop canvases616×44 CSS px and narrow canvases171×44 CSS px had identical pixel buffers at the sampled frames; both screenshots inspected. Narrow viewport390 had scrollWidth390. The comparison grid initially retained intrinsic canvas widths; fixture tracks were corrected to minmax(0,1fr) before the narrow check. No production layout change was required. Viewport restored.

Style check and production frontend build passed. Full frontend suite82 files /391 tests passed. Reliability separately ran the waveform plus microphone focused suite (12 tests). Code Quality found no actionable issue in the bounded source/tests and independently checked the scoped diff.

## Limits and deferred work

No native/mobile recording, device CPU/FPS benchmark or crash reproduction. This is a redundant-draw fix, not evidence that choppiness, a white flash, memory behavior or a crash is fixed. Real incoming batches still draw the full retained path; envelope/ring changes remain deferred pending measurement. No microphone-hook/CSS/native/server edits, app/server restart, paid inference, deployment or Git mutation.
