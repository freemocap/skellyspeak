# Drill page redesign — mockup

Status: **implemented**, 2026-09-26. The consolidation this file proposes is in
the application. The mockup is kept as the record of what was agreed, and this
file records what shipped and where it differs from the drawing.

## Generator rollback, 2026-09-26

At the user's direction, restored the generator prompt, schema, request contract,
output budget, native response validation and preview acceptance to HEAD. Restored
the original generator form and labels, including the 20-target limit. No batching.
Removed the unfinished error-redaction experiment. Other Drill UI work and native
Chat/Drill persistence remain. Earlier generator sections below are superseded.

Verification: provider-facing generation source and prompt match HEAD byte-for-byte;
15 native generation tests, 15 add-dialog tests and 47 Drill page tests pass, with
application TypeScript passing. Native contracts regenerated. No live provider
request was made; runtime resolution of the HTTP 400 remains unverified.

## End-of-day generator cleanup, 2026-09-26

Implemented: removed per-category length sliders, targetSize request field,
slider prompt instructions and slider-only CSS. Difficulty now appears first in
the generator settings. Retained Words/Phrases/Sentence/Multiple sentences and
chat lines, quantity up to 99 and native Chat/Drill persistence. No commit made.

Verification: 22 generator/navigation UI tests pass; TypeScript and style checks
pass. Contracts regenerated. The native generation suite passes (17 tests).

Unresolved: recorded Drill requests at 2026-09-27 00:47:58, 00:48:05 and 00:49:45
UTC returned OPENROUTER_HTTP_400 from Google for google/gemini-2.5-flash. Their
captured inputs requested four words, with the now-removed targetSize=1. The
provider raw reason and provider_error_code were already redacted in persisted
receipts, preventing diagnosis of the rejected parameter from local evidence.
These failures were not caused by requesting 99 items; the schema change remains
one unconfirmed possibility. No paid retry, deployment or speculative provider
change was performed. Removing sliders is not proof this error is fixed.

## Words minimum, 99 targets and durable practice destination, 2026-09-26

Implemented: Sounds is removed from the offered categories and sound requests
are rejected before generation. Words is the smallest supported target. The old
sound provenance tag remains readable so existing saved targets/attempts do not
break; no new sound generation is available. The sound-specific prompt and
validation were removed. Alphabet/letter work remains deferred.

The quantity control, native request validation, response schema, response-count
validation and bulk acceptance now permit 99 targets. Output allowance scales
with the requested count within the existing provider allowance. A provider may
still return fewer items; the existing shortfall report remains explicit.

Chat/Drill selection is written immediately through an ordered native write queue
into learner preferences. Startup reads this workspace value before rendering;
browser storage remains the browser-preview behavior, not native restart authority.
A late startup read cannot replace a newer selection. Save/load failures use the
existing visible fault reporting. No database reset or schema migration is needed.

Verification: 22 focused UI tests, 18 generation tests and the native database-reopen
navigation test pass; TypeScript, localization and style checks pass. Contracts
regenerated. Native changes require restarting the application. Actual desktop
shutdown/relaunch was not exercised in this verification.

## Generator checkpoint; letters deferred, 2026-09-26

Implemented: removed Letters/Add alphabet from the generator, the Letter request
variant, alphabet-specific limits and validation, provisional local inventory,
native command and IPC adapter, and associated tests/localization. Retained Sounds,
Words, Phrases, Sentence, Multiple sentences, chat-line selection, per-category
length preferences and drill-target terminology. Each checkbox and slider now
shares one row; Short/Long headings appear once above the slider column.

Verification: 64 focused UI tests and 17 native generation tests pass. Application
TypeScript, localization, styles and preview checks pass. Contracts regenerated.

The alphabet section below is superseded: none of its alphabet behavior remains.
Future work needs reviewed language/orthography teaching-set configuration that
handles alphabets, marks, syllabaries and non-alphabetic writing systems explicitly.
Chat/Drill native restart persistence was investigated but not implemented during
this work; existing browser-local selection persistence remains unchanged.

## Alphabet selection and category length controls, 2026-09-26

**Superseded by the checkpoint above; alphabet functionality removed.**

Implemented: the outer random-selection button reads Target. The add dialog now
lists Letters (Add alphabet), Sounds, Words, Phrases, Sentence and Multiple
sentences. Each non-letter category has its own five-position Short-to-Long
slider, retained when toggling categories within the dialog. Generation quantity
remains separate. The native request stores and validates targetSize and includes
it in the prompt; it is a relative preference, not a verified token count. Sentence
stays one sentence; Multiple sentences requests two through six sentences.

Add alphabet requests the conventional full letter inventory for the selected
language/variety, independent of count, topic, skill or difficulty. The generated
preview uses the existing Keep all acceptance flow. Alphabet requests permit up
to 128 entries and bulk acceptance supports that limit. Normal generation remains
limited to 20. Existing saved letters are omitted as duplicates. Missing inventories
and malformed alphabet entries fail explicitly rather than publishing a malformed
partial set. Alphabet completeness remains a model claim, not independently
verified reference data; no live provider request or linguistic audit was performed.
The prompt explicitly refuses arbitrary subsets for writing systems without a
finite alphabet/basic letter inventory. Earlier Phonemes labels below are superseded
by Sounds; the sound-generation policy remains in place.

Verification: 65 focused UI tests and 20 native generation tests pass. Tests cover
independent sliders, count-independent alphabet selection, 60-entry bulk acceptance,
length preference propagation and invalid/unavailable inventories. TypeScript,
localization, style and preview checks pass. Native contracts were regenerated.
Restart the native application to load the new request variant and prompt.

## Drill targets and phoneme generation, 2026-09-26

Implemented: general Drill-facing labels now say drill targets; phrases remains
one specific target category. The full add dialog offers Phonemes, Words, Phrases,
Sentences, Several sentences and the existing chat-line source. All seven interface
locales and the tour use the new labels. Internal identifiers and saved-selection
keys remain unchanged.

Phoneme requests use the existing generation, preview and acceptance flow. The
shared prompt requests one speech sound represented in the normal writing system,
not a letter name, word or substitute syllable. It preserves combining marks,
requests a sound explanation and reading context, and permits fewer results when
suitable isolated representations are unavailable. Native validation requires a
nonempty explanation and rejects whitespace-separated units. These structural
checks do not prove phonetic correctness; semantic suitability remains generated
information. Preview explanations use the existing translation field.

