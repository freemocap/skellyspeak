# Server audit — 2026-09-14

Baseline: `91856a0`. Scope: active hosted Python API, contracts/provider routing, auth, admission, accounting, cancellation, diagnostics, packaging and deployment helpers. No source fixes, deployment, live provider calls, account mutations or commits were made. Findings below describe source behavior, not observed production incidents.

## Findings

### S1 — P2: A local Groq schema-adapter failure consumes allowance without submitting work

- **Locations:** `server/main.py:712–719`; `server/model_routing.py:27–36`; `server/contracts.py:79–89`.
- **Trigger:** Submit a grouped GPT-OSS operation with a valid strict schema whose `properties.spans.items.oneOf` is a union other than the app-specific gloss/literal union. For example, `spans` is an array of string-or-integer values. General contract validation accepts it; the Groq adapter raises `ValueError("Unexpected gloss union.")` before `provider_json` runs.
- **Actual behavior:** `cost` has already changed from zero to unknown, and work state from failed to unknown. Cleanup charges the full reservation, retains the account lease, and returns `UNKNOWN_OUTCOME` despite zero upstream submissions. A controlled reproduction reserved **19,863 microdollars** and recorded **zero** outbound requests. Repeating new attempts can exhaust the learner's daily allowance entirely through local preparation errors.
- **Impact:** Incorrect allowance accounting and misleading uncertain-outcome errors; valid non-gloss schemas also collide with a transport adapter that assumes any similarly named field belongs to the app's gloss contract. This is distinct from the intentional policy of conservatively accounting for requests actually sent to a provider.
- **Recommended fix:** Complete request adaptation/serialization before marking a request submitted/uncertain. Scope gloss relaxation to an explicitly recognized gloss schema rather than matching a generic property path. A pre-submission error must settle zero, release the lease and produce a specific validation/internal error as appropriate.
- **Evidence:** Temporary test `test_adapter_error_charges_without_submission` passed against the existing HTTP endpoint and fake transaction ledger with an upstream call counter. It proves the behavior; current native app fixtures do not establish that this alternate schema is emitted by today's UI.

### S2 — P2: Grouped failure logs cannot be joined to the user's request ID

- **Locations:** `server/grouped.py:25–32`, `server/grouped.py:91–99`; `server/observability.py:47–69`.
- **Trigger:** Any provider refusal or internal exception during a grouped operation.
- **Actual behavior:** The enclosing request log reports HTTP 200 with a generated request ID as soon as response headers exist. Later `operation_failure` entries contain status, upstream status and `http`/`internal` only. They omit the enclosing request ID, provider/error code, item correlation and even the exception class for local failures. Multiple simultaneous requests therefore produce indistinguishable failure records that cannot be joined to the ID shown in the app.
- **Impact:** Support can locate the successful streaming envelope but cannot identify which operation/provider failed or associate a local failure with its cause. This materially hinders investigation of the exact kind of mixed chat/coaching/gloss failures that prompted this audit. The header log's 200 is not itself a false claim; the missing correlated terminal record is the defect.
- **Recommended fix:** Pass the server-generated request ID and a bounded per-item index into grouped execution; emit terminal operation records with an allowlisted code/provider/category and exception class. Do not add prompts, raw provider bodies, arbitrary messages, user identities or unrestricted client identifiers. Add a streaming completion/failure summary tied to the same ID.
- **Evidence:** Temporary test `test_failure_log_uncorrelated` generated an upstream 400 and confirmed that its failure record contains no request/item correlation while the response and HTTP-200 header log share a request ID.

### S3 — P2: Unresolved reservations outlive the ledgers required to reconcile them

- **Locations:** `server/budget.py:55–66`, `server/budget.py:89–105`; `server/quota.py:58`; `server/reconcile.py:49–51`.
- **Trigger:** A pending/unknown reservation remains unresolved past the usage retention period and Firestore TTL deletes its personal or global daily usage document.
- **Actual behavior:** Usage ledgers expire after 90 days; unresolved reservation documents deliberately have no TTL. All later settlement, including receipt-verified reconciliation, rejects missing ledgers with `Daily ledger is missing; refusing to create a negative settlement balance.` There is no separate historical-finalization path.
- **Impact:** The unresolved record becomes permanently unresolvable through the provided tooling even with a verified provider receipt. This is a latent accounting/retention defect, not a claim that today's development data has already reached the cutoff.
- **Recommended fix:** Define a coherent unresolved-accounting lifecycle: retain the minimum necessary dependent ledger state until resolution, or provide a verified historical-finalization path that does not recreate deleted daily balances. Preserve the existing protection against negative/recreated balances; do not simply remove the guard. Add TTL-expiry/reconciliation coverage.
- **Evidence:** Temporary test `test_old_unknown_cannot_reconcile_after_ledger_ttl` creates and marks a reservation unknown, removes the two daily ledgers to model TTL cleanup, then confirms receipt-based settlement fails. Live TTL timing was not tested.

### S4 — P3: The active operational README states materially different limits and model support

