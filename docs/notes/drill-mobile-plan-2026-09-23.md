# Drill on narrow screens — design and plan (2026-09-23)

Status: **implemented in source with automated and browser verification; real-device verification pending**.
The original proposal below is retained as design history; the implementation
record at the end states the actual delivered scope. Follows
[drill-ux-redesign-2026-09-23.md](drill-ux-redesign-2026-09-23.md).

## What is wrong today (observed at 390×844)

Below 860 px the three columns just stack into one long scroll: phrase list, then
the comparison, the dock, the summary, the report and the log. The media row and
the Fit/Time switches overflow sideways, spectrograms are cut short, the record
control scrolls away, and the report is a screen and a half below the phrase. The
drag handles are hidden, so nothing can be resized. Auto-detect is offered but
native refuses continuous capture on mobile.

## Principles

1. **One job per screen, the phrase always in view.** A phone shows the phrase,
   the thing to press, and the latest result, without scrolling.
2. **The record control lives in the thumb zone** — a fixed bar at the bottom,
   above the safe area, never scrolled away.
3. **Detail on demand.** Spectrograms, the word grid, measures and history open
   from summaries; nothing that is hidden is removed.
4. **Same components, different arrangement.** Mobile reuses `DrillComparison`,
   `AttemptInspection`, `PhraseProgress`, `AttemptLog` and `RecordDock`; only the
   container and a few variants change. No second implementation.
5. **Touch sizes:** controls ≥ 44 px (existing `--touch-target`), drag handles
   with large hit areas.

## Layout

```
┌──────────────────────────────┐
│ top bar  [Chat|Drill]  ≡     │  existing shell (check the switch fits at 360 px)
├──────────────────────────────┤
│ ☰ Phrases   phrase 2 of 9 ▸  │  phrase bar: opens the phrase drawer, next/prev
├──────────────────────────────┤
│  ┌ partner bubble ─────────┐ │  the phrase, Translate/Word by word/Analysis
│  └─────────────────────────┘ │
│ ▶ ━━━━●━━━━━━━  0.8/1.3 s    │  reference media row (single line)
│ ░░░ reference spectrogram ░░ │  ~72 px
│ ▶ You · #7  ░░ take ░░░░░░░  │  ~72 px, collapsible
├──────────────────────────────┤
│ Latest take  88%  4/5 exact  │  result peek (tap / swipe up → report sheet)
│  target row / heard row      │  word pairs wrap onto more lines if needed
├──────────────────────────────┤
│   [ ● Hold to talk ]  ⚙      │  fixed record bar, level meter + threshold handle
└──────────────────────────────┘
```