Verification: 16 native generation tests pass, including all length variants and
source-preservation cases across scripts. The 111 relevant UI, tour and localization
tests pass across the initial run and corrected-label rerun. Application TypeScript,
localization and preview checks pass; native contracts were regenerated.

Not verified: live provider generation or isolated-sound playback accuracy. Reference
speech and transcription matching still use existing providers; this does not add
phoneme-level pronunciation grading. Restart the native application to load the new
request variant and prompt. The earlier add-dialog section below describes the
previous labels; its direct-opening behavior remains implemented.

## Add phrases opens the full dialog directly, 2026-09-26

Implemented: the toolbar Add phrases action opens the existing wide AddPhrases
dialog immediately. Deleted the intermediate add dropdown, its single-line form,
mode/prop branches, page creation handler and unused styles. Phrase selection
retains its dropdown. Updated the tour and preview compositions for the removed
panel. The full phrase-generation dialog is unchanged.

Verification: Drill page, AddPhrases and tour suites pass, including a direct
modal-opening regression. Application/preview TypeScript and style checks pass.

## Restore the selected phrase from the workspace, 2026-09-26

Implemented: initial phrase loading reads the most recent surviving Drill visit
for the selected language from the native workspace database. Closed/interrupted
sessions remain eligible; archived/deleted phrases do not. Existing current-page
selection and explicit creation selections retain their reload priority. Webview
local storage is only a fallback when no durable visit exists. The list waits for
both native reads before selecting anything, preventing an initial first-phrase
visit from overwriting the remembered position. Existing visit recording provides
persistence without a new schema or a shutdown-only write.

Verification: 46 Drill page tests and two IPC registration tests pass; four native
session tests pass, including closing/reopening the database, language isolation,
and deleted selection handling. A delayed-startup UI test verifies that stale
webview storage cannot replace the native selection. TypeScript passes; native
contracts were regenerated to include the new command diagnostic identity.
Restart the native app before testing the new command. A phrase must have entered
its saved Drill visit for native restoration; selection errors remain visible.

## Live spectrogram performance, 2026-09-26

Measured contributors: live analysis inherited the completed-clip 256-band/10 ms
resolution; spectrum polling allowed only five updates per second; the rasterizer
repeatedly painted overlapping FFT windows; clipping recalculated a full spectrum
synchronously on the capture loop, although the transcription inspection stage
already computes it on a blocking worker.

Implemented: live analysis uses 128 bands and a 20 ms hop. Completed inspection
remains 256 bands and 10 ms (with the existing long-recording frame cap). Spectrum
polling is every 50 ms with one request in flight. The canvas uses a 256-entry color
lookup table and paints only each frame's visible portion before the next frame
overwrites it, preserving true unsampled gaps. Immediate clip previews reuse
retained live frames, rebased to the trimmed clip's original audio clock. Native
live retention covers the maximum take plus maximum pause and one-second margin;
only the latest twelve seconds are sent for the running display. Full-resolution
analysis remains in the existing transcription worker. Audio samples and clip
boundaries are not reduced in resolution.

Local debug measurements (48 kHz, deterministic 20-second signal): prior live
analysis 4.568 s; lower resolution 1.345 s, then 1.530 s in the broader suite.
A 200 ms delta decreased from 60,867 to 21,092 serialized bytes, and encoding from
2.071 ms to approximately 0.6 ms. These are CPU/serialization measurements, not
measured screen frame rates. Polling now targets 20 Hz rather than 5 Hz.

Verification: 64 native speech tests pass (one explicit benchmark ignored),
UI spectrogram/recording/Drill tests pass, and application TypeScript passes.
Tests cover preview axes and frame values, delta bounds, long-clip retention,
completed high-resolution analysis, overlap colors and transparent gaps.
Actual microphone/display smoothness remains for in-app verification. Restart the
native app to load the changed live analysis and clip-preview code.

## Continuous sample-controlled scrub, 2026-09-26

Implemented: replaced the media-element controller with one AudioWorklet output
and one continuous PCM read head. Pointer positions are converted to source sample
positions. Each movement replaces the read head's destination and interpolates
from its current position over the pointer interval plus 8 ms, bounded to 8-40 ms.
Forward targets do not rewind the read head or queue overlapping snippets. The
head lands exactly on the destination and then produces silence. Backward movement
reverses that same head. Linear sample interpolation changes pitch with speed;
there is no pitch-preserving time-stretch stage or independent playback clock.
A 32-output-sample envelope reduces clicks at the beginning/end of motion.

The source is decoded once per player. Loading anchors at the latest pointer
position without replaying old movement. Gesture release mutes the gain and stops
the processor; capture/lifecycle interruption uses the existing playback authority.
Disposal closes the port, disconnects nodes and closes the audio context. Word
recognition timestamps are not inputs to the audio engine; only the existing
inverse display mapping determines which source position the pointer selects.

Verification: 70 focused and Drill integration tests pass and application TypeScript passes. Rendered
PCM tests check forward ordering and one traversal of an embedded audio marker
at 0.25/0.5/1/2/4x movement speeds, varying speeds, differing source/output sample
rates, exact endpoints, reverse movement, silence, and release. Playback lifecycle
tests cover one worklet connection, decoding reuse, delayed readiness, capture
exclusion and processor failures. The actual worklet message/render test verifies
one output stream, amplitude without doubling, and endpoint/release silence.
Vite production build emits the scrub worklet
successfully (existing large-chunk advisory remains). Device listening remains
unverified. The interpolation horizon and audio-device output latency remain;
this is not a zero-latency claim. Large jumps compress audio rather than creating
a backlog. Linear interpolation may alias at extreme speeds.

## Retained player with source-time tracking, 2026-09-26 (superseded)

Implemented after continued desynchronization reports: removed the repeated
40 ms backward seek and repeated player destruction. One HTML audio element and
blob URL are retained per source. Forward movement updates a destination instead
of repeatedly resetting playback. The rate uses source-time distance divided by
pointer-event elapsed time, plus proportional correction for source-time error:
`rate = clamp(velocity + 8 * (remaining - 0.020), 0.25, 4)`.
Pitch preservation is explicitly enabled. A gap over 120 ms seeks near the latest
destination instead of queuing stale audio. Backward movement repositions a
forward preview; it does not reverse samples. At the destination the player pauses;
fresh movement reuses it. Idle and release pause without unloading audio.
The source position still comes from the inverse of the displayed word warp.

