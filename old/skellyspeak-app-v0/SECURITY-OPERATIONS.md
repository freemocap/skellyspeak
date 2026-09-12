# Security remediation operations

Local changes are not deployed. No Git writes were performed by the agent.
Read `SECURITY-AUDIT-2026-09-08.md` as historical evidence; this file describes
remaining operator work after the local remediation.

## Dependency installation

The lockfiles already contain compatible Rust upgrades, Docusaurus 3.10.2,
SkellyDocs 0.3.16, and patched serializer/query-parser/UUID overrides. From the
repository root:

```sh
npm ci
npm ci --prefix skellyspeak-docs
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
```

No dependency upgrade command resolves the remaining image-size advisory or
GTK3's glib 0.18 advisory today. Do not force glib 0.20 into GTK3's dependency
contract or use `npm audit fix --force`. Docs builds should consume only reviewed
repository content. Rust's remaining proc-macro-error and unic notices concern
upstream maintenance. Cross-platform compilation remains required in CI.

## Spending controls

The app reserves against both per-account and global daily balances atomically.
Unknown provider charges remain fully reserved. Over-ceiling receipts trigger
`service_controls/spending.blocked`, which has no expiry and survives midnight.
An operator must verify provider prices and reconcile charges before clearing
that field in Firestore. The old daily `global_usage/{date}.blocked` flag must
also be investigated; never delete usage or pending reservations to restore an
allowance. A shutdown does not cancel requests already admitted.

Set up dedicated production provider credentials, separate from personal or
development keys:

- OpenRouter: give the production key a non-null credit limit and a deliberate
  reset period. Verify it in the key's settings; disable automatic credit
  top-ups if a fixed funded balance is desired. See
  [OpenRouter spending controls](https://openrouter.ai/blog/tutorials/team-spend-controls-setup/).
- Groq: Settings → Billing → Limits, set an organization monthly spending limit;
  restrict the production project to Whisper and set conservative audio rate
  limits. Groq documents a **10–15 minute accounting delay** and completion of
  in-flight work, so this is a backstop, not an exact instantaneous dollar cap.
  See [Groq spend limits](https://console.groq.com/docs/spend-limits).
- Do not share these keys with other apps. The local ledger cannot reserve
  charges created outside this service.

The configured service allowance remains $2/day globally and $0.50/day per
ordinary account. This bounds admitted requests under the supported pricing
contracts; it does not guarantee a maximum total GCP invoice or correct a
provider's billing errors. Paid transcription uses a declared duration tariff;
verify that tariff against Groq billing before deployment.

For a strict total-cloud-bill requirement, keep public exposure closed until
an edge rate-limit policy, direct-origin restriction, logging retention and
provider backstops have been reviewed in the actual cloud account. Cloud Run
max instances and GCP budget alerts are not hard spend caps. Rejected requests
can still incur request/database/logging charges. Existing setup scripts cover
scoped identities; they do not provision Cloud Armor/load balancing.

Inspect unresolved reservations with authorized application-default credentials:

```sh
cd server
GOOGLE_CLOUD_PROJECT=skellyspeak-api uv run --frozen python reconcile.py list
```

To configure expiry of the newly added admission documents:

```sh
gcloud firestore fields ttls update ttl --collection-group=admission --enable-ttl --project=skellyspeak-api
```

## Repository controls

These are repository setting writes for the owner to run; no commits or pushes
are included:

```sh
gh api --method PUT repos/freemocap/skellyspeak/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
gh api --method PATCH repos/freemocap/skellyspeak --input - <<'JSON'
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}
JSON
gh api --method PUT repos/freemocap/skellyspeak/vulnerability-alerts
gh api --method PUT repos/freemocap/skellyspeak/automated-security-fixes
```

Configure main/tag rulesets with the actual CI check names and your intended
maintainer bypass policy. Test the release script against those rules before
requiring protected tag creation. Updater signature verification is implemented. Independent native desktop
signer/notarization verification remains release-hardening work.

## Keychain and logs

Desktop debug builds use a separate `.dev` profile; sign in or enter keys there
once. Stable development signing still requires a real certificate identity:

```sh
security find-identity -v -p codesigning
npm run macos:dev-bundle
SKELLYSPEAK_SIGNING_IDENTITY='YOUR CERTIFICATE IDENTITY' npm run macos:dev-sign
```

The bundle is `src-tauri/target/debug/bundle/macos/SkellySpeak Dev.app`.
Unsigned/ad-hoc rebuilds may still prompt. Existing credentials are preserved.
Validate repeated rebuilds on the actual signed app before claiming the prompts
are permanently resolved.

New operational logs omit private conversation content and raw provider errors.
Content-bearing AI traces remain intentional local records. Existing logs are
not retroactively deleted. Cloud Run's own request logging is separate from the
container's disabled access log; configure sensitive OAuth-URL log exclusions
and appropriate retention in the project before production rollout.