- **Phrase drawer** (left, like Chat's history drawer): the existing
  `PhraseRail`, add/generate, storage. Selecting closes it. Swipe or "next" steps
  through phrases without opening it.
- **Report sheet** (bottom sheet over the page, three heights: peek / half /
  full): peek = score, words exact, the target/heard rows; half = + measures and
  comparison details; full = + phrase summary (trend and word grid) and earlier
  takes with delete and "Clear takes…". Selecting an earlier take updates the
  comparison behind the sheet.
- **Comparison:** Fit is the default (Same scale stays as an option). The
  Fit/Same scale and time-direction switches move into a ⋯ menu on the media row.
  Spectrogram height is set by dragging the sheet/peek boundary, not a separate
  handle; the take spectrogram can collapse to its media row.
- **Target/heard alignment:** switch the table to wrapping word pairs (each pair
  = target cell, gap, heard cell), so long phrases wrap onto more lines instead
  of scrolling sideways. Same markup on desktop, where it simply fits one line.
- **First take:** the empty-phrase layout already enlarges the record control;
  on mobile it fills the space the report peek would use.

## Recording on a phone

Auto-detect is the expected mode on phones too, and it uses the same detector.
The only difference today is where the microphone samples live:

- **Desktop:** native captures the microphone and feeds PCM to the `Segmenter`
  while you speak.
- **Phone:** the web layer captures (AudioWorklet in `browser-recording.ts`) and
  hands native one finished WAV at Stop, so native never sees a live stream and
  `mic_listen_start` currently refuses on mobile.

Fix: stream the worklet's PCM to native in small sequenced chunks while
listening (new `mic_listen_push(recordingId, sequence, samples)`), feed the same
`Segmenter`, and drop the mobile refusal. Level meter, threshold handle, cuts,
queue and publication then work unchanged. Auto stays the default mode.

- Keep the screen awake while listening (Wake Lock where available).
- Record bar: one row — big button, level meter with the draggable threshold,
  settings.
- Landscape phones (height ≤ 550 px): the report peek hides; the record bar stays.

## Implementation plan

**Mobile layout and mobile Auto-detect (one slice)**
1. `DrillPage`: when `useIsMobile()`, render a `DrillMobileLayout` arrangement of
   the same components (phrase bar, stage, peek, record bar) instead of the
   grid; resize handles are desktop-only.
2. `DrillPhraseDrawer`: reuse the chat drawer pattern (`.drawer-scrim` +
   panel) around `PhraseRail`; next/previous phrase buttons.
3. `DrillReportSheet`: a bottom sheet with peek/half/full snap points (pointer
   drag + buttons + keyboard), containing the existing report pieces.
4. `DrillComparison`: move the scale/direction switches into a ⋯ menu below
   860 px; collapsible take row.
5. `AttemptInspection`: wrapping word-pair alignment (both layouts).
6. `RecordDock` mobile variant: fixed bottom bar, safe-area padding
   (`env(safe-area-inset-bottom)`).
7. Styles in `drill.css` under the existing 860 px breakpoint; touch targets.

8. Mobile Auto-detect: stream worklet PCM to native (`mic_listen_push`,
   sequenced, bounded, rejects gaps), feed the existing `Segmenter`, remove the
   mobile refusal in `mic_listen_start`. Native tests push chunks through the
   same pipeline the desktop tests use.

**Verification**
- Vitest: mobile layout with `matchMedia` mocked (drawer, sheet snap, Auto
  streaming), existing desktop tests unchanged.
- Playwright screenshots of `drill-live-preview` at 360×740, 390×844, 430×932 and
  844×390 landscape, light and dark, RTL and LTR.
- Real device: `npm run e2e:android` preflight, then a manual hold-to-talk run on
  an Android phone and iOS (safe areas, mic permission, wake lock).

## Open questions

- Should the report sheet open automatically after each take, or only show the
  peek?


## Implementation and verification — 2026-09-23

### Implemented behavior

- `DrillLayout` arranges the existing rail, comparison, recording dock and report.
  At ≤860 px: phrase count/previous/next bar, scrolling practice content, a dock
  outside that scroll with safe-area padding, and explicit phrase/report sheets.
  Desktop keeps its resizable columns. Previous/next and phrase creation are
  locked while recording or storing an attempt.
- The selected take's compact card opens the full report; results never open it
  automatically. Word pairs wrap together, retaining missing/extra word outcomes.
  Measures use rows rather than a wide table. Earlier takes, deletion, clear,
  phrase progress, reading tools, storage and generation remain available.
- Mobile comparison settings contain fit/shared scale, time direction and optional
  word-timing overlays. The live dock shows waveform and adjustable threshold;
  reference/take spectrograms remain above it.
- Reference playback failures have a separate Retry banner and retained response
  details. Microphone failures are separately labeled with response details.
  This does not claim to repair an unavailable TTS provider.
- Browser AudioWorklet PCM streams through a sequenced, bounded transport into
  the same native Segmenter, queue, transcription receipts and publication used
  by desktop. Stop flushes acknowledged audio first; cancellation releases the
  browser mic. Invalid order/rate/samples and growing backlog fail explicitly.
  The native session retains its duration, take-count, lease and queue limits.
- Native WAV encoding is shared outside the desktop device adapter. Dead iOS
  branches in that adapter were removed. Manual mobile capture still encodes its
  completed WAV in the browser; it continues through the existing common native
  transcription/publication path.
- Shared `useModalDialog` supplies DetailDialog and Drill sheets with native
  modality, backdrop handling and the existing overlay/back/focus owner. Capture
  policy is explicit. AI activity preserves capture in both narrow and wide
  layouts; report sheets preserve capture too. Settings' existing shortcut
  handling remains unchanged.
- Chat/Coach mobile navigation and gestures are inactive in Drill. The narrow
  top bar hides the redundant wordmark and secondary language/theme controls;
  language remains available through More → Browse languages and theme through
  Settings. Chat/Drill, progress, connection and More remain accessible.

### Deliberate differences from the proposal

Sheets open at one scrollable height with a native close button, Escape/Back and
focus containment. Multi-height drag snapping, swipe-to-change-phrase, a take-plot
collapse handle and Wake Lock were not implemented. Short screens scroll the
practice area while retaining the recording dock. The existing default Tap mode
was preserved; Auto is an explicit supported choice on mobile.

### Verification

- 166 frontend tests passed across Drill, audio, dialogs, app/navigation and
  architecture (31 files). A final audio rerun passed 26 tests after stop/error
  cleanup refinements. New coverage includes mobile picker/report navigation,
  capture locking, browser Auto status and flush-before-stop, streamed delivery,
  and explicit modal capture policy.
- 26 native recording tests passed, including browser PCM through the real
  detector and local mock provider into durable attempts/usage; sequence gaps,
  duplicates, invalid samples, changed sample rates and buffer overflow reject.
- UI build, preview type-check, style policy, localization audit (zero removal
  candidates), generated-contract check and design-system check passed.
  Design-system artifacts were regenerated; this also refreshed an already-stale
  ReplyHelp preview. Vite retains its existing large-bundle warning; jsdom does
  not render canvas, so spectra were inspected in the browser.
- `cargo check --lib --target aarch64-apple-ios` passed. It emits one existing
  unused `diagnostics::failures::utf8` warning. Sandbox restrictions on localhost
  mock servers and Swift caches were resolved by running those checks with the
  required local access.
- Browser inspection of production components via the offline preview: 360×740,
  390×844, 430×932, 844×390 and 1280×900; light, dark, Arabic RTL and German
  first-visit layout. Picker, report and desktop arrangement were inspected.
  The 360 px page had no horizontal overflow and the dock stayed in the viewport.
  Preview parameters: `?first=1`, `?theme=dark`, `?locale=arabic` or `german`.
- Android device preflight failed explicitly: zero authorized devices connected.
  No physical phone microphone, permission prompt, safe-area inset or background
  suspension check was possible. iOS compilation is not device verification.
- `continuous.rs` remains slightly above the 500-line guideline (517 lines): the
  shared session coordinator and its transaction/publication sequence remain
  cohesive. The new PCM transport and shared WAV encoder have separate owners.

No commits, deployments, data resets or intentional native app restarts were made.
The diagnostic-archive duplication from the audit remains a separate follow-up.

### Header regression follow-up

The initial browser fixture omitted the app shell and therefore missed a real
mobile header regression. Later base declarations overrode compact header rules,
leaving the language picker squeezed into a vertical strip. Compact overrides now
follow their control bases; the obsolete mobile picker width override was removed.
The desktop header can wrap and its language area has a readable minimum width.
Mobile language selection remains available through More → Browse languages.

The Drill preview now includes the production TopBar and app/content/page-holder
containers, with a representative long language label. Browser checks found a
47 px compact header at 360, 390, 450 and 860 px; German at 360 px and dark Arabic
RTL at 390 px fit without horizontal overflow. The header wraps to 93 px at
861/1024 px and returns to 44 px at 1280 px. A settled 861 px check confirmed
header scroll width equals viewport width. Preview type-check, style policy,
11 TopBar tests and regenerated design-system checks passed. This is browser
fixture verification, not a rebuilt native application or physical-device test.

### Direct mobile language selection restored

User rejected hiding the language picker in More. This supersedes that decision
and the 47 px mobile-header expectation above. The existing production picker now
has its own full-width, 44 px minimum-height row above the practice controls.
No separate mobile selection logic was introduced. The offline Drill fixture now
uses the real LearningPicker with a sample registry and in-memory settings writer.
At 390 px, opening the menu, opening English varieties, and selecting United
States updated the visible picker. At 360 px, the picker was 354×44 px, total
header height 92.5 px, and document width equaled viewport width. The record dock
remained visible. These are browser fixture checks, not native persistence tests.

### In-view performance history

Implemented a compact variant of the existing PhraseProgress report above the
mobile comparison: the last up to 12 loaded takes' match trend, Best/Latest/Last 3/
Exact statistics, and six recent take buttons. These buttons use the existing
attempt selection state; selected word feedback precedes the spectra, while the
record dock remains outside the scroll area. Full word history and older takes
remain in the full report. No alternate scoring or mobile history store was added.
Mobile word-timing availability diagnostics now live in Detection details.

Verified the 390×844 preview and selection of an earlier take; at 360×740 the
summary measured 152 px high with no document horizontal overflow and a visible
dock. Inspected dark Arabic RTL at 360×740. All 50 Drill tests passed, including
mobile history visibility and selection; preview type-check and style policy
passed, and the design-system bundle was regenerated. Canvas rendering was
verified in the browser because jsdom does not implement canvas. Native device
and persistence behavior were not changed or re-tested in this layout pass.

### Pinned reference and lower history

User requested the reference remain at the top, history near the recorder, and
more prominent target text. This supersedes the prior history-first ordering.
The reference grouping (target, playback, reference spectrum) now sticks to the
mobile practice scrollport; composition wrappers use display: contents on mobile
so the sticky boundary includes the entire history. Selected-take audio and word
feedback follow it, with progress/history last, above the fixed recorder.
Target text uses the display role at 1.3× plus existing reading/script scales,
semibold and full-width. Both spectra retain shared scaling and playback owners.

Browser verification at 390×844: selecting a historical take scrolled the middle
while reference top stayed at 144.5 px and recorder top at 661 px. Target text was
27.3 px at default scaling. At 360×740 the reference occupied 217 px and the dock
remained within the viewport; document width stayed 360 px. All 50 Drill tests,
preview type-check and style checks passed; design-system CSS regenerated.

### Target emphasis through its container

User rejected enlarged/heavy target typography. Removed Drill's target font-size,
weight and line-height overrides, including the earlier desktop multiplier. An
explicit drill-target-card div now owns emphasis through existing surface, border,
spacing and radius tokens. Its embedded reading bubble keeps shared text and
annotation styles; only its redundant bubble chrome is removed. The reference
remains pinned and history remains below it. This supersedes the display-role
scaling decision above.

At 390×844 the browser fixture rendered the target at the shared 17 px, weight
400, with no horizontal overflow. Preview type-check and style checks passed;
design-system CSS regenerated. No recording or selection logic changed.

### Balanced target emphasis

User requested a middle ground between the oversized/heavy and understated
versions. Target text now uses the existing display token (21 px on mobile),
regular weight, and retained reading/script scaling. The containing div uses
the existing partner surface tint and border with its accent edge. This replaces
the preceding shared-reading-size decision. Browser inspection at 390×844
confirmed 21 px / weight 400 and no horizontal overflow; style validation passed
and the design-system bundle was regenerated.
