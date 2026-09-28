# WebView popup and speech compatibility

## Observed failures (2026-09-27)

Reviewed the three supplied 2.5.5 diagnostic exports and two screenshots.
The two desktop exports overlap retained runs; their counts are not independent.

- Desktop crashes call `showPopover()` on a WebView without that method. The
  screenshot also shows `AbortSignal.any()` missing during reference speech.
- Touch word help explicitly opened a full dialog on the first tap. This was a
  UI regression relative to the requested small anchored helper.
- Android diagnostics record two hosted-account transport failures with
  `Software caused connection abort (os error 103)` and two stale coaching
  command rejections (`Coaching changed. Review the current advice.`).
- Android native logs contain more than four million JNI tracing entries and no
  native WARN/ERROR entries. Many generic "no explanation" diagnostic messages
  belong to ordinary debug/info events, not errors.
- Older desktop runs also contain `Load failed` and unhandled type errors with
  insufficient retained detail to establish their cause.

## Implemented

- Popover capability detection covers word help, information tips and speech
  status. WebViews without the API use fixed portals rather than crashing or
  hiding the content.
- Touch word helpers render outside the message bubble in a fixed portal,
  anchored and clamped to the visible viewport. Touch detection includes devices
  reporting touch points even when their primary pointer query is fine.
- First tap opens compact word help. Full inspection remains an explicit second
  action. No modal or dimming is introduced for first-tap help.
- Speech uses an AbortController with explicit cancellation forwarding and
  listener cleanup, eliminating the dependency on `AbortSignal.any()` while
  retaining interruption and cancellation reasons.

## Verification

- Full UI suite: 1,382 tests passed.
- Focused popup tests after final preview-render adjustment: 55 passed.
- Production build, TypeScript, language catalog and localization usage checks,
  stylesheet checks and generated design-system checks passed.
- Missing-popover tests cover saved and fetched word help, information tips and
  speech error status. Missing-signal-combiner test verifies cancellation and
  prevents late audio playback.

## Initial verification limits and separate findings

No Mac or Android runtime was available for visual verification. The original
Android tiny-popup rendering has not been reproduced locally; the fixed portal
avoids the top-layer and bubble clipping path, but needs a check on the phone.
Verify first-tap positioning, word audio, outside-tap dismissal and Drill target
speech on the affected devices.

Network aborts and historical `Load failed` records are not proven fixed by
these UI changes. Low-level native trace volume and misleading generic messages
on normal diagnostic events are separate observability issues; logging behavior
is unchanged in this patch. No version, commit, tag or push was created.

## Android device follow-up (2026-09-27)

Observed on the connected Pixel 9 Pro XL with the source-built 2.5.5 APK:

- A new conversation reproduced a tiny, misplaced saved-word helper. Its DOM
  reported a 123 × 69 CSS-pixel box with normal font sizes; the physical-screen
  screenshot showed a much smaller card at a different position.
- Changing that same live card from `position: fixed` to `absolute` restored
  its rendered size and placement without restarting or changing its content.
- Speech published active highlight rectangles at the correct word coordinates.
  Changing the overlay and word rectangles to absolute positioning made the
  moving highlight visible in a physical-screen capture, including with inline
  word meanings displayed.
- The activity still disables hardware acceleration for the previously observed
  recording-related graphics failure. That mitigation remains in place. These
  observations isolate the fixed-layer painting path on this device; they do
  not establish a specific upstream rendering defect or its full trigger sequence.

Implemented: ordinary word-help portals and speech overlays use absolute
positioning, with viewport measurements converted into their document/dialog
coordinates. Desktop native popovers retain viewport positioning. The speech
overlay has zero layout extent so it cannot expand a scrolling dialog merely by
covering the viewport. Existing scroll/resize observers continue to reposition
the measured elements. No text replacement, language exception or speech-timing
change is involved.

Automated verification: 92 reading-component tests passed, including new
document-scroll and dialog-border/scroll coordinate regressions. Production
frontend build, stylesheet checks and generated design-system checks passed.

Device verification: rebuilt and installed the standalone debug APK, confirmed
the new bundled assets and absence of diagnostic style injection, then created
a fresh live conversation. The first word popup rendered at normal size before
any reload. Android input taps opened word help and dismissed it outside the
card. Reply playback and token playback produced visible, correctly placed
highlights; the token popup remained correctly sized during playback. The
second-step word-detail dialog also displayed its highlight over its own source
word. Screenshots are retained locally under
`.local/e2e/android-reading-2026-09-27/` (not source-controlled).

Limits: the precise upstream cause of the intermittent fixed-layer corruption
is unresolved. Other phones, desktop native popovers and long scrolling dialogs
have not received physical-device verification in this follow-up. A previous
conversation showed unavailable word meanings and an unknown translation
outcome; this rendering fix does not claim to fix those request failures.
No commit, version bump or release was created.
