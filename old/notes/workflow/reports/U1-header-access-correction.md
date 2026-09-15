# U1 — compact header and AI-access draft recovery

## User correction implemented

Removed DifficultySlider and its dedicated heading/stop-label CSS/tests. DifficultySelect uses the exact chat-language-picker class beside Native inside the shared conversation-languages row. The five generated native values and autosave/updateSettings/beforeSend barrier remain unchanged. ConversationHeader now owns that small presentation shell and accepts the existing header actions; GuidedPage and the full-pane review fixture use the same component.

The header uses existing chrome2 and line2 tokens against the paper chat canvas. Header action contrast was corrected for that surface. Language/difficulty controls retain identical fonts, heights and padding. The Lesson & coach button now has an owning compact rule instead of an unstyled browser default. No extra heading, slider alternative or additional vertical padding retained.

Applied NN/g principles: shared background/boundary groups controls as one functional region; contrast separates that region from message content. Source: https://www.nngroup.com/articles/principles-visual-design/ . Practical measurement and full-pane review requirements added to ui-guidelines.md, including the explicit difficulty-outside-gear exception.

## Measured visual review

Read the exact user screenshot codex-clipboard-793bff14-9c49-4174-a187-e4033b171390.png. Native CUA inspection timed out twice (first212s, retry9s); no approval question or native screenshot was returned. No claim of native visual verification.

Full actual-header/component fixture: http://127.0.0.1:1423/header.html, explicitly synthetic/no inference. Includes language selectors, gear, Lesson & coach, new-chat action, full paper canvas, composer, adjacent Lesson/Analysis/Profile and coach dock. At viewport1180, chat pane590: header49px, all three selects30px high at identical top50px, shared 13px font and3px4px padding. Full image inspected; all three controls fit one row directly beside Native. First iteration wrapped and measured77px; corrected before handoff.

At viewport390: header77px, all selects30px; difficulty wraps to the second line with the same treatment. Full narrow image inspected, scrollWidth390. Viewport restored. These are density/geometry results, not only an overflow assertion.

## AI-access recovery

Root/Reliability reported native validation failures and identified a dirty-draft lock in SettingsAccess. Source audit confirms busy OR dirty blocks SettingsModal close and route changes; rejected saves retained dirty with no discard action. This is a source-supported interaction trap; U1 did not independently diagnose native keychain/blocking failures or inspect raw private logs for this slice.

Added explicit Discard changes for unsaved edits: restore last loaded field values locally, clear pending replacement strings/error/dirty lock, preserve saved credentials and route. Tooltip states its scope. Reverting edits to the loaded value also releases the lock. URL and OpenRouter model fields now wait for blur, matching credential/custom model editing instead of attempting save during incomplete typing. Failed values remain visible for correction/retry/discard. Active writes stay protected.

SettingsAccess originated in ffecddc; accepted tab/radio UI and Custom defaults were subsequent U1 changes. The difficulty/profile slice did not modify SettingsAccess. Current recovery does not replace those tabs or restyle AI access. Manual credential-validation control behavior predates this correction and is separate from the trapped-draft cause; no claim it was introduced by the difficulty change.

## Gates and limits

Final style check/build passed; full frontend suite passed with 81 files / 386 tests after the fresh-key recovery regression. New select tests preserve zero mount/focus requests and deliberate selection; recovery tests cover failed save -> discard -> unlocked routes/close callback and no URL request while focused. CQ final review requested for density/equal select styling and recovery semantics. Native keychain/relaunch work remains Integration/Reliability-owned. No Git mutation, native reset or data rewrite by U1.

## Stable dimensions across all five selections

Every value was selected through the actual browser select, at both viewport widths. At590px pane: header49px, controls30px high/top50px, widths80/77/118px (Target/Native/Difficulty). At390px pane: header77px, controls30px high; Target/Native top33px, Difficulty top67px; widths77/74/100px. These measurements were identical for absolute_zero, beginner, intermediate, advanced and fluent. Full images were emitted inline in U1’s browser tool results. The tool returned screenshot bytes without a filesystem artifact; the live fixture and its full source are in /tmp/skellyspeak-coach-sizing/header.html and header-fixture.tsx.

Fresh-key recovery regression uses no saved keys and an empty initial Custom address. One synthetic key save fails validation, retained key remains editable, then Discard clears unsaved input and unlocks route/close callback. Exact command assertion: one save_access_settings with removeKey:false; no disconnect, credential deletion or select_route command during discard.

## Review closure

Code Quality independently checked590/390px fixture geometry across all five states and reviewed the fresh-key regression; correction closed. Integration independently inspected the full-pane hierarchy. Faint fixture empty-state text is an omitted fixture-only inline color: active GuidedPage applies var(--ink-mut), unchanged. Native visual verification remains unclaimed.