- **Locations:** `server/README.md:18–21`, `server/README.md:117–130`, `server/README.md:146–147`; compare `server/admission.py:49–50`, `server/work_admission.py:22`, and `server/model_routing.py:6–8`.
- **Actual behavior:** The README says 60 per-account/240 per-process inference requests per minute and 300 combined; code enforces 600/2,400 and 2,460 combined. It says eight account leases/slot identities; code permits 64. It says the grouped endpoint supports Gemini only; the code and newer section of the same README route GPT-OSS to Groq and other text IDs to OpenRouter.
- **Impact:** Operators and reviewers use incorrect throughput/in-flight bounds and contradictory protocol guidance when estimating load or diagnosing rejections. This is operational documentation debt with concrete values, not a stylistic preference.
- **Recommended fix:** Consolidate the current contract/limit description and label historical verification explicitly. Reference or generate the constant values instead of appending new, contradictory descriptions below old ones.
- **Evidence:** Direct code/document comparison. No runtime test required to establish these mismatches.

### S5 — P1: Cloud upload allowlist includes private server files and the entire virtual environment

- **Locations:** `.gcloudignore:1–2`; `.github/workflows/deploy-server.yml:203–212`; compare `server/.dockerignore:1–22`, `server/test_deployment.py:93–101` and `.github/workflows/deploy-server.yml:120–121`.
- **Trigger:** Run the documented root-level Cloud Build submission from a developer checkout containing `server/local.env` or `server/.local-server/session-token.txt`. The current GitHub job starts from a clean checkout, so that path alone does not establish that developer secrets have been uploaded.
- **Actual behavior:** `!server/` re-includes every descendant in the actual gcloud ignore matcher. The subsequent per-file entries do not turn it into an allowlist. The upload manifest includes private credentials/session files when present, tests and `.venv` contents. `server/.dockerignore` filters the later Docker image context; it does not prevent the earlier Cloud Build source archive/GCS upload.
- **Impact:** A normal local deployment can copy provider credentials and bearer session tokens into cloud build source storage. It also uploads unnecessary tooling and tests. This is a demonstrated inclusion vulnerability, not evidence of a historical credential leak; the two private file paths do not exist in the current checkout.
- **Recommended fix:** Make the upload filter genuinely default-deny below `server/`, explicitly permit the required source/build files, and test it using the actual gcloud file chooser with harmless private-file sentinels. Check both Cloud Build upload and Docker COPY inputs. Do not change `.dockerignore` alone or rely on Git ignores for local credential protection.
- **Evidence:** An exact copy of `.gcloudignore` was tested in `/private/tmp/skellyspeak-upload-audit-0i94hq9j` with harmless sentinel files. The read-only command `CLOUDSDK_CONFIG=/private/tmp/skellyspeak-audit-gcloud CLOUDSDK_CORE_DISABLE_USAGE_REPORTING=true gcloud meta list-files-for-upload /private/tmp/skellyspeak-upload-audit-0i94hq9j` listed `server/local.env`, `server/.local-server/session-token.txt`, `server/.venv/sentinel.txt`, `server/test_sentinel.py`, `server/main.py` and `server/model_routing.py`; it excluded `outside.txt`. No archive was uploaded. Existing tests only check Docker's filter, so they miss this boundary.
- **Rejected hypothesis:** Missing `!server/model_routing.py` does **not** currently block Cloud Build: the broad directory inclusion already uploads it. Fixing the filter must explicitly retain that module.

## Additional limits requiring focused follow-up

These are coverage limits or deliberate tradeoffs, not additional confirmed defects:

- Older native code at `b64807a:src-tauri/src/grouped.rs:146` only permits uppercase letters/underscores in grouped error codes; the new provider codes contain digits and that older decoder rejects the event. Current code accepts digits, and the active server README explicitly requires an app rebuild. This is a concrete coordinated-rollout constraint, not a new baseline decoder defect or proof of a deployed-version mismatch.
- Provider HTTP refusal bodies are deliberately discarded. The client gets a provider/status classification, not the provider's detailed reason. A privacy-safe allowlist of structured provider error metadata would improve diagnosis, but raw error-body logging would violate the existing diagnostic boundary.
- `reconcile.py:40–42` only handles OpenRouter generation IDs. Unknown Groq outcomes and provider refusals without a generation ID remain manual investigation work. Do not assume all conservative charges can currently be reconciled by the CLI, and do not infer that every provider 4xx is uncharged without a verified billing contract.
- The recent permissive model change preserves explicit price ceilings and fixed Groq routing. No live model availability, parameter compatibility, provider prices or billing semantics were verified in this audit.
- In-process transaction serialization, up to 64 account leases and eight concurrent audio decodes deserve resource/latency testing against the 512 MiB Cloud Run configuration. This audit does not establish an OOM or admission-isolation failure.
- Candidate deployment verifies readiness, immutable image identity and traffic metadata. No deployed revision, live IAM, authenticated hosted chat, real OAuth flow, Docker startup or actual Cloud Run disconnect was exercised here.

## Verification and review coverage

- `server/.venv/bin/python -m pytest server -q`: **259 passed, 7 skipped** in 2.31 seconds. The skipped cases require the explicit local Firestore emulator.
- `server/.venv/bin/python -m pytest /private/tmp/test_skellyspeak_server_audit.py -q -s`: **3 passed** in 1.81 seconds; the temporary tests demonstrate S1–S3 without external traffic or persistent app data.
- Reviewed auth signature/PKCE/redirect checks, account revocation, bounded body/provider decoding, transactional reservation/settlement, grouped ownership and cancellation paths, provider payload adaptation, operation/error diagnostics, retention and reconciliation, container module inclusion and deployment metadata gates.
- S5 was independently reproduced through the installed gcloud CLI after the initial API review. No authentication bypass was confirmed. Passing mocked tests does not certify production behavior or eliminate the explicitly listed integration gaps.
