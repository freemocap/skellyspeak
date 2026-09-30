# Practice reference word timing lost during streamed synthesis

Status: source fix and regression verification complete. Server deployment and
regeneration of the affected cached reference remain pending. No commit or release.

## Observed evidence

The local run at 20:14 UTC had no useful reference-alignment event in its log
files. A narrowly scoped, read-only inspection of its recent speech receipt and
cached speech result supplied the missing evidence. No database export was made.
The receipt retained timestamp arrays in the first two chunks, followed by two
chunks with null alignment. Completion reported both timing lanes unavailable
with reason `not_supplied`. The cached result contained audio and source identity,
but neither original nor normalized timing. No private text/audio is copied here.

The second timestamp array spanned 0.72–1.36 seconds; the entire recording was
1.36 seconds. These timestamps use the recording clock. Treating them as offsets
within that audio frame both rejects valid timing and adds an incorrect offset.

## Cause and implementation

The synthesis stream accumulator treated any absent per-frame alignment as a
failure of the entire recording. It also validated timestamps against individual
frame duration and offset them by the amount of preceding audio.

The corrected accumulator:

- Treats null frame alignment as no additional words, preserving previous timing.
- Keeps malformed or unordered timing explicitly unavailable; later empty frames
  cannot conceal that reason.
- Accumulates recording-relative timestamps unchanged and validates their upper
  bound against completed audio duration. Interim timing remains resource-bounded.
- Converts timing to the existing frame-relative app protocol only when every
  interval fits that frame. Timing ahead of audio remains available in the final
  recording projection, without inventing or clamping intervals.

No app runtime or protocol change is required. The practice inspection already
converts valid completed alignment into word overlays. Attempts use transcription
timing, so they did not depend on the broken synthesis accumulator.

## Verification and remaining work

- 27 synthesis stream/alignment tests passed, including audio-only tails,
  ahead-of-audio timing, recording-clock accumulation, frame-clock projection,
  malformed/unordered timestamps and timing past the end of completed audio.
- A native regression passed from stream completion through speech cache encoding
  and decoding into reference inspection; both words retain their exact times.
- 64 practice page/comparison tests passed. The test environment reports existing
  canvas-context limitations; these tests do not prove visual canvas rendering.
- Fast repository validation passed.

The server fix has not been deployed. Existing cached results with missing timing
cannot recover discarded source timestamps by replaying their audio. After
server deployment, regenerate the affected reference via targeted cache cleanup;
do not delete practice attempts, conversations or unrelated cached results.
