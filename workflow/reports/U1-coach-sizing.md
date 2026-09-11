# U1 coach sizing — completed handoff

Implemented in the root checkout against HEAD `5e006989a2f5d9376952a3cf55f6d713aee6e9f3`, with integration's explicit file reservation. Preserved concurrent gloss/backend work. No Git writes or native launch.

## Change

The coach dialog inherited persisted side-dock height/collapse state and a percentage cap intended to reserve lesson space. Its fixed controls could exceed available height and clip the composer. Small saved expanded dock heights had the same problem.

- CoachDock has explicit dock/dialog presentations. Dialog presentation does not read or write saved dock layout and has no resize/collapse controls. It remains expanded.
- CoachAnalysisPanel passes the presentation according to coachOpen. Existing draft, submit, watch and snapshot behavior is unchanged; this change adds no requests or inference.
- Only the coach dialog receives a definite height, capped at 640px/85dvh. Its coach region fills available space. Existing width, colors, typography and controls remain.
- Expanded docks have a 160px minimum, including legacy 88px saved values. Collapse remains 64px normally; a visible error reserves 112px so the composer and error remain accessible. Thread and errors scroll independently. The thread retains at least 32px when expanded.
- Resize, focus-to-expand and persisted collapse behavior remain. Arrow Down at minimum expanded height collapses; Arrow Up expands to the usable minimum.

Owned source: CoachDock.tsx, CoachDock.test.tsx, one presentation prop in CoachAnalysisPanel.tsx, and coach/dialog rules in styles.css. Do not treat the entire root styles.css diff as this contribution; it contains other integrated/uncommitted work.

## Verification

- Focused CoachDock/CoachAnalysisPanel tests: 10 passed, covering legacy small height, saved-collapse independence in dialog, resize/collapse/focus and existing no-inference interaction behavior.
- Full frontend suite: 75 files / 353 tests passed.
- npm run build and npm run styles:check passed after final CSS changes.
- Browser geometry fixture: dialog, expanded dock and collapsed dock at 1180×760, 390×844 and 390×360. With 20 messages, multiline draft and long error, textarea and Send were contained in every panel. Expanded thread heights remained positive (minimum 32px) with overflowing messages scrollable. Dialog stayed inside viewport, with visible Close. Collapsed error panel measured 112px.
- Additional 390×360 fixtures without errors: dialog thread 63px, expanded thread 53px, collapsed height 64px; all composers contained. Inspected the short-dialog screenshot. Restored viewport override.

Fixtures are explicitly labeled static markup using the actual stylesheet, served at http://127.0.0.1:1423/dialog.html from /tmp/skellyspeak-coach-sizing. They exercise CSS geometry, not React lifecycle or native WebKit. Unit tests cover React behavior separately. Native app validation remains integration-owned; no second app was launched. Browser fixture has no native calls or inference. Integration should verify the existing native coach dialog before claiming device QA complete.
