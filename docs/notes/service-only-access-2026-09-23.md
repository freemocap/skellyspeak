# Service-only AI access — September 23, 2026

Status: implemented, uncommitted. This replaces the earlier preservation design,
which the user rejected. No versioned upgrades or legacy credential relocation remain.

## Current behavior

Only Hosted sign-in and Custom URL exist. Direct provider-key entry, verification,
commands and text/audio adapters are removed. Provider credentials belong on the
server; the desktop retains secure hosted/custom session-token authentication.
Ordinary UI Settings contain no secret placeholders. Custom credential writes use
`sessionToken`/`removeToken`. Model settings use `standard_model`.

Desktop credentials are read and written only under
`com.freemocap.skellyspeak.credentials`. The retired provider-named namespace is never accessed, including for deletion. No fallback read,
copy, migration or preservation of old tokens exists. Re-establish sign-in/custom
authentication if a token is unavailable. OS authorization behavior still needs
verification in the signed app.

Schema 40 is the only supported format. The upgrade runner, frozen old schema,
upgrade notice ledger/UI, historical route-string exceptions and related tests are
removed. Incompatible development data may be deleted in the smallest practical
scope; this does not justify resets for UI edits or deleting unrelated data.
Workspace locking, foreign-key checks, schema validation and explicit failures remain.

## Verification

Native: 558 passed, six existing skips. Full UI: 1,156 passed. Clippy with warnings
denied, Rust formatting, native executable build, UI build/types, contracts,
styles/dead styles, previews and language checks passed. The previous Drill failure
was lost functionality and has been repaired, not suppressed.

See [recovery and scoped cleanup](drill-overwrite-recovery-2026-09-23.md) for the
restored wiring and the actual development records deleted. No commit or deployment.
