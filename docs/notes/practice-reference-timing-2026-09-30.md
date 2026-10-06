# Practice reference word timing lost during streamed synthesis

Status: October 6 native correction and automated verification complete; see the
latest follow-up below. Rebuilt-app visual verification remains pending. Earlier
server-deployment and endpoint-tolerance statements describe historical fixes.
No commit or release.

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


## Follow-up after the native relay audit

The local version 3 runtime reproduced missing reference words. The latest saved
practice speech result had valid playable audio (4.96 seconds) but both alignment
lanes had been discarded with `timing_exceeds_audio_duration`. Another saved result
provides exact numeric evidence: final provider end 6.720000000000001 versus PCM
duration 6.72. Additional streams ended in three empty alignment arrays; the native
accumulator incorrectly marked these audio-only tails as malformed, invalidating
previously received timing. The audit regression fixtures covered null tails and
exact decimal bounds, missing these two real response shapes.

Implemented: treat only three parallel empty arrays as an absent timing update;
keep malformed/mismatched arrays invalid. Permit eight floating-point epsilons
scaled by duration at the audio boundary. Preserve provider times in alignment;
clip projected word intervals to the actual duration within that tiny allowance.
Meaningful overruns still fail. Validation diagnostics now include audio duration,
maximum timing end and character count without source text or audio.

Regression checks cover both cases together and carry the resulting timing through
cached speech decoding and reference spectrogram word attachment. Existing bad
cache entries cannot recover timestamps already discarded by the old validator;
the affected reference must be regenerated. No server change is needed.

Verification for this follow-up: the three timing-accumulator tests and the full
stream/cache/reference-inspection regression passed. Shared alignment tests also
passed. With the application closed and its exclusive workspace lock held, removed
one invalid reference result and its unshared derived cache data; retained practice
items, attempts, execution receipts and other audio. The local development app was
rebuilt, signed and relaunched successfully. Visual confirmation of regenerated
reference words remains a user check. No server changes or deployment were needed.


## October 6 recurrence: approximate generated endpoints

The current local saved results include three v4 Turbo clips with durations
5.28, 5.60 and 5.84 seconds and maximum timestamp ends 5.36, 5.68 and 5.92.
Both timing lanes were discarded as `timing_exceeds_audio_duration`. The 5.60
second result matches the duration shown in the reported screenshot. This was
confirmed by read-only queries of execution diagnostics and cached audio shape;
no live workspace records were modified and no source text/audio is copied here.
This investigation did not audit all historical run logs.

The learner explicitly rejected treating generated timestamp endpoints as exact
measurements. This supersedes the endpoint-tolerance policy described above.
Implemented behavior now preserves structurally valid finite, ordered provider
intervals regardless of their relationship to the recording endpoint. Source
identity, bounded arrays/text and malformed-data checks remain. Word inspection
clips display intervals to the recording, retains `providerStart`/`providerEnd`,
and sets `clipped`. Diagnostics report `display_clipped_to_audio` with the raw
maximum endpoint and recording duration. No timestamps are stretched or inferred.

Existing cache entries with timing discarded by the old endpoint validator are
not reused on the next speech request, unless another timing lane was retained.
Their receipts and blobs are not deleted. Opening practice performs a cache read,
not inference; explicit reference playback can generate the replacement. New
clipped results are reusable, so endpoint differences do not cause repeated calls.
No server deployment or database-format change is required for this correction.

Practice now starts in Tap mode, matching conversation's default. Both currently
keep mode in page state rather than a durable shared preference; Auto and Hold
remain explicit choices. Auto-specific regression tests now select Auto.

Release-blocker cleanup removes unused ActionReport/ActionCounts prototypes
whose functionality and paging test already exist in the wired Effort owners,
regenerates native gloss fixtures, updates README's format number to 54, and
removes the extra stylesheet EOF blank line. No version bump, commit or release.

Final verification:

- Root `npm test`: fast gate passed; 1,866 UI tests passed across 278 files.
- Root `npm run build`: passed.
- Final native library suite with `--test-threads=4`: 845 passed, five ignored.
  The default-parallel run passed 844 but one unrelated mock transcription test
  exceeded its five-second request deadline. That test passed alone, then the
  complete four-thread suite passed. No deadline or assertion was weakened.
- Clippy for library/tests with warnings denied, generated contracts, benchmark
  fixture freshness, documentation links and diff whitespace: passed.
- End-to-end regression covers stream decoding, cache serialization and reference
  inspection across six scripts/encodings, with roundoff, 80 ms and one-second
  endpoint overruns; original provider times survive and display clipping is marked.
  Existing multi-frame/empty-tail and malformed-timing regressions remain.

A rebuilt-app visual check of regenerated reference overlays remains distinct
from this automated coverage. No live synthesis or deployment was performed.
