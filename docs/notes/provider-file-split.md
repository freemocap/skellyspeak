# Provider transport split

Status: implemented and verified, 2026-09-15.

Replaced the 1,017-line native/src/ai/transport/provider.rs with provider/:

- mod.rs: public interface, prompt message and completion types.
- keys.rs: key format and OpenRouter verification.
- payload.rs: prose/structured payloads, schema validation and input bounds.
- request.rs: HTTP client, dispatch routing and bounded completion requests.
- response.rs: response decoding, usage validation and prose validation.
- tests/: payload, key, request and response suites, plus shared local HTTP fixtures.

The ten files range from 30 to 215 lines. Tests are registered by their owning
modules, so private implementation helpers remain private. Only the shared
malformed-response error helper needs parent-module visibility.

## Preservation and verification

All 33 functions and 14 tests remain. Source comparison found no signature/body
changes beyond formatting and the shared helper's visibility. Public entry points
and serialized types remain available through the provider module. Payloads,
route delegation, response limits, timeouts, redirect refusal, error redaction,
usage handling and no-automatic-retry behavior are unchanged.

- Clippy with warnings denied passed.
- Full native suite: 354 passed, 1 ignored, no failures.
- Generated contracts and all native binary checks passed.
- All 18 UI architecture tests passed.
- Documentation links, Rust formatting and diff whitespace checks passed.

No live provider requests, manual app launch, mobile build, commit, push or
deployment was performed.

## Next work

The user explicitly deferred conversation.css to the upcoming style-system
cleanup. That is the only remaining authored source file over 1,000 lines in
the refreshed inventory; do not split it as a separate file-moving exercise.
The 500–999 danger-zone files remain review candidates, not mandatory splits.
No CSS or visual behavior changed in this pass.