Verification: 16 focused tests pass, including simulated progressing audio clocks
at 0.25/0.5/1/2/4x pointer speed and changing speeds within one word. They assert
bounded source-time error, endpoint completion, no repeated player creation,
continuous forward progress, idle/release, delayed loading and capture exclusion.
Application TypeScript passes. Simulation cannot establish browser pitch-stretch
latency, audible quality or accuracy of recognition timestamps. Those remain
unverified in the running app; sample-exact synchronization is not claimed.

## Bound normal-speed preview to the pointer, 2026-09-26 (superseded)

Implemented: preview starts at most 40 ms before the latest source position,
keeping normal forward playback and pitch. Every movement replaces that window.
Audio-clock observations correct lag beyond the window (5 ms correction tolerance)
and stop playback at its end. A timer based on the remaining source time also
ends the preview between clock observations; changing position cancels the old
boundary. The 60 ms idle safeguard still cancels stalled/loading previews.
No drag-velocity pitch scaling or reverse audio is used.

This bounds the preview near the pointer instead of letting the ordinary playback
clock advance independently. It intentionally has up to 40 ms of source lookback;
HTML media scheduling and device latency prevent a sample-exact guarantee.
Verification: 15 focused playback, hook, coordinate and cursor tests pass, plus
application TypeScript. Added cases exercise slow movement, lag correction,
fast jumps, backward movement, replacement of old cutoff timers, and source-start
clamping. Physical listening remains unverified.

## Stop preview on stationary holds, 2026-09-26

Implemented: normal-speed drag playback now stops after 60 ms without a changed
source position. Horizontal movement renews the deadline; repeated coordinates
and vertical-only movement do not. The gesture remains active, so fresh movement
restarts the preview. Pointer-down immediately pauses pre-existing transport
playback. Release/cancel still stops immediately. The small idle tolerance keeps
ordinary playback continuous between pointer events; this is not a sample-exact
cutoff at the cursor. No pitch shifting or reverse audio was restored.

Verification: focused playback, hook, cursor, comparison and page tests pass,
along with application TypeScript. Tests cover click/hold, move/hold without
release, unchanged-coordinate events, continuous movement, delayed readiness
following idle cancellation, and resuming movement. Audible feel has not been
verified on a physical device.

## Normal-speed drag playback restored, 2026-09-26

Implemented after listening feedback rejected the scratch implementation below:
removed PCM grains, velocity-dependent pitch and reverse playback. Dragging now
seeks one ordinary forward audio player at normal speed. It plays continuously
while held, matching the earlier interaction. Release, cancellation or lost focus
stops it, including transport playback already running when the drag began.
Paused clicks remain silent. Delayed readiness cannot restart a released drag;
metadata loading uses the latest selected position. Cursor warp/RTL math remains.

Verification: 69 relevant tests pass across the focused suites after correcting
the new test setup; the added page-level release-to-pause assertion also passes.
Application TypeScript passes. Physical listening remains for application review.

## Pointer-driven scratch playback, 2026-09-26 (superseded)

Superseded following listening feedback. This experiment replaced the seek-and-timer preview below with decoded PCM playback
on the Web Audio clock. Each pointer movement plays the source interval it crossed;
backward movement uses a reversed buffer. Playback rate is source-time distance
per elapsed pointer-event time, bounded to 0.125-8x. Each interval ends at the
pointer's source-sample boundary. Delayed/large movements retain only the newest
40 ms of output, and supersede previous sound with a 3 ms de-click tail. Holding
still cannot advance beyond the crossed interval; releasing stops all voices.
There is no playback queue or wall-clock timer controlling an HTML audio element.

The cursor inverts the same display warp used by the spectrogram, including
intermediate word-alignment animation and RTL coordinates. Reverse offsets use
`(buffer.length - sourceStartFrame) / sampleRate`; source duration is independent
of playback rate, and output duration is source duration divided by rate. Decoding
is cached per source. Movement received before decoding finishes is discarded,
so readiness cannot play stale gestures. Capture, lifecycle suspension and source
replacement stop playback. Existing transport playback retains its seek behavior;
scratch playback applies while paused and does not automatically resume on release.

Verification: 65 focused domain, playback, cursor, comparison and page tests pass,
as does the application TypeScript check. Tests cover sample boundaries at four
sample rates, direction reversal, large jumps, warp inversion, RTL dragging,
delayed decoding, suspension and scheduling failures. The DOM suite reports its
existing missing-canvas implementation messages. Physical audio and subjective
scratch feel have not been verified in the running application.

## Bounded scrub windows, 2026-09-26 (superseded)

Superseded by pointer-driven scratch playback above. The prior implementation
made paused drag previews start at most 120 ms before the pointer and
stop at the pointer position. A stationary pointer does not loop or restart audio;
a new position opens another window. The cutoff follows observed audio time and
uses a playback-rate-adjusted timer once the audio clock advances, so loading time
does not consume the preview. Moving updates the window and clears its old cutoff.
Release/cancellation still stops immediately; playback already running before the
drag retains normal seeking behavior.
Verification: 12 focused scrub/cursor/comparison tests and TypeScript pass, with
the final cutoff suite rerun after guarding delayed startup. Tests cover stationary
holds, backward movement, rate adjustment, start-of-file clamping and no automatic
restart. Device audio timing remains unverified; browser scheduling is not a
sample-accurate audio boundary.

## Audible dragging without automatic resume, 2026-09-26

Implemented: dragging the plot cursor or reference range slider previews retained
audio while held. Preview has its own cancellable playback lifetime and does not
change the normal paused state. Releasing, canceling, losing capture/focus, changing
source, starting capture or unmounting ends it. Pre-existing playback continues
through a drag; the normal seek path owns that clock. Plain plot clicks and
keyboard seeks remain silent when paused. Late player readiness uses the latest
pointer time and cannot restart a released preview. The cursor now uses a bright
green spectrogram-specific token and matching glow, with a dark contrasting halo.
Verification: 55 focused tests pass (54 combined, then a new release/cancellation
regression with the scrubbing suites), plus application/preview types and styles.
Audible behavior on a physical device was not exercised in this pass.

