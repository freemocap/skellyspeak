# Frontend reliability remit and initial microphone review

User explicitly expanded Reliability sweeps to frontend/UI memory bounds, rendering
efficiency, resource cleanup and fragile reused code. Reported symptoms: choppy
mobile audio display and intermittent white-screen flashing/crash, possibly while
recording. Device/version/timing are not established; asked the user for that
context. No causal link is established between those symptoms and this component.

Integration authorizes bounded read-only review while Interaction's difficulty/
Profile slice is active. No production edits, runtime launch, mobile session,
provider requests or Git writes. Current desktop test results are not mobile proof.

## Source evidence: microphone display

- `src/hooks/useMicRecorder.ts` polls every100ms, excludes overlapping mic_wave
  requests and keeps only8192 frontend samples. It checks recording identity before
  appending late chunks. Recording generation prevents late startup/transcription
  from entering another conversation. Timer cleanup and native cancellation exist.
- `src/components/WaveformStrip.tsx` retains a time-bounded history, cancels RAF and
  removes the resize listener on cleanup. No normal unbounded sample array found.
- `src-tauri/src/audio.rs` downsamples waveform by64, caps native wave backlog8192
  and bounds PCM recording at120seconds. The frontend renders native waveform rate,
  not raw48kHz PCM. Do not diagnose an unbounded PCM leak from waveform appearance.

### Review candidate: redundant rendering and visible update cadence

GuidedPage passes timelineSeconds10. At48kHz capture the reported waveform rate is
750samples/s, hence7500 points after ten seconds. WaveformStrip traverses and draws
that entire history on every RAF, even when no new samples arrived. At60Hz this is
approximately450000 waveform line/point operations per second, plus fills/text.
It also copies history with concat/slice on incoming data. Input updates at10Hz;
RAF redraw alone does not interpolate scroll between those updates. This is a
source-demonstrated work pattern and a plausible choppiness contributor, not a
measured frame-time regression or crash diagnosis.

Proposed bounded Interaction-owned follow-up after its active slice freezes:
retain a fixed ring/envelope representation and render min/max per display column
so work scales with visible width while preserving narrow peaks and elapsed-time
meaning. Avoid drawing identical frames unless moving the time axis deliberately.
Check actual device performance before choosing frame rate or animation changes;
no UI redesign requested. Use container-aware resize only if measurements/layout
reproduction show viewport resize misses actual composer geometry changes.

A useful test should prove bounded retained data across long input and a bounded
number of draw primitives as input history grows, plus cleanup after unmount/source
replacement. Do not assert a particular private array implementation, every canvas
call, or arbitrary timing that does not establish a performance budget.

## Crash evidence still missing

No crash log/device/session was inspected or reproduced in this review. Existing
useMicRecorder tests cover ownership and late completions, but no WaveformStrip
resource/performance test was found. A white screen could arise outside JS (for
example a terminated WebView process); that is a hypothesis requiring platform
crash evidence, not an explanation established here. First identify installed
released app versus current rebuild, device/OS and timestamp. Read corresponding
shared run logs or platform crash record without logging transcripts or secrets.
Do not change server/native lifecycle or increase buffers as a speculative fix.

Future hourly sweeps should include changed frontend subscriptions/timers/RAF,
recording/playback/object-URL cleanup, retained collections and rendering costs,
with precise ownership and stable snapshots. Existing bounded resource mechanisms
should be preserved; fix demonstrated gaps rather than recreating broad suites.
