# R1 native Custom URL default

User authorized the verified local server address `http://127.0.0.1:8765/v1` as an
editable prefill. Owned source: src-tauri/src/access.rs and src-tauri/src/schema.sql.
No UI edits, migration, live database mutation, route change, authentication bypass,
server/app launch, provider calls or Git writes.

Fresh databases store the approved URL in canonical custom configuration; existing
model defaults and bearerAuth=true remain unchanged. Existing blank profiles are
represented by custom_config.baseUrl="". Native get_access_settings exposes an
editable default only for exactly empty URLs without a bound custom credential.
This read projection does not update storage or revision. Nonempty saved URLs and
blank credential-bound invalid profiles remain untouched; explicit bearerAuth=false
is preserved. Missing/malformed configuration still errors.

Internal settings()/resolve continue to use persisted configuration. Consequently,
a displayed prefill is not an inference destination fallback. Intentionally clearing
the UI draft still sends an empty value and fails normal URL validation; no server
or save layer substitutes a URL into a submitted invalid draft.

Integration identified the related UI gate: Check/selection must not advertise an
unsaved projected value as a persisted working endpoint. Interaction owns any normal
save-before-check behavior and must use the returned revision, preserving explicit
authentication and error recovery. Saving a custom key already supplies the complete
endpoint through the existing normal save path. No mount-time silent save proposed.
UI completion/live validation is not claimed by this native handoff.

Verification: existing fresh_custom_setup_has_server_models_and_voice_enabled passed
with the canonical URL assertion; new editable_local_url_default_never_rewrites_or_
resolves_unsaved_settings passed (including explicit false auth preservation), each
1passed191filtered. Test checks read purity/revision/route, nonempty preservation,
raw empty resolution failure, cleared draft rejection and bound-key exclusion.
Clippy --lib --tests -- -D warnings passed before the final test-only auth assertion;
owned formatting applied. Source frozen and Code Quality review requested for the
projection/resolution distinction. Coaching remains proposal-only.
