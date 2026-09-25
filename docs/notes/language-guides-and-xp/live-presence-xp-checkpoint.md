# Presence, experience and effort: integrated source checkpoint

Status: implemented and automatically verified, 2026-09-24. This supersedes the
component-only integration status in the earlier native and content checkpoints.
No commit, deployment, paid inference, application relaunch or development-data
reset was performed. The browser review is a synthetic component fixture.

## Implemented behavior

1. Conversation capture freezes the twelve shared skills plus applicable
   language-defined skills, compact core/variety guidance, shared instructions,
   content hash and catalog identity. Guidance wording changes do not erase earned
   XP; changes to the skill definitions are tracked separately.
2. Jev receives one Choice question per applicable skill, using the adopted
   compact content strategy. The complete answer map must validate before any
   credit is published. Direct and contextual presence count; absent and unclear
   do not. Probabilities remain inspectable, not XP weights or proficiency scores.
3. Validated presence and deterministic credit publish in the existing completion
   transaction, while the owning operation is still running. Late/replaced
   completions cannot award. Duplicate completion cannot award twice.
4. First credited use of a skill in a message/revision chain earns one experience
   point. A changed retry earns one effort point for every previously encountered
   skill still present. A new skill earns experience instead. Exact unchanged text
   earns nothing; an independent new message starts a new experience opportunity.
5. Saved rewards drive language and conversation XP, experience/effort counts and
   the evidence ledger. Exclusion and deletion affect the projection. Reward
   presentation retains durable one-time claims and the existing sound, animation,
   haptic and milestone machinery. A missing claim never fabricates an award.
6. Required skill assessment uses Jev. Removed the startup rollback that disabled
   it, the automatic quote-localization operation, and the old generative skill
   assessor. Grammar/conversational-fit/understanding ratings remain separate and
   do not grant XP. No second source-span call is needed for broad retry credit.
7. Missing guide coverage fails assessment explicitly without blocking the partner
   reply or silently switching variety/model. No partial-catalog assessment is
   presented as complete.

The server accepts 1–64 bounded skill questions, rather than requiring 45. This is
an operational request limit, not a new catalog budget. Native and server share
real-dispatch text/speech request fixtures and preserve existing billing and
response diagnostics.

## Content available for review

| Language / variety | Compact guides |
| --- | --- |
| Spanish / Mexico | 12 of 12 |
| Spanish / Spain | 12 of 12 |
| Arabic / Levantine | 12 of 12 |
| Mandarin / Mainland China | 12 of 12 |

Arabic shared material is language-wide; Levantine constructions are explicit
variety content. MSA is not a default core or a fallback. Other varieties remain
uncovered. New entries are deliberately compact and marked `needs_review`.
Expanded examples and full teaching guides have not been bulk-generated. Human
explanations/examples remain separate from the compact assessment fields.

Source review supported Spanish questions, obligation and conditions and
Levantine present/future constructions [@yepesQuestions20260924]
[@yepesObligation20260924] [@yepesConditions20260924]
[@nassraLevantinePresentFuture20260924]. These citations support their stated
claims, not every line of a guide. A Lebanese verb sample and a Mandarin course
index were also inspected; neither establishes full linguistic validation of
these guides. Mandarin additions and uncited constructions still need specialist
review. The earlier experiment tested two skills, not all twelve: its measured
agreement must not be reported as twelve-skill accuracy.

## Verification

- Full native library suite: **593 passed, 1 intentionally ignored**. Includes
  actual dispatch → validated completion → durable publication → profile tests,
  changed/unchanged retries, new skills, independent messages, invalid
  distributions, late results, unavailable guidance and reopening the store.
- Full UI suite: **1,213 passed**. After correcting the reward-claim version gate,
  the affected progress/presentation and coach component tests were rerun: **19 passed**.
- Server inference suite: **307 passed**, with generated native request fixtures.
  After adding question-count boundary cases, the decisions suite passed **37 tests**.
- Application and preview TypeScript checks, plus generated-contract checks, pass. All seven UI locales
  pass key/placeholder/catalog checks. Workbench checks pass (9 tests); current
  documentation entry-point links pass. Preview fixtures were aligned with the
  separate message-rating contract while checking the new practice preview.
- Browser review: the production skill list and progress report show 5 XP from
  three synthetic submissions: 3 experience + 2 effort; the unchanged resend
  creates no sixth award. This is component rendering, not a paid live-model test.

Review page: `ui/tools/practice-preview.html` (append `?report=1` to open the
progress report). Run `npm --prefix ui run dev -- --host 127.0.0.1 --port 52006`,
then open `/tools/practice-preview.html?report=1`. It writes no workspace records.
The language selector exercises the seven interface locales.

## Current follow-up status — 2026-09-25

The experience profile, coach conversation selection and authored guide inspectors
are implemented. The earlier saved-assessment/explicit-refresh proposal is
superseded: the profile is a live deterministic projection. The older estimate UI
has been replaced; internal estimator cleanup is separate from this pilot.

1. Complete the interactive Spanish trial on a confirmed current native build.
   [Pilot results and steps](spanish-integrated-pilot.md).