## Paused seeking and full-plot hit target, 2026-09-26

Implemented: seeking changes the target/attempt cursor without starting playback.
An active player seeks in place; a paused plot retains its position until Play,
which resumes there (completed playback restarts from zero). The spectrogram
slider hit target covers the entire plot, so clicking or dragging anywhere seeks
through the same RTL/word-alignment mapping as dragging the cursor. The visible
cursor remains a narrow glowing line.
Verification: 51 focused tests, TypeScript and styles pass. Regressions cover
paused seek without player creation, explicit playback from the selected offset,
active seeking, full-plot pointer coordinates, aligned mapping and RTL keyboard
seeking. Device playback and browser appearance were not exercised in this pass.

## Recording modes moved into settings, 2026-09-26

Implemented following the next user revision; supersedes the four-mode dock below.
The outer recorder has the main Record/Stop (or Hold) button, Auto detect takes,
and Recording settings, plus the existing meter/status. Removed the trash action
and outer mode strip. Settings contains three modes: Tap, Hold and Live. Tap/Hold
retain manual capture behavior. Live uses a separate detection boolean: toggling
it tunes automatic detection on/off without restarting capture or changing mode.
The toggle is disabled and unchecked in Tap/Hold; its Live preference is retained.
Mode choices remain unavailable during capture/startup. The default is Live with
automatic detection enabled. Preview wiring follows the same controls.
Verification: 53 UI tests, application/preview type checks, localization and style
validation pass. Native capture contracts did not change. Visual/device review
was not performed in this pass.

## Four recording modes and one main action, 2026-09-26

Implemented after user review; supersedes the auto-detection checkbox and separate
manual-clip action below. Tap starts a manual capture and Stop finishes the take.
Hold starts capture on press and finishes on release; short presses cancel.
Auto starts/stops continuous automatic takes. Monitor starts/stops the live
microphone and spectrum without creating takes. The main button, mode selector,
meter, discard and settings controls stay mounted; the duplicate record button
and checkbox are removed. Modes cannot change during capture or startup.

Hold release during asynchronous startup waits for capture readiness before
stopping, or cancels a short press. Owner changes invalidate pending hold work.
Monitor disables discard because it has no take to discard. Discard in manual
modes cancels recording; in Auto it discards the current take and keeps listening.
The preview uses the same four-mode controls. New labels are in all seven catalogs.
Verification: recording-mode, microphone and tour tests pass; application/preview
TypeScript, styles and localization checks pass. Live visual verification could
not run because browser surfaces were unavailable. Device recording was not
exercised in this pass.

## Doubled detail and explicit auto detection, 2026-09-26

Implemented: the shared spectrogram kernel now uses 256 mel bands and 10 ms hop
spacing for live and completed audio. The offline frame cap doubles to 2,400;
longer recordings remain bounded. FFT window and frequency range are unchanged.
The native-generated preview fixture was regenerated. Analysis tests verify
live/offline equivalence, 256 bands, 100 columns per second and bounded history.

Expanded card borders use the same status-line tokens as word underlines:
complete measured match is blue, zero match red, and partial/unscored results
orange. This is presentation only; no scoring thresholds were introduced.

The recorder now exposes a native checkbox labeled Auto detect takes. Unchecking
it selects monitor capture while keeping the microphone/live plot running;
checking it restores automatic detection without restarting capture. Existing
manual take controls remain available. All seven locale catalogs include the
label. Verification: 51 focused UI tests and 16 native analysis tests passed.
The higher native resolution requires restarting the running native app.

## Stronger selected surface and captured silence, 2026-09-26

Implemented: selected cards now have a 3 px standard border and a 480 ms entrance
with greater translation and scale change; reduced motion remains respected.
Before encoding, preview generation or transcription, every continuous-capture
clip (automatic, manual and explicit stop) is trimmed to its first/last active
20 ms energy frame plus up to 100 ms padding on each side. The current recording
threshold defines activity. Interior pauses are preserved; a wholly quiet clip
increments the ignored count instead of submitting empty audio. Live-clock start
and end boundaries are updated while cut time remains unchanged.
Verification: all 42 recording tests and style validation pass. Tests cover both
ends, internal pauses, short padding, partial frames, 8/44.1/48 kHz rates, selected
thresholds and silent clips. Native restart is needed to exercise capture changes.

## Selected card and playback controls, 2026-09-26

Implemented: expanded history cards hide their compact strip, show a subtle border
and animate into the main surface; inactive rows remain recessed. New publication
opens the newest scored take even after selecting an older one. Target/Attempt
labels replace Heard and the recorder button uses Record/Stop. Timing scale and
direction controls stay grouped. Playback cursors have a stronger glowing line,
pointer capture for dragging, keyboard seeking and inverse mapping through the
current word alignment. Word boundary lines are thinner. Reduced motion disables
card animation.
Verification: 56 focused tests pass, including new publication after selecting an
older take and aligned cursor dragging. Application/preview TypeScript and style
checks pass. Live microphone and audio-device playback were not exercised.

## History expansion in place, 2026-09-26

Implemented: the selected take expands immediately below its own history strip,
without changing chronological order. Selecting another take closes the previous
inspection and opens that row; new takes retain automatic selection. The expanded
header and inspection share the main sheet surface and shadow, against the recessed
history. Production, tour and offline preview use the same row composition.
Verification: 55 focused UI tests, application and preview TypeScript checks, and
style validation pass. Tests cover inline ownership, selection, unchanged order,
accessible expansion controls and recording publication. Native visual review was
not performed in this pass.

## History hover and phrase selection, 2026-09-26

Implemented: hovered and keyboard-focused history rows highlight; hovering a word
expands its full source text over adjacent cells without changing row geometry.
The expanded cell stays within the report/viewport and dismisses on leave, scroll,
resize or Escape. Phrase selection is remembered per practice language in local
interface storage, validated against the loaded phrase list, and replaced with
an available phrase if the saved one was deleted. Storage errors remain visible.
Verification: 47 focused tests, TypeScript and style checks pass, including
remount/restoration, deleted selections and hover dismissal. Live browser hover
and full native restart were not exercised in this pass.

## History token styling correction, 2026-09-26

