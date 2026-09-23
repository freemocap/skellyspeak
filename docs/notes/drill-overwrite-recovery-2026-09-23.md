# Drill overwrite recovery and removal of preservation machinery

Status: implemented September 23, 2026; uncommitted. Real Mac microphone/playback
check remains. This restores behavior from the surviving components and tests,
not a claim to recover the overwritten files byte for byte.

## Damage and recovery

A stale cloud clone replaced DrillPage, its feature stylesheet and locale files.
The backend and shared audio/rendering components survived. The previous failing
reference-playback test indicated a real feature loss; calling it merely an
unrelated failure understated the problem.

Restored DrillPage's continuous-mode toggle and native pause-policy choices,
`pauseMs` recorder input, native listening/error state, live spectra, current-take
discard and receipt-linked pending cards. The bounded spectrum polling loop was
already intact inside `useMicRecorder`; it was reconnected, not duplicated.

Restored reference preparation before playback, source-scoped async guards, the
media clock/player handle, seek slider and standalone reference spectrogram before
any attempt. Seeking after playback reuses retained audio through the shared audio
authority without requesting generation. Reference word timings remain explicitly
unavailable where the provider/inspection has none.

RecordDock's mode/status/spectrum props and AttemptLog's live-take input are now
required. Missing wiring produces type errors. Two new page integration tests cover
continuous commands, the configured gap, visible cuts and pending-to-saved cards;
and reference playback clock/seeking. Strengthened the source-change race test to
exercise delayed inspection. These use the real page and recorder hook.

Reviewed the replacement pending-card CSS and locale wording, restored the missing
toggle/gap strings in seven languages, and made the indeterminate bar use a fraction
of its container so its animation spans the track. Reduced-motion behavior remains.
The browser preview renders both spectra, cut marker, pending card and reference
slider. This is not a physical microphone or paid-provider verification.

The agent's AddPhrases/CandidateList/useDrillPreview changes remain in place.
AGENTS.md now requires in-place edits and checking the current diff before editing;
whole-file copies from stale clones are prohibited.

## Removed complexity

Removed the versioned workspace upgrade runner, frozen schema fixture, conversion
step, persistent notice table, notice commands/UI/contracts, and their tests.
Removed legacy credential copying and its test module. Historical receipt route
exceptions are gone; native/TypeScript route types and current SQL constraints have
only Hosted/Custom. The provider-named Keychain service is never accessed, including for deletion. Ordinary product records are not a compatibility guarantee.

AGENTS.md now states no backwards compatibility or format conversion. Delete
incompatible development data in the affected scope; do not reset for ordinary UI
or code edits. Full reset is allowed when scoped cleanup is impractical. Workspace
ownership and explicit errors remain; there is no silent reset of an unknown DB.

## One-time local development cleanup

The running app was absent. Under its exclusive workspace lock, checked the known
app identity, current schema and foreign keys, then removed only the incompatible
receipt tables and upgrade notices and recreated the affected tables from current
DDL. No old rows were copied or converted. This was a one-time local maintenance
operation, not shipped migration machinery.

Actual deleted rows: 9 transcription receipts, 6 generation receipts, 2 upgrade
notices, 8 dependent phrase previews and 48 preview candidates; no inference holds
existed. Existing attempt links to removed receipts became null by their declared
foreign-key behavior. Receipt-based historical usage totals consequently decrease.

Unchanged row counts: 12 Drill phrases, 9 practice attempts, 2 conversations,
1 learner, 6 reading receipts and the current valid connection configuration.
The workspace now has schema 40. No audio files, credential values, unrelated app
data or source edits were erased. Foreign-key/integrity and current-DDL checks pass.

## Verification and next check

- Native: 558 passed, six existing ignored tests.
- UI: all 1,156 passed; restored DrillPage suite: 23 passed.
- Clippy, fmt, native executable build, UI build/types, generated contracts,
  styles/dead styles, previews, languages and whitespace checks passed.
- No commits or deployments.

Rebuild/relaunch using `npm run macos:dev`; no Factory Reset is needed for the local
workspace already cleaned above. Hear and scrub the reference; enable Repeat with
pauses; record three repetitions. Check live cut markers, immediate processing
cards and completed attempts. Switch phrases and check no stale spectrum or cursor.
