# Frontend audit fixes — 2026-09-12

Implemented A05, A06 and A07 from `audit-2026-09-12.md`.

- **A05:** Settings projection reads share request identity, including post-save reads. Only the latest read can adopt settings or change document language. Pending write invalidation transfers to a newer read so a superseded post-save response cannot lose its revision notification. Session refresh and post-sign-in reads use the same ordering rule. Public store resets invalidate pending requests.
- **A06:** Evidence desired scope, request identity and trailing-reload state now live in immutable, resettable store state. Selecting a cached language abandons the other language’s request and its queued reload. An obsolete completion cannot adopt data or consume the current scope’s queued reload. Reload uses the selected scope.
- **A07:** Speech authority retains a suspension permit. Pending speech captures the permit and refuses late playback after suspension, including when focus has already returned. Registration and the player’s play method also enforce suspension. Released players cannot restart. Replacing a player ends the previous utterance. Suspension-induced rejection of an outstanding media play promise is treated as intentional completion; active playback failures still reject.

## Verification

47 tests passed across these seven files:

- `src/state/settings.test.ts`
- `src/state/session.test.ts`
- `src/state/useSkillEvidence.test.ts`
- `src/features/guided/speech-player.test.ts`
- `src/features/guided/useMessageSpeech.test.tsx`
- `src/platform/playback-lifecycle.test.ts`
- `src/platform/playback-lifecycle.browser.test.ts`

Regression coverage includes controlled out-of-order reads; post-save supersession and preserved invalidation; store reset while work is pending; cached-language return; trailing reloads crossing scopes; delayed audio after suspension and after suspension/resume; independent blur/visibility/native-suspend blockers; rejected registration; released handles; cancellation versus genuine media errors.

`npm run build` passed after the store/lifecycle changes. Vite reported the existing main-chunk size warning. Two subsequent player promise regression tests also pass; final integration build is owned by the coordinating agent.

This verifies source behavior and simulated browser lifecycle events. No running native-device focus/audio check was performed. No Git writes or deployment were performed.

## Persona generation cancellation frontend (A04 integration)

`NewPersonaDialog` now reserves a native generation ID through `begin_persona_generation`, runs only the owned ID with `run_persona_generation`, and releases abandoned work with `cancel_persona_generation`. Close-button, Escape, Cancel, and unmount share the same request invalidation path. If admission returns after dismissal, the ID is cancelled without starting generation. A late run response cannot change the draft. Cancellation failures appear through the global fault reporter after the dialog is gone.

The IPC helper normalizes optional briefs before admission. Generated proposals still require explicit Create to save a contact. The native command implementation and diagnostic command contract/allowlist are owned by the coordinating agent; this frontend change depends on that integration.

13 additional tests passed in `src/features/guided/NewPersonaDialog.test.tsx` and `src/platform/ipc/persona-generation.test.ts`, including close/unmount before admission, dismissal during generation, cancellation failure, stale result suppression, and normalized IPC payloads. `npm run build` passed after these changes and the final player promise handling. The existing main-chunk warning remains. Native provider cancellation requires the coordinator’s native verification; these frontend tests mock that boundary.

## Independent integration review and focused Vibe follow-up

Read the integrated A01/A02/A10 reset/export/ownership changes and A08/A09/A11 persona edits. No additional concrete reset/export race, deadlock or data-loss regression was found in this bounded review. The storage handoff's native tests were reviewed, not rerun by this reviewer. 74 focused persona/startup tests passed independently.

The review found an adjacent A08 gap: Add a Vibe emoji retained local text, so Escape/native cancel could discard it without blur. Following coordinator authorization, `PersonaForm` now exposes a flush that collects every local list/Vibe buffer. Profile close and New persona submission use that result before saving/validating. Valid composed emoji remains editable until Enter, blur or flush; invalid pending input stays visible and blocks closing/creation. Explicit Discard clears it without saving. Callback errors outside field validation are not swallowed.

85 focused persona tests passed after this follow-up, including valid focused emoji on Escape/native cancel, invalid input and explicit Discard, and valid/invalid pending input submitted before blur. Production build passed after the Form/Profile contract change; the coordinator owns the final integrated build after the new-persona submit wiring. No device UI check or real reset was performed.

## Durable generation activity integration

GenerationActivity now reads the native global receipt view independently of the
conversation graph. It shows retained dispatched-request usage, explicit unknown
usage coverage, and up to 50 inspectable metadata-only receipts. Reads serialize;
unmount abandons late results and timers, failures remove stale totals and expose
an explicit retry. The activity container scrolls so receipts remain reachable
below the graph in dock, pop-out and mobile layouts. Connection revision labels
the captured AI authority revision. No inspection dispatches inference.

Final root integration passed 516 frontend tests, including 7 generation activity/IPC
regressions, plus the production build and style gate. This is component/source
verification; no native-device visual check is claimed.
