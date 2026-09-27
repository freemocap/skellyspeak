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

## Remaining device checks and separate findings

No Mac or Android runtime was available for visual verification. The original
Android tiny-popup rendering has not been reproduced locally; the fixed portal
avoids the top-layer and bubble clipping path, but needs a check on the phone.
Verify first-tap positioning, word audio, outside-tap dismissal and Drill target
speech on the affected devices.

Network aborts and historical `Load failed` records are not proven fixed by
these UI changes. Low-level native trace volume and misleading generic messages
on normal diagnostic events are separate observability issues; logging behavior
is unchanged in this patch. No version, commit, tag or push was created.