2. Address issues found in that trial before expanding the feature surface.
3. Add optional drill/card recommendation use and on-demand score explanations.
4. Review compact content, then author richer language/writing-system guides in batches.

See [live profile completion](saved-experience-assessment.md) and the
[master sequence](evaluation-xp-refactor-plan.md) for current verification.

Existing development records may contain retired focus IDs and reward shapes.
Before a native application trial, use the authorized scoped development cleanup;
no migration or silent reset was added. Source tests use fresh disposable stores.
The completed experiment plans, receipts, comparisons and dashboards are unchanged;
their offline tools remain under `tools/benchmarks/conversation-prompts/assessment/`.

## Message-counter payout — implemented 2026-09-25

Automatic reward cards have been removed. Claimed awards now increment their
message's XP counter one point at a time, 120 ms apart. Each point has a compact
650 ms rising/scaling burst. No hover hold, Keep button, dismissal, or Fast-mode
wait applies. Sound and milestone cues use the message counter as their anchor;
offscreen messages do not block payout completion. Reduced motion removes travel
and scaling. Effects-off removes the payout, leaving saved totals and reports.

The change is presentation-only: durable display claims and XP calculations remain
with their current owners. Scope changes/unmount cancel timers; identical evidence
does not replay. The header continues to open the conversation ledger on request.

Verification: production message components were exercised in the local
`tools/xp-payout-preview.html` browser preview with synthetic credits. A 12-point
burst visibly incremented the message counter without opening a card. This is a
component integration check, not a newly assessed native conversation. Automated
checks cover payout ordering, effects-off, replay prevention, milestone cues,
unmounted anchors and report access. Application/preview types, styles and
localization checks pass.

### Coin sound refinement — 2026-09-25

Point payouts now use triangle-wave chimes with a 2 ms attack, a short upward
pitch bend and a higher decaying finish. Five pentatonic starting positions vary
between awards without immediate repeats. Single-point motifs finish in 133 ms;
milestones use a longer rising motif. Existing volume, mute, visibility and queue
limits still apply. Other feedback cues are unchanged. Ten audio tests and the
application type check pass; the updated preview payout was exercised. Subjective
sound preference remains available for listening in that preview.

### Sound tuning preview — 2026-09-25

Added a preview-only panel with seven scales (including blues and Phrygian), root
pitch, scale-degree steps, note count, rising/falling/arch/zigzag contours,
waveform, spacing, attack, decay, pitch bend and volume. Presets, reset, single
coin/milestone auditions and copyable YAML support comparison. The full payout
uses the same synthesis parameters. No persisted application preference or
Settings surface has been added. Preview changes live only in the page session.

The synthesis parameters are validated independently of the controls. Octave
folding bounds extreme pitches without changing their scale membership. Other
feedback sounds retain their existing behavior. Twelve audio tests and both
application/preview type checks pass. The rendered panel was visually inspected
in the local preview; current user selections were left intact.

### Preview rhythm controls — 2026-09-25

The control-panel twelve-coin audition and autoplay now share configurable coin
intervals, even/accelerating/decelerating/swell/swing shapes, shape strength,
variation amount and uniform/centered/smooth variation. Timing is exported with
the voice YAML and reset with it. Slider edits debounce and replace pending
preview playback. Explicit preview playback permits overlapping coin envelopes
at the chosen onset times rather than imposing the production queue's 120 ms
spacing. Production message payout timing is unchanged. Fourteen focused timing,
control and audio tests pass; preview types pass and the panel was visually checked.

### Whole-payout resolution — 2026-09-25

The sound control panel now defaults to a planned rising phrase rather than
independently randomized coin pitches. Preview count is adjustable from 1–32,
with a one- or two-octave rise and a sustained high tonic. The finish can belong
to the last earned coin or an additional two-note audio-only cadence. Extra notes
never add XP. Per-coin contour, degree steps and random starting-pitch controls
are disabled while whole-phrase planning owns pitch. Rhythm controls still apply;
onsets are stretched when necessary to preserve pitch order and let earlier tails
finish before the final tonic. This guarantees musical structure, not a universal
subjective preference. Whole-tone and modal scales retain their own character.

Autoplay, reset and YAML export include phrase configuration. Fifteen focused
checks pass, including all seven scales at 1, 2, 3, 7, 12 and 32 coins, both ending
modes, and fast timing with long per-coin motifs. Preview and application types
pass. The controls and audition were exercised in the local browser. This remains
a control-panel audition; production reward batching has not adopted the planner.

### Authored payout sound comparisons

Implemented preview-only Soft chime, Muted coin and Dry arcade candidates, using
short layered pickups, narrow pitch progression and a separate completion cue.
Count and volume are shared with the existing tuning panel. Direct play buttons
replace unfinished comparison playback; Stop and leaving the tab cancel playback.
No application default has been selected or changed. All sounds are synthesized
locally; no third-party samples are included.

The complete burst is rendered into one buffer for audio-clock timing. Short-window
RMS is normalized across candidates; this is an engineering comparison aid, not
verified perceptual loudness matching. Listening preference remains pending user
review at 1, 3, 12 and 24 XP. Prior art: [@levelCurveStorefront2023]; fatigue and
repetition guidance: [@jacobsenGameAudioFatigue2018].
