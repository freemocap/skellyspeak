# Drill spectrogram resolution measurements

Status: measured locally, 2026-09-26. Settings panel below is a proposal, not an
implemented feature. The measured baseline below is historical. Subsequently approved and implemented:
production now uses 256 bands, 10 ms hops and a 2,400-frame offline cap. The
settings panel remains a proposal.

## Baseline measured before the increase

The shared native kernel uses 128 HTK mel bands, 50 Hz to 8 kHz, Hann windows,
20 ms frame spacing and at most 1,200 offline frames. Ten seconds yields 500
columns. FFT length rounds 50 ms up to a power of two: 1,024 samples / 64 ms at
16 kHz, or 4,096 samples / 85.33 ms at 48 kHz. Increasing mel bands refines the
filter grid; increasing frame rate samples time more often. Neither changes the
underlying FFT frequency resolution. Higher detail requires distinguishing these
choices from changing the window, which changes the time/frequency tradeoff.

## Measurement

Reproducible ignored test: `spectrogram::benchmark::ten_second_resolution_cost`.
Run from the repository root:

```powershell
cargo test --manifest-path native/Cargo.toml --config 'profile.test.package.skellyspeak.opt-level=3' --lib ten_second_resolution_cost -- --ignored --nocapture
```

The application crate is optimized at level 3; dependencies use the existing test
profile. Cargo's overall profile label still says unoptimized. These are optimized
kernel measurements, not measurements of the running development app or a full
release build. Machine identifier: Intel64 Family 6 Model 151 Stepping 2, Windows.
Two benchmark passes were run; the second pass medians are below. Each case uses
ten measured iterations after two warmups on ten seconds of deterministic
harmonics with a varying envelope. Timed computation includes filter/window
construction, FFT, mel aggregation and output allocation. WAV decoding, IPC,
transcription and canvas painting are excluded. JSON encoding is timed separately
and is not a production-release encoding benchmark. Other local work may affect
wall time; ranges are reported for the 48 kHz cases.

| Detail | Bands | Columns at 48 kHz | 16 kHz compute ms | 48 kHz compute ms | 48 kHz min?max ms | JSON ms | JSON bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| Current | 128 | 500 | 22.85 | 52.52 | 49.58?59.70 | 11.10 | 522878 |
| Frequency +50% | 192 | 500 | 30.93 | 60.99 | 59.66?66.68 | 17.00 | 776969 |
| Frequency doubled | 256 | 500 | 36.68 | 71.09 | 69.23?99.81 | 21.93 | 1029967 |
| Time +50% | 128 | 750 | 31.15 | 79.50 | 76.15?88.87 | 16.76 | 788460 |
| Time doubled | 128 | 1000 | 42.44 | 105.07 | 103.38?117.52 | 22.88 | 1038215 |
| Both +50% | 192 | 750 | 49.91 | 101.38 | 89.99?125.96 | 30.03 | 1166197 |
| Both doubled | 256 | 1000 | 94.76 | 149.44 | 137.79?187.10 | 46.22 | 2041163 |

At 16 kHz, integer hop rounding produces 752 columns for the 75 frames/second
cases. Results contain actual frame times. More detail increases IPC payloads and
canvas work as well as kernel cost. Live update and browser-render costs still
need measurement before selecting a higher default. Existing analysis tests pass
(16 tests; the benchmark is excluded by default); default fixture output remains
unchanged.

## Proposed Drill settings

A dedicated Drill settings button opens a compact side panel, following the
conversation settings interaction pattern but owning Drill controls. Group:

- Display: color map and displayed dB floor/ceiling, shared across all three plots.
- Detail: separate time and mel-band presets (current, +50%, doubled), with actual
  hop, bands and window metadata visible in secondary details.
- Recording: existing threshold/pause controls, preserving their existing owner.

The settings apply consistently to target, attempt and live recorder. Color-map
changes repaint existing data. Resolution changes must recompute retained audio
and keep the old plot visible until replacement data is ready. Increasing canvas
size alone must not masquerade as increased analysis detail. Bound memory/frame
counts for long recordings and avoid synchronous recomputation in the UI.

Pending user preference: remember these settings across all Drill phrases
(recommended), or per phrase. Storage and contract changes are not selected yet.
A +50% preset appears affordable in kernel time on this machine; default changes
remain separate from offering an optional control.
