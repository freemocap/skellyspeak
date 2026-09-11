# U1 — Custom model defaults (corrected)

User rejected connection-level Voice input control. Removed that checkbox and toggle tests. Custom URL config now contains model configuration only; voice behavior remains in Audio & Voice/conversation preferences.

All three model fields stay editable under collapsed Models. Missing values are filled in the form with known defaults: standard/fast google/gemini-2.5-flash, transcription whisper-large-v3. No read/mount write. Clearing a model temporarily leaves a draft blank while focused; autosave pauses, then blur restores the known default before existing autosave. No empty-to-null disable behavior. Current persisted configuration repair remains root-owned/already reported repaired.

Only SettingsAccess.tsx/tests changed. Preserved ../lib/native wrapper, route/token ownership and Audio & Voice. No schema/native/CSS/runtime/Git changes.

Verification: 8 focused settings tests pass; build passes. Tests assert no Voice input control, populated fresh defaults/no mount writes, and each of the three blank model drafts cannot save while focused and restores the correct nonnull default on blur. Earlier handoff describing a toggle is superseded by this correction. Source frozen.

## Scope lesson

A defaults-only request does not authorize a new setting or behavior control. The added Voice input checkbox exceeded the requested scope and was removed. All future UI changes must use established reference CSS and ui-guidelines.md; no unstyled controls or unsolicited settings. No further UI additions in this handoff.

## Division of labor

Interaction owns UI implementation, component choices, styling and detailed UI standards. Integration relays corrections, coordinates boundaries and reviews results. Interaction must apply both scope discipline and established styling on every change, flagging material product changes before adding controls. This ownership and the defaults-only/styling lessons are recorded in the U1 assignment guidance. No further UI changes requested.
