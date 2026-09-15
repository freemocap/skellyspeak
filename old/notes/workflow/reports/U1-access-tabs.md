# U1 — approved AI access tabs restored

User-authorized exception to the reference UI baseline. Located the approved rebuild presentation in Git read-only: ffecddc^:src/AccountSettings.tsx, KeyBadge.tsx and styles.css. Reused the joined tab/radio-indicator presentation and keyboard navigation intentionally against current native configuration commands; did not import old account/inference state.

## Changes

SettingsAccess now renders Hosted sign-in / API keys / Custom URL tab headings with an integrated radio indicator in each heading. One persisted connection.route drives both selected heading and panel. Activation calls revision-scoped select_route; authoritative reload updates selection. Rejected changes retain the saved route with a visible error; no fallback. Left/right/Home/End move focus; Enter/Space activates the focused tab.

Fixed token checkbox overflow by applying existing check-row ownership plus scoped auto-width/nonshrinking checkbox geometry. Tabs use minmax columns and compact narrow spacing. Settings navigation calls this surface AI access instead of API Keys.

Credentials remain empty password replacement inputs; no stored secret readback. Saved-key status dot becomes a red removal cross on hover/focus, opening the existing separate confirmation. Validation uses a compact adjacent control/status icon (neutral/checking/green check/red cross); checks remain explicit, no new checks on mount. Editing invalidates prior validation state. Existing autosave, dirty/pending protection, rejected-save retention, revision ownership and returned model defaults remain. Model controls remain collapsed. Voice controls untouched.

## Verification

Build, styles:check and full frontend suite pass: 76 files / 359 tests. Settings tests: 12 passed. Added route-tab regression covering persisted selection, both masked cloud keys together, no dropdown, revision-scoped route selection and rejected route change without fallback. Existing no-secret/no-mount-validation, failed replacement/retry and confirmed deletion tests pass.

Actual SettingsAccess browser component with synthetic invoke adapter at http://127.0.0.1:1423/access.html. Reference settings shell classes used; header/nav contents are fixture scaffolding. Desktop1180×760: scroll/client width670px; narrow390×844: scroll/client width356px; checkbox13px, label contained. All three tabs inspected, keyboard activation selected Hosted panel, custom validation rendered green check, models initially collapsed. Screenshots inspected and viewport restored. No real credentials, native calls, inference, server/native edits or Git writes. Native QA remains integration-owned.

Owned files: SettingsAccess.tsx, SettingsAccess.test.tsx, two AI section labels in SettingsModal.tsx and access-specific styles.css. Source frozen for integration.
