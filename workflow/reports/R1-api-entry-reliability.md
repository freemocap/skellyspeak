# API-entry reliability repair

User reported stuck/frozen/baffling credential/custom-URL entry after UI changes.
Integration owns runtime/log review; Interaction owns SettingsAccess/SettingsModal.
Reliability initially reviewed source read-only, then Integration explicitly assigned
lib.rs, execution credential cleanup and access.rs narrow validation/cleanup seams.

## Evidence and limits

Integration's all-stream scan found four save_access_settings validation failures
across two native launches, no new server requests and a separate frontend TypeError
during HMR/remount. Safe read-only DB inspection showed revision2/custom route,
no configured keys, empty custom URL, bearer authentication enabled and valid-shaped
nonempty model defaults. No URL, key, model value or transcript was printed.

An empty custom URL fails native validation; the rejected user draft is unavailable,
so this is not proof of the exact observed rejection. Unused custom settings do not
participate in a Groq save (custom=None); this is now explicitly tested. Interaction
independently demonstrated dirty/error UI locking and owns its discard/blur fixes.
The unrelated mobile white-screen symptom remains undiagnosed.

## Demonstrated native blocking pattern and implementation

OpenRouter saving held Store's mutex across Keychain set_password. Custom saving
released it for writing, but both paths called cleanup/deletion while locked. Hosted
saving likewise performed credential I/O while holding Store. A slow native credential
prompt could therefore stall other workspace commands. This source issue is distinct
from the logged validation failures, which can occur before any Keychain work.

Implemented Application-owned credential-write and cleanup helpers. Under mutex,
validate preparation and reserve a fresh credential ID; outside mutex, perform
Keychain write; under mutex, release temporary write claim and revalidate/commit;
outside mutex, perform cleanup. Each cleanup ID is claimed using the existing
in-flight set before external deletion; only successful deletion retires its durable
cleanup row. Failures release temporary claims and keep durable cleanup retryable.
No credentials are reused across destinations or substituted on failure.

OpenRouter/custom/Groq/hosted save paths share this sequence. Disconnect and hosted
sign-out run blocking workers and release Store before cleanup. Existing credential
reads already use read_secret's blocking worker after scoped Store reads; no remaining
Keychain read-under-workspace-lock found in the current source. Startup cleanup still
runs during native setup, before application state publication, but does not hold the
workspace mutex during external I/O. Startup readiness is not a new asynchronous API.

Access save diagnostics now emit fixed authored codes for invalid URL/model/key,
remove/replace conflict, changed destination and revision conflict. No input/parser/
credential body is sent; existing actual error returns are preserved. UI display and
outer logging remain separately owned. No validation rule was weakened.

## Verification

- Two credential-I/O tests pass: a deliberately blocked write leaves snapshot/Store
  access available; a concurrent revision change defeats commit and deletes only the
  unused new credential; in-flight writes cannot be claimed for cleanup; failed write
  and deletion release claims and retain retryable cleanup.
- One access preflight regression passes: fresh blank URL failure, valid loopback and
  models, invalid model/key classification without private text, unused custom profile
  independence, and contradictory remove/replace rejection.
- Full native suite:191 passed,0 failed. Final Clippy --lib --tests -- -D warnings:
  passed after correcting a diagnostic inspect_err lint. No duplicate full-suite rerun
  after that side-effect-only correction. Formatting/diff checks passed before it;
  final owned formatting applied.

No real Keychain calls in tests, credential changes, provider calls, app/server
restart, database mutation or Git writes by Reliability. Source frozen for independent
Code Quality security/lifecycle review. Integration owns coordinated runtime uptake
and verification that the user can save/check/leave the form.

Independent Code Quality review closed with no new blocker. Reviewer checked
reservation/cleanup exclusion, external I/O outside Store lock, revision/hosted epoch
rechecks and retryable deletion failure including the injected tests. Final owner
Clippy subsequently confirmed clean; no real credential/runtime exercise is implied.
Final owned rustfmt and diff checks also passed. Ready for Integration runtime uptake.
