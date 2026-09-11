# U1 compact presentation — handoff

Completed integration-authorized presentation cleanup in root, preserving the old UI baseline and concurrent gloss/coach fixes. Reviewed archived CoachAnalysisPanel, ComposerHelp, TurnView and existing shared styles. No old inference/state imported, no production contract changes, no Git writes.

## Implemented

- Added presentational ErrorDetails using native details/summary and existing error styling: concise visible warning label, complete diagnostic on expansion. No effects, calls or retry behavior. Used for request, coach, word-meaning and suggestion failures. Existing explicit retry and Open Settings actions remain available.
- Empty saved-advice state renders nothing instead of a permanent missing-feature sentence. Removed coach empty-thread prose and verbose lesson-unavailable paragraph. Kept disabled Edit choices control; analysis empty state uses reference's selection instruction.
- Optional compact ActivityIndicator retains screen-reader label and existing spinner. Applied to coach, pending partner bubble, word meanings and reply ideas. Composer activity uses short labels; removed duplicate per-turn analysis status beneath bubbles.
- Scoped coach error geometry retains full composer containment and keyboard disclosure, including collapse sizing from previous handoff.
- Did not edit MessageFeedback despite initial reservation; its existing reference feedback surface remains. No request/controller/native/server semantics changed.

## Source ownership

ActivityIndicator.tsx, new ErrorDetails.tsx, TurnView.tsx, CoachAnalysisPanel.tsx, ComposerHelp.tsx, GuidedPage.tsx and scoped styles.css edits. Tests changed: CoachAnalysisPanel.test.tsx, ComposerHelp.test.tsx, GuidedPage.conversation.test.tsx. These files already contained earlier work; do not attribute their whole HEAD diff to this round.

## Verification and limits

Full frontend suite: 75 files / 354 tests passed. Tests verify absent advice leaves no placeholder and explicit error disclosure preserves failure visibility, input retention and one-command/no-auto-retry behavior. Build and styles:check passed.

Browser React component fixture at http://127.0.0.1:1423/compact.html, sourced from /tmp/skellyspeak-coach-sizing, explicitly labeled and free of inference. Uses actual ErrorDetails, ActivityIndicator, ComposerHelp and CoachDock inside a fixture shell, not a complete native conversation. Inspected screenshots at 1180×760 and 390×844; no horizontal overflow. Compact labels occupy visually clipped 1px boxes while remaining accessible. Error text expands by pointer; coach details opens/closes with Enter. Composer remains contained in narrow and desktop panels.

Native QA is ready for integration in its running root build: inspect an existing conversation, open each failure disclosure with pointer/keyboard, confirm full diagnostics and retained draft, check collapsed/expanded coach. No model call is needed for disclosure review. Native inspection through CUA encountered a macOS Workspace window-recovery prompt; left it untouched and notified integration. Browser fixture verification is not native QA. Integration/AI owns actual request failures independently.