Implemented in source: history cells now use the same soft status tint and darker
bottom border as the word tokens, replacing the saturated solid fills below.
The legend reads Matched, Uncertain and Not matched, with matching token and
spectrogram-marker labels. Show unscored sits after the history rows, aligned to
the trailing side of the legend row; it remains reachable with all rows filtered.
All seven locale catalogs include the new labels. The 50 focused Drill tests,
TypeScript, localization validation and style checks pass.

## Immediate clips and a fitted workspace, 2026-09-26

Status: implemented in source. Supersedes the recording-mode and plot-sizing
behavior in the earlier sections. No deployment or live microphone verification.

- Native capture retains bounded full-clip spectral previews before dispatching
  transcription. The latest clip appears in the comparison without waiting for
  the provider or saved-attempt inspection. Hydration keeps the same canvas;
  unavailable recognition does not remove the local plot. Preview failures are
  explicit and retryable. The preview cache retains at most four recent clips.
- A transient canvas copy travels from the live clip bounds to the comparison.
  Word overlays fade in. Fit is shown until reliable corresponding timestamps
  permit the preferred word alignment, which interpolates positions over 350 ms.
  Explicit scale choices remain respected; reduced motion disables transitions.
- Microphone start/stop is separate from automatic clipping. Auto is an on/off
  switch; Tap and Hold create manual clips while that same microphone remains
  live. Turning Auto off closes its current take and continues monitoring.
  Short Hold releases discard only the take. Every control remains mounted.
  Monitoring does not use the automatic silence timeout; session/queue limits,
  cancellation and playback exclusion remain in force.
- All Drill modes use the shared continuous spectrum path. Narrow layouts no
  longer hide the recorder spectrum. The retained timeline survives clipping and
  stop; switching boundary mode does not clear or restart it.
- The comparison uses two equal flexible plot rows with no main-panel scrolling.
  Dock resizing redistributes the available space; the independent plot-height
  handle was removed because it could force the comparison beyond that space.
  Detection details open over the plots. The working surface uses Chat's sheet,
  surface shadow and glow; the history uses a recessed shadow and chrome surface.
- History cells are 20 px high, with larger row gaps and saturated status fills.
  Coarse-pointer row targets remain 44 px; narrow labels still ellipsize or hide.

Verification: all 1,318 UI tests and 39 native recording tests pass. Coverage
includes a provider held pending while native clip previews already exist,
continuous canvas identity through publication, live Auto/manual switching,
and retained controls/spectrum. Production build, generated-contract check,
style checks and preview type-check pass. Headless desktop preview screenshots
were inspected at 1600 x 1000 and 1280 x 800; both plots and the recorder fit.
These are offline fixtures, not live microphone sessions. The full native lint
command is blocked by an existing `single_element_loop` warning in
`native/src/configuration/latin_language_tests.rs:71`; that unrelated test was
left unchanged. A native application restart is needed to exercise the changed
recording commands.

Responsibility review: `continuous.rs` remains above the preferred size because
it owns the capture session, bounded queue and publication lifecycle. The new
manual/monitor boundary policy is isolated in `clip_capture.rs`; this change
does not reorganize unrelated runtime ownership or the large Drill page suite.

## Recording stability and compact controls, 2026-09-26

Status: implemented in source; supersedes the collapsible rail and recording
control details in the prior follow-up below. Running-app visual review remains
outstanding; the supplied screenshots were used to identify the problems.

- Phrases opens a floating selection panel. Add phrases opens a separate panel
  for a typed phrase or the existing generation dialog. Neither consumes a
  permanent sidebar. Escape, outside click, selection and navigation close the
  appropriate overlay; phrase changes remain locked during capture.
- Record/Stop retains its button and control rows. The discard row is reserved
  when idle, counters exist before capture starts, and the dock border width
  stays constant. Microphone errors use a full-width overlay with dismissal,
  retry and expandable response details, outside the dock's layout flow.
- Visible window focus loss no longer cancels capture. Playback still stops on
  focus loss; capture stops on hidden visibility, page exit, native suspension
  or an explicitly suspending dialog. This fixes a concrete cancellation path;
  it does not establish that every observed microphone failure had that cause.
- Confidence caveats moved into Comparison details; report line spacing is
  compact. Attempt rows have vertical gaps and borderless separated cells,
  readable prefixes with ellipses, and color-only cells below label width.
  Cell gaps shrink with phrase length to avoid overflowing narrow reports.
- Unscored takes are hidden by default from selection and comparison, with a
  Show unscored control in the report. Records, diagnostics and deletion remain
  available; the filter does not discard data or change scoring. Segment badges
  were removed from the spectrogram; region counts and detection details remain.
- Word correspondence and alignment are unchanged in this pass.

Scoring investigation: native reliability requires detected speech, complete
supported confidence metadata, confidence at least 0.6, and no-speech probability
at most 0.6 when supplied. Missing confidence also produces Not scored, even if
recognized text looks plausible. These are declared product cutoffs, not
calibrated correctness probabilities. The text similarity metric is separate
from this gate and is not pronunciation evidence. A scoring redesign remains a
separate review; this pass does not weaken the gate or invent measurements.

Verification: all 1,317 UI tests pass, including visible-focus versus suspension,
unscored filtering, dropdown navigation, retained recording-control nodes and
out-of-flow microphone errors. Build, style validation and preview type-check
pass. Canvas pixels and actual dimensions are not verified by the DOM tests.
No live microphone session or new screenshot inspection was performed.

## Follow-up polish, 2026-09-26

Status: source implementation and automated verification; running-app visual
review remains outstanding. This section supersedes the report-pane and button
shape descriptions below. The HTML mockup remains historical design material;
`ui/tools/drill-live-preview.tsx` uses the current production components.

- The recording dock has a persistent timeline container, a larger Record control,
  and one row for mode selection and settings. Selected modes use a quiet tint.
  The timeline and comparison plots grow with their available panel space.
- Reference and take use one word-overlay renderer: text and word-start lines
  are drawn on the spectrogram. Cyan means a matched word, red means an unmatched
  reference word, and orange means an unmatched take word or unknown comparison.
- Display alignment uses an ordered common subsequence and stretches between
  matched starts. Repeated words stay in sequence. Playback and recorded times
  remain unchanged. Canonical equivalence, case and punctuation are ignored for
  correspondence; marks remain significant and source text is preserved.
