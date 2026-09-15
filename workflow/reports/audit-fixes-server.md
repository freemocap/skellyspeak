# Server audit repairs — 2026-09-14

Implemented A01/A04/A11/A12/A17 in the shared working tree. No deployment, provider calls, cloud upload, commits or pushes performed.

## Changes

- **A01 — upload boundary:** `.gcloudignore` now re-excludes `server/*` after opening the server directory, then includes only required files (including `model_routing.py`). `server/check_upload_manifest.py` invokes the actual gcloud matcher on a temporary fixture and rejects private/token/.venv/test sentinels. It also verifies every Docker/build input is present. Parent added the CI invocation after setup-gcloud.
- **A04 — pre-submission accounting:** Groq adaptation and JSON serialization checks happen before reservation. Invalid preparation returns item HTTP 400, finishes its claim as failed, creates no reservation and never calls a provider. Only the explicitly named `word_gloss_v1` schema receives gloss endpoint relaxation; unrelated spans unions pass unchanged. Submitted unknown usage retains conservative charges.
- **A11 — correlated logs:** grouped failure logs include server-generated request ID, zero-based item index, bounded error code and allowlisted exception class. `group_finished` records correlate completion/count/error metadata. The local private-log filter preserves those fields without raw error text or client identifiers. NDJSON response shape is unchanged.
- **A12 — historical reconciliation:** only the receipt-verifying reconciliation path opts into finalizing reservations after the UTC day plus 91 days when dependent 90-day ledgers have expired. Surviving old ledgers receive their correction; missing ones remain deleted. The reservation records historical finalization and normal settled retention. Young missing ledgers, unverified receipts and ordinary settlement still fail. Verified overages still pause spending.
- **A17 — docs:** corrected inference limits (600/2,400; 2,460 combined), account leases (64), grouped provider support and current Custom URL status; separated historical verification; documented upload checks, safe correlation and historical reconciliation; repaired the focused-review link to `notes/SERVER-REVIEW.md`.

## Verification

- `server/.venv/bin/python -m pytest server -q`: **272 passed, 7 skipped**, 2.51 seconds. Skips require the Firestore emulator.
- `server/.venv/bin/python server/check_upload_manifest.py`: **passed** using the actual installed gcloud CLI with isolated temporary config and synthetic files.
- Negative manifest verification: restoring the previous broad inclusion in a temporary fixture correctly fails due to unexpected uploads.
- `git diff --check -- server .gcloudignore`: passed.

New regressions cover unrelated schemas, malformed/nonnumeric preparation and zero submission/charge, two concurrent groups' log correlation, local log redaction, missing either/both historical ledgers, idempotence, young-ledger rejection, overage pause, and receipt validation before historical finalization.

## Integration notes

CI command: `python server/check_upload_manifest.py` after setup-gcloud; authentication is unnecessary. The checker is tooling and must not enter the hosted container/source allowlist.

No source change retroactively removes any archive uploaded by earlier deployments; the audit did not establish a historical credential leak. Historical finalization does not add a Groq receipt API or infer a free charge for an unverified provider refusal. Live Cloud Run, provider billing, Docker startup and emulator transactions are not claimed as verified by this repair pass.
