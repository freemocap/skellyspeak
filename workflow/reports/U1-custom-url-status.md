# U1 Custom URL handoff — paused for single-agent Integration

Current edits: `src/components/SettingsAccess.tsx` removes the obsolete empty-profile heuristic that forced bearer authentication on; the editable endpoint now preserves native `bearerAuth` exactly. Model defaults remain independent. URL already renders directly from native data without a UI fallback.

`src/components/SettingsAccess.test.tsx` verifies the native default is an actual input value, saved address/authentication remain unchanged, and an explicitly cleared invalid URL survives failed save until Discard. Focused suite: 13 passed. Build passed. No broader checks run for this slice.

Unfinished integration issue: native `get_access_settings` projects a default for blank/no-key configuration without persisting it. Current Check uses persisted configuration. Saving before every Check would increment revisions and invalidate route work unnecessarily; UI currently cannot distinguish projected and persisted URLs. Integration must resolve a truthful conditional save boundary, then verify Check uses the saved revision and stops on save failure. No Check behavior was changed by U1.

Integration requested all domain work stop for credit conservation and will complete the remaining work. Current files remain intact; no Git writes, runtime restart or inference performed. The completed inline-controls handoff is separate.