- Missing, invalid or unsupported timing and rejected recognition cannot establish
  missing words. Those comparisons remain unknown and cannot enable alignment.
  No missing-word timestamp is manufactured on the take.
- The phrase rail collapses through the Phrases button; Previous, Next, Random
  phrase and Add phrases remain above the workspace. Phrase changes stay disabled
  during capture. Random excludes the selected phrase.
- The right report keeps the selected take and its selectable attempt rows.
  Earlier takes and the phrase-summary surface have been removed from the page,
  demo and live preview. Pending/error receipts live alongside the retained list
  and disappear when publication gives that list ownership. Pagination, selected
  take deletion, clear controls and diagnostic details remain available.
- Heavy selected-take outlines are removed; live clip markers use the success
  line token. Keyboard focus retains the shared control focus treatment.

Verification: all 1,313 UI tests pass after updating the tour references to the
retained attempt list. The production build, style validation and preview
type-check pass. Style pruning reports five remaining candidates, including the
pre-existing unused progress-note selector; it made no automatic source edits.
The test environment does not render canvas pixels. No browser surface was
available for screenshot verification, and no live microphone session was run.

Review the live preview in its normal, `?first`, `?locale=arabic` and
`?locale=german` states, and inspect the actual app with a partially recognized
take. Resize both panels, collapse/reopen the phrase rail, and check narrow-screen
controls before treating visual polish as verified.

Open `index.html` in a browser, keeping `mockup.css` alongside it. Fonts load
from the repository's `ui/public/fonts/` directory; there are no remote assets,
package dependencies or build steps. The file must not become a second
production style system.

Query parameters, for review:

| Parameter | Effect |
| --- | --- |
| `?board=1..4` | show one artboard alone |
| `?part=report` / `?part=stage` | drop the other column, to read one at full size |
| `?auto` | run the take-arrival on load instead of on the button |
| `?theme=dark` | not needed — the dark page is its own artboard |

## Implemented

What the application now does, and where it departs from the drawing above.

- **The record panel** (`RecordDock.tsx`, `drill.css`) is a column of controls
  beside the live pair, and the dock's log-mel lost its 28px cap and got its
  frequency scale back. The panel is taller as a consequence of its own content;
  `--drill-dock-height` still defaults to `auto`, so no size is imposed — but a
  height dragged out under the old arrangement now leaves dead space until the
  handle is double-clicked.
- **The clip box** is made on the waveform and opens down over the mel
  (`live-cut-grow` in `waveform.css`, driven by `--live-wave-height`, which is
  declared in `tokens.css` and published by `LiveRecording.tsx`). Nothing blanks
  while transcription runs; the mel is drawn throughout.
- **The report column is two panes, not three.** `PhraseProgress` was split into
  `PhraseSummary` and `AttemptRows`. The summary sits above; the open take's
  detail and every take's ribbon are one list beneath it. The handle between the
  old inspection and progress panes is gone, and the handle below now sizes the
  merged pane. Its stored height moved from `drill-progress` to `drill-attempts`:
  the pane it sized is not the same pane, and inheriting a height chosen for the
  strip alone would have squashed the detail that now shares it.
- **The ribbon** divides a fixed width with no minimum, so it cannot overflow and
  there is nothing to scroll. Each cell is its own container: the word and a
  hairline ring are drawn while the cell can hold them, and give out together
  below that, leaving colour alone. Below roughly 1.5px per cell the browser
  rounds boundaries to device pixels, so an isolated one-word outcome can vanish
  visually while still being in the DOM with its outcome and its `title`.
- **The arrival** steps the rows already in the list down one row and fades the
  new one in. It is marked from the predicate the page already had — same item,
  new head — and cleared on a timer matching the animation rather than on the
  animation's own end event, because under reduced motion no animation runs and
  so no end event would fire.
- **Verification:** `npm test` (1311 tests), `npm run build`, `npm run
  styles:check`, `npm run styles:dead` and `npm run previews:check` all pass. The
  new arrival behaviour is covered by `AttemptRows.test.tsx`. Nothing here is
  verified against a running application.

Three deliberate departures from the drawing:

1. The expression of the open take. The drawing gives the card a row of its own
   at the head of the ribbon and moves that row into the stack. The application
   does not need one: every row is already in one grid, so nothing has to travel
   between grids to stay aligned. The card's detail sits above the ribbon and the
   open take is simply the ribbon's first row.
2. The rows list is a plain grid with no landmark name, rather than a named
   region, so that no new user-visible string was needed.
3. The record button keeps the conversation composer's shape instead of filling
   the panel's column, because that shared shape is a contract the stylesheet
   states.

The take boxes in the dashboard remain drawn at fixed offsets here; in the
application their offsets are computed per frame from `startSeconds` and
`endSeconds` against the rolling window, so they ride the timeline. The mockup
was not brought into line for that, because the live pair is a stand-in for a
native canvas.

## What it is for

The Drill page has taken seven design passes without a consolidating one, and it
is now too complicated for the job it does. This mockup proposes the
consolidation, at the case that actually breaks the page — a twenty-word
sentence, which the existing preview never uses:

`ui/tools/drill-live-preview.tsx:48` fixtures a **five-word** Arabic phrase. In a
24rem report column that gives every heat-map cell about 70px, so the cells read
fine and the rows happen to line up. At sentence length they do neither.

This pass is narrower than the first draft of it, which drew its own record dock
and its own heat map and so contradicted the app twice over. Both of those
already exist:

- **The record dock** is `ui/src/components/media/LiveRecording.tsx` with
  `ui/src/features/drill/RecordDock.tsx`. The waveform and the log-mel are
  stacked, sharing one bordered box and one 12-second clock; the clip box
  (`.live-take-region`) is drawn across *both* plots. In the dock the mel is a
  28px sliver with no frequency scale and no axis row (`drill.css:177-180`), and
  below 860px it is dropped entirely (`drill.css:358`). Tap and hold modes show
  a 32px waveform and no spectrogram at all (`RecordDock.tsx:148-150`).
- **The heat map** is `ui/src/features/drill/PhraseProgress.tsx` with the
  `.drill-word-*` rules in `drill.css:217-240`. Its cells already carry the word
  in serif, already clip it, and already have a `title` (`PhraseProgress.tsx:75`).
  Its condensed sibling, `.drill-attempt-words`, is already the bare swatch
  strip (`drill.css:230-232`).

So this mockup draws the arrangements the app has, and proposes only what changes
around them.

## The four artboards

1. **The page**, 1440 wide, light. Press **Simulate a take** to watch one arrive.
2. **The stack** at 5, 20, 37 and 70 words, each drawn at the report column's
   true width. The cell width each length actually produces is measured at
   runtime and printed in the caption, rather than asserted here.
3. **The phone** — the arrangement that already exists: the dock keeps the
   waveform and drops the log-mel.
4. **The page, dark.**

## The ribbon

The strip is a **fixed width** — the report column's, never the phrase's. Its
columns are `repeat(N, minmax(0, 1fr))` with **no minimum**, so N cells tile that
width exactly at any N. The grid cannot overflow, so there is nothing to scroll,
in either axis. That is a structural guarantee, not a rule the markup has to
obey, and there is no horizontal scrolling anywhere in this view at any length.

Each cell is a container, so what it shows follows from how wide it was made:

| Cell width | What the cell shows | Reached at |
| --- | --- | --- |
| ≥ 13px | the word, in serif, clipped by the cell, plus a 1px ring | up to ~25 words |
| 5–13px | the ring and the colour; no letter fits | ~25 to ~65 words |
| < 5px | colour only — the row is a ribbon | past ~65 words |

At the default 24rem report column the strip is about 327px wide, so a 5-word
phrase gives each cell 65px and the whole word fits; 20 words gives 16px and two
or three letters; 37 gives 9px and the ring alone; 70 gives 4.7px and a ribbon.

The thresholds are container queries on the cell, so they need no JavaScript and
no knowledge of the phrase length. The ring gives out on its own because at tight
pitch it would be most of the cell and the row would read as a grid of borders
with the colour squeezed out — which is the opposite of a ribbon.

Clicking a row opens it: its detail appears at the top of the column and the row
becomes the first of the ribbons, directly above the rest — with the row that
*was* open folding back into the list behind it. That is why the strip never
needs to be more legible than it is, and why it never needs to be wider.

The open take being a real row of the same grid — rather than a card in a grid of
its own — is load-bearing, not a convenience. The row's number and score columns
are `max-content`, so two grids cannot agree on where the word columns start; put
the open take in its own grid and its ribbon comes out a different width from the
ribbon below it, and the row can no longer travel between them as one object.
The detail panel carries `container-type: inline-size` for the same reason — so
its contents cannot inflate the columns its own row shares.

**Honest limit.** Below about 1.5px per cell the browser cannot subdivide a
device pixel, so boundaries land where rounding puts them and an isolated
one-word outcome can visually disappear. It is still in the DOM with its outcome
and its `title`; the ribbon is simply not a precise instrument at paragraph
length.

## The arrival, as drawn

1. The learner records. The live pair streams — **waveform above log-mel in one
   box**, scrolling on one clock.
2. A clip is detected and **boxed on the waveform**, and then that same box
   **grows down over the log-mel**, with the cut edge marked. The mel is drawn
   underneath the whole time; the box is never a reason to empty it.
3. The take's own recording is now in hand, so its plot is drawn at once. **No
   plot is ever blanked, dashed out or replaced by a loading frame.** The
   spectrogram does not wait for the recognizer, and neither does anything else
   that is already computable.
4. The new take's detail opens at the top of the column, and the new take's
   stripe becomes the **first row of the stack**, directly above the previous
   attempts. The score column is the only thing in the list that waits — it spins
   where the score will appear. Everything else that is known is drawn at once.
5. The previous take's row **travels down into the stack** — the same row, in the
   same columns, moved rather than re-rendered. It lands in the place it was
   always going to occupy, and the older rows move down one row to make room for
   it. That movement is the animation: the previous attempt visibly becoming
   history, rather than being swapped out.
6. The answer arrives and fills the places that were waiting. The detail panel's
   geometry is identical in both states, so its height does not change.

The first draft flew a ghost of the clip from the dock up into the comparison,
which conflated two separate things and read as a jump on second press. It is
gone. What is left is the one movement that carries information: the previous
attempt moving down.

## What changed in this pass

- **The dock keeps the app's live pair and changes only the arrangement around
  it.** Waveform above log-mel, one box, one clip box spanning both, one clock, no
  side-by-side pair. What changes is the controls: they stop being a horizontal
  strip above the stream and become a narrow column beside it. The panel is taller
  as a result, which is the point — the log-mel gets room to be read instead of
  staying the 28px sliver the dock caps it at (`drill.css:177-180`). The panel's
  height is a stored, drag-resizable learner setting (`--drill-dock-height`,
  56–640), so this implies a new default for it rather than a fixed size.
- **The clip box is made on the waveform and then grows down over the log-mel.**
  One box, spanning both plots, arriving as a movement rather than appearing
  whole — and neither plot is emptied, covered or replaced to make room for it.
- **The open take's detail sits above the ribbon, and the open take is the
  ribbon's first row** — not a card in a second grid. The columns are declared
  once for the whole list, so every ribbon in the column is the same width and
  the rows line up word for word.
- **Nothing that is already known is hidden behind a loading state.** The mel
  stays drawn while the words are pending; the pending state lives on the words.
- **The open take is the first row of the stack**, not a card in a second grid.
- **The detail panel reserves its geometry.** Every section has the same height
  waiting or settled, so the list below it does not move while the answer is in
  flight.
- **The stack never scrolls.** The columns divide a fixed width with no minimum,
  the ring and the word drop out by container query as the cells compress, and
  the row becomes a ribbon.
- **The previous attempt moves rather than being replaced.** It travels from the
  open position down into the list as the same row, on the same columns.
- **The word header row is gone.** With cells carrying their own letters and the
  block never scrolling, there was nothing left for a header to label — and a row
  of twenty elbowed fragments was the defect the header was working around.

## What is deliberately not drawn

- Real spectrograms. Every plot is a striped placeholder; the real ones are
  native canvases (`Spectrogram.tsx`, `WaveformStrip.tsx`).
- **Take boxes that ride the timeline.** In the app a clip box's offset is
  computed from `startSeconds`/`endSeconds` against the rolling 12-second window,
  so the box travels left with the waveform. Here the boxes are drawn at fixed
  offsets and do not move with the stream. The live pair is a drawn stand-in for
  a native canvas, and its exact visuals are expected to settle when the change
  is implemented rather than from this file.
- RTL. The page must mirror, and the stack's columns run in the phrase's
  direction; neither is shown.
- The measures the app actually computes. Length, speaking time, pace and pauses
  are fixture values, and the arrival does not compute anything — it demonstrates
  the movement, not the scoring.
- `extra` word outcomes. The app has four (`same`, `substituted`, `missing`,
  `extra`); an inserted word is not keyed to any target word, so it is excluded
  from the grid and shown in the pairs. This mockup only draws three.
- The pending-take queue. `TakeQueue.tsx:29-45` already shows a take waiting for
  the recognizer with a progress bar; the card shows the state of one take and
  does not replace that.

## The proposal in one paragraph

Two columns instead of three, with the phrase list folding away. The comparison
loses its view options to one disclosure and keeps one transport row. The report
column becomes one list: the open take at the top with its detail, the rest
stacked below as colour ribbons on columns all of them share, each row dividing
the column's width exactly and compressing to a stripe rather than scrolling. A
take arriving is a clip boxed in the live pair, a card opening, and the previous
attempt moving down to take its place in the stack — with nothing that is already
known ever hidden while we wait for the rest. In the dock, the controls move into
a column of their own so the stream has a space of its own, and the record control
and the mode switch stop looking alike.

## Corrections already recorded elsewhere

An implementation review of the written plan found three of its moves need
fixing: the media row may need only a wrap rather than a menu, "Align words"
must stay visible because a test asserts it shows disabled when timings are
absent, and the merged list cannot keep a resize separator inside it. Those are
in the plan, not in this mockup.

The third one is still an open decision rather than a correction: the report
column currently holds `.drill-inspection-pane` → `ResizeHandle` →
`.drill-progress-pane` → `ResizeHandle` → `.drill-history-pane` (`DrillPage.tsx:346-368`),
with stored heights on the first two. The arrival animation drawn here requires
the open take and the stack to be one list, and a separator cannot live inside a
merged list. Dropping the handle *between* those two panes — keeping the one
below — is the minimal change that makes the movement possible, at the cost of
sizing those two panes independently. This mockup draws the merged result; the
plan needs that decision recorded before implementation.


## Narrow stacked layout: implemented 2026-09-27

The narrow layout (up to 860px) now places the target, both comparison plots,
recording controls and live timeline above the shared attempt history. It uses
one scrolling surface; the plots have explicit usable heights instead of
competing for the remaining height. Desktop retains its resizable arrangement.
The older mobile summary card and separate report modal are removed.

Target navigation keeps the picker and previous/next buttons visible; random
selection and adding targets live under More. Voice speed joins the comparison
settings disclosure. Record/Stop, recording status and the settings button stay
on one row; the threshold and automatic detection toggle move into recording
settings on narrow screens. Word overlays start visible.

Verification: 54 focused Drill component tests pass, including inline history
selection and recording after target changes. TypeScript and style checks pass.
Visual review in a running app remains outstanding: browser automation had no
available connection and the native UI connection was unavailable. Review at
phone width and with enlarged reading text before considering this visually
approved. The historical mockup discussion above is not the current layout.


### Compact follow-up

Narrow comparison controls now share each plot's grid area rather than adding
separate rows: Target/Attempt play controls and elapsed/total times match, and
both use the existing draggable plot cursor for seeking/scrubbing. The redundant
narrow reference range slider is removed. Playback keeps the current position;
the narrow controls show pause while cached audio plays. Reference loading
retains stop/cancel.

Alignment explanations and detection details are available under an overlapping
info disclosure on both widths. The narrow recorder controls overlay the live
timeline; its redundant heading and standing status copy no longer consume rows.
Narrow history starts collapsed, opens in place on selection, and has a Close
control. Desktop expansion behavior is unchanged. New narrow takes remain
compact instead of automatically consuming space with a report.

Verification: 61 focused component tests pass, including initially collapsed
history, opening/closing it, and explanations hidden until requested. Visual
review is still pending in the running app; this follow-up responds to the
provided screenshot rather than a new automated screenshot.


### Modal controls correction

Comparison settings on narrow screens now use the shared native DetailDialog.
Its top layer and dimmed backdrop make the surrounding spectrograms inert while
open; capture is preserved, matching recording settings. A regression test
checks modal opening, changing scale without seeking either recording, and
closing. Previous and Next are visible text labels, and random selection is
labeled Random target in every interface locale. The focused comparison/page
suite passes (53 tests); TypeScript and style checks pass.


### Playback visibility

Drill now supplies reference playback to TargetMessage's existing chat speaker
button, inside the target bubble, instead of duplicating it in the media strip.
The shared speech control accepts a disabled state to preserve the recording
lock. Drill gives that corner control a primary blue treatment and uses the
same primary fill for attempt playback. Focused playback/reading tests pass
(69 tests), including stopping, seeking and capture locks; TypeScript, styles
and preview checks pass. Running-app visual review remains pending.


### Playback progress, direction and shared surface polish

Target playback is available both in the bubble and beside its timeline; Target
and Attempt now have matching buttons and progress controls. Each progress
control shares the spectrogram's time map, playback state and scrub controller,
including inverse seeking under word alignment and right-to-left direction.
Shared-scale progress also uses the shared span. The timer is layered over a
filled track rather than occupying a separate label area.

Time defaults to the configured script direction, with the existing explicit
override retained. The live waveform, spectrogram and clip markers mirror
together; text labels are counter-mirrored. The recorder uses existing learner
surface colors and raised shadow tokens.

Shared simple buttons use the chrome surface and small shadow; shared dialogs
use chrome against their existing scrim. Native select open states use a scrim
shadow (platform support for :open still needs visual checking). Language and
contact menus have dismissible scrims and chrome surfaces. Drill target picking
and target actions use DetailDialog. Message-edit mode is a raised, bordered
chrome panel. No provider or recording contracts changed.

Verification: 96 focused Drill, language-picker, live-recording, and conversation
tests pass, plus 17 waveform/contact-picker tests. Progress tests cover mirrored
inverse seeking, fill position and ending previews once; the page test verifies
comparison and live directions change together. TypeScript, previews and styles
pass. Running-app visual review remains outstanding, especially native select
popups and menu stacking.
