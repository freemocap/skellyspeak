# Security audit — 2026-09-10

Scope: active GitHub workflow and Cloud Build deployment, all hosted route handlers,
authentication, admission, accounting, audio decoding, streaming, diagnostics,
native credential storage and provider transports, current API-key forms, Tauri
permissions/CSP, and local database access. GitHub settings were read through its API.
The deployed hosted chat was confirmed working by the user. Changes described below
are local source changes until committed, built and deployed/restarted.

## Current pre-deployment result

The active source review and local verification are complete. No confirmed
embedded credential or authentication bypass was found. Production IAM, OIDC
trust conditions, repository settings and managed request-log retention were not
re-read in this pass; statements about those settings below are not fresh checks.
No cloud configuration, deployment or Git writes were performed.

### Changes in this pass

- Deployment provisions and verifies ACTIVE TTL policies for eight explicit
  collection groups before creating/promoting a revision. The helper reads field
  configuration only and emits fixed status codes. Permission errors and incomplete
  activation stop deployment. Runtime IAM is unchanged; see server/README.md for
  the build identity's minimal permissions. Cleanup is asynchronous, independent
  of session expiry and duplicate rejection. Unresolved reservations have no TTL.
- Cloud Build upload uses an explicit file allowlist, excluding local test tooling,
  private environment files, session credentials and administrative reporting tools.
  The runtime image has a separate explicit source allowlist.
- Session JWTs require a nonnegative integer revocation-version claim and a valid,
  bounded subject. Missing or malformed claims are rejected as authentication errors.
- Server-controlled OpenRouter requests explicitly disable provider fallback while
  preserving price caps and required-parameter enforcement.
- Deployment checks unauthenticated protocol and grouped-operation endpoints
  return 401. PR verification has a separate concurrency group from production
  deployment so a PR cannot occupy the production deployment queue.
- Privacy documentation accurately states the transient key-entry/IPC lifetime.

### Verification

- Server tests: 196 passed; seven emulator tests skipped in the ordinary run and
  all seven passed in a separate real-emulator transaction run.
- pip-audit: 46 installed server packages, no reported vulnerabilities.
- npm production audit: zero reported vulnerabilities.
- OSV: 792 locked package identities checked, including development/platform
  dependencies. Rust findings remain as documented below; no PyPI/npm findings.
- Gitleaks: 144 active source paths considered, zero matches; working diff zero
  matches. Full reachable-history scan returned the same 21 previously reviewed
  synthetic/code-reference matches. No raw matched values were printed.
- Exact-value check: local API keys and local session token absent from active
  source input. Private local.env permissions are 600.
- Git whitespace check passed. Cloud container build and production smoke tests
  remain workflow checks; they were not executed locally in this pass.

### Deployment boundary

A source audit cannot establish the deployed service's permissions or behavior.
The build identity may need the documented TTL-management custom role. Do not
grant Owner/Editor or add administration access to the runtime identity to make
deployment pass. TTL activation can exceed ten minutes; the deployment then stops
with TTL_ACTIVATION_PENDING and can be rerun after activation completes.
A successful deployment must still be followed by authenticated diagnostics and
one hosted chat. Grouped chat has per-account distributed concurrency/duplicate
protection; standalone chat and audio retain their own admission, spending and
resource limits, not the grouped operation identity protocol.

The Linux/BSD GTK advisory is a Linux release gate, not a server-deployment blocker.
Maintenance advisories remain visible; no suppressions or compatibility shims
were introduced.

Guidance used: [Google TTL policies and permissions](https://firebase.google.com/docs/firestore/ttl),
[GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use),
[GitHub OIDC trust](https://docs.github.com/en/actions/reference/security/oidc).

## Findings fixed in source

| Priority | Finding | Resolution and verification |
| --- | --- | --- |
| P2 | A saved custom bearer key remained usable after its API base URL changed, potentially sending that key to a different host, port or tenant path. | Native saves reject destination changes unless the key is explicitly replaced or removed. Model-only changes retain the key. Tests cover host, port and path changes and route independence. |
| P2 | Unix application data used ordinary directory/file defaults. The inspected directory was 755 and database 644; other local users could read the database if parent traversal permitted. | Startup creates/restricts the app directory to 700; database and lock are 600. Failure is explicit. The app directory cannot be a symlink. Regression tests cover existing permissive modes. This takes effect on native restart; Windows ACLs were not verified. |
| P2 | Nonstreaming chat, OAuth token exchange and transcription buffered upstream responses without byte ceilings. | Responses are read incrementally with retained-body limits of 4 MiB, 64 KiB and 256 KiB respectively. Redirects are explicitly refused. Tests prove early termination without Content-Length and that redirects do not receive credentials. Existing timeouts and spending settlement remain enforced. |
| P3 | Some authentication/contract errors echoed submitted strings; framework validation had a separate error format. Configuration repr included secret fields and numeric errors echoed invalid configuration. | Errors now use fixed descriptions and correlated IDs; config repr omits secrets and numeric conversion errors omit values. Regression tests assert sentinel values never appear in these responses/logs. This was unnecessary reflection, not evidence of leaked server credentials. |
| P3 | Local Docker build context lacked an exclusion file, although image COPY statements were already explicit. | A strict server/.dockerignore includes runtime modules and locked build inputs only. Cloud upload includes this file. Local environments, test files and admin tools are excluded from the Docker context. |
| P3 | Server test gates only ran for pushes/manual deployment; jobs had no explicit duration caps. Failure text suggested changing invoker permissions based solely on 403. | Pull requests run unprivileged test/container jobs. Deployment permits main pushes/manual runs only; jobs have 20-minute limits. Failure instructions require diagnosis before permission changes. |

## Repository settings requiring owner action

Verified through the GitHub API:

- Repository secret scanning and push protection: disabled.
- Dependabot security updates: disabled. GitHub's dynamic Dependabot Updates
  workflow exists; its existence does not establish that security updates are enabled.
- Default workflow token: write. The checked-in workflow overrides this to read
  and grants id-token:write only to deployment, but future workflows could inherit write.
- Main branch: unprotected. Allowed actions: all; organization/repository SHA
  pinning is not required. All checked-in action references are full commit SHAs.

Use the repository's [security settings](https://github.com/freemocap/skellyspeak/settings/security_analysis):
enable Secret scanning, Push protection and Dependabot security updates. Labels may
be grouped under Secret Protection / Code Security. See [GitHub's settings guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository).

In [Actions → General](https://github.com/freemocap/skellyspeak/settings/actions),
set Workflow permissions to **Read repository contents and packages permissions**.
Consider requiring full SHA pinning at repository/organization level.

In [Rules → Rulesets](https://github.com/freemocap/skellyspeak/settings/rules), create
an active rule targeting main that blocks force pushes/deletion and requires reviewed
pull requests. Once the new PR workflow has run, its Server tests and Container starts
and serves checks can be required. Account for paths-filtered workflows when defining
required checks: do not block unrelated app-only PRs waiting for a skipped workflow.
Review requirements change the current direct-push process; configure the intended
owner/bypass policy deliberately. None of these settings was changed by the agent.

## Secret and dependency scans

- Gitleaks 8.30.1, official release binary checked against its published SHA-256,
  scanned 572 reachable commits (approximately 48 MB) with full redaction. Its
  21 matches were individually inspected: 19 synthetic test credentials and two
  code-variable references. No confirmed secret. Working-diff scan: zero matches.
- An independent targeted-pattern scan covered 3,298 reachable Git blobs and found
  no known provider key, private-key, GitHub-token or AWS-access-key patterns.
- OSV queries covered 792 distinct ecosystem/name/version combinations from npm,
  uv and Cargo lockfiles, including development and platform-specific dependencies.
  No PyPI or npm advisories were returned. Only public package coordinates were sent.
- Seven Rust packages returned advisories. glib 0.18.5 has
  [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html), an
  unsound VariantStrIter implementation, patched in >=0.20.0. The locked dependency
  path runs through GTK/WebKit and Tauri's Linux/BSD target dependencies. The active
  macOS build does not compile that GTK path. Reachability of the affected iterator
  in a Linux build is unverified. Treat this as an unresolved Linux release gate;
  upgrading only glib cannot replace an incompatible 0.18 transitive requirement.
- proc-macro-error and five unic-* packages have unmaintained advisories. The former
  comes through GTK macros; unic-* comes through urlpattern → tauri-utils. These
  are maintenance risks, not six demonstrated exploitable vulnerabilities. Follow
  compatible upstream Tauri/dependency changes; no advisory suppression or vendored
  fork was introduced. See [proc-macro-error](https://rustsec.org/advisories/RUSTSEC-2024-0370.html)
  and [unic guidance](https://rustsec.org/advisories/RUSTSEC-2025-0100.html).

Scanner results do not prove absence of unknown vulnerabilities or unusual secrets.
The scans do not cover inaccessible Git refs, GitHub issue/PR attachments, account
secrets, private cloud logs, all binary assets, or OS/ffmpeg container packages.
Raw downloaded runtime logs include OAuth query parameters: keep them outside the
repository and public Actions output. Redacted local scanner reports are temporary
artifacts, not committed uploads. No credential validity probing was performed.

## Endpoint and data-flow review

| Surface | Trust boundary and observed controls |
| --- | --- |
| GET /health | Bounded liveness lane; no account or provider lookup. A 200 is not an inference test. |
| GET /auth/start | Redirect allowlist, S256 challenge, bounded local/daily admission, signed opaque state. Opens Google in the system browser. |
| GET /auth/callback/google | Signed one-use state consumed transactionally; Google signature, audience, issuer and expiration checked; account ceiling applied. Returns a short-lived code, never a session token in the URL. |
| POST /auth/exchange | 4 KiB upload cap; signed code, expiration, atomic consumption and matching verifier. Session is returned in a no-store response. |
| GET /v1/me | Session verification, revocation and admission before account access; returns only caller profile/usage; bounded device registration. |
| GET /v1/diagnostics | Same session/revocation boundary, separate daily diagnostics lane; caller-only metrics and shared blocked flags; no reset/admin capability or provider request. |
| POST /v1/chat/completions | Authenticated, bounded input and approved model/routing/pricing contract, transactional reservation before provider call, conservative unknown-outcome accounting and shielded settlement. SSE events have byte and duration limits. |
| POST /v1/audio/transcriptions | Authenticated, two decoder slots, 25 MiB upload cap, bounded metadata, forced container selection, ffmpeg pipe-only protocols and decoding limits; reserved spending before processing. |
| Framework documentation routes | Default OpenAPI/docs routes expose API schemas, not credentials. They remain anonymously accessible through the anonymous admission gate; no admin functionality is registered there. |
| Native OpenRouter/Groq checks | Fixed HTTPS destinations; verification only, no inference; OS credentials read natively; redacted failures and bounded response bodies. |
| Native custom route | Explicit URL and bearer/no-auth selection; HTTPS except intentional loopback HTTP; no redirect or automatic provider/key fallback. New destination guard binds retained custom keys to their saved base URL. |
| Administrative Python tools | Not HTTP endpoints; excluded from runtime image. They require operator credentials and may expose private account reports locally. Never run them in public Actions logs. |

Session signing uses HS256 with a >=32-byte configured secret and expiry. Signing-key
entropy still depends on secret provisioning; length checks do not establish entropy.
OAuth state and application codes use separate purpose-bound MACs and transactional
consumption. Account token-version checks provide revocation. No wildcard CORS or
new unauthenticated administrative endpoint was found.

## App/API-key review

Current forms use masked inputs, bounded key length, no saved-key reveal and
clear/delete separation. Native commands return configured flags, not key material.
SQLite stores credential references; entered keys live transiently in frontend/IPC
memory and are cleared after successful saves. Zeroizing native buffers reduce
plaintext lifetime but cannot erase every copy made by the UI or HTTP stack.
The active UI renders text through React rather than raw HTML injection.

Native provider calls have certificate verification, explicit timeouts, response
bounds and no redirect following. Tauri CSP confines network connections to IPC;
capabilities name local main/AI windows without remote URL grants. The OS keychain
remains the credential authority; actual Keychain ACLs, signed-release behavior and
Windows credential/data-directory permissions require platform-specific validation.

Scheduler concurrency is bounded to two requests; attempts are atomically admitted,
credential changes invalidate unpublished work, and retries are explicit. Restarted
unknown outcomes are not automatically resent. These tests do not retrospectively
identify the source of the previously observed traffic bursts.

## Deployment and residual cloud risks

There is one checked-in workflow, Deploy server, plus GitHub's dynamic Dependabot
workflow. Reviewed controls include full-SHA actions, persisted checkout credentials
disabled, main-only cloud identity, WIF instead of a service-account key, bounded
CI jobs, strict upload/runtime inputs, non-root container, digest-pinned helpers,
and exact ready revision/image verification before explicit 100% traffic promotion.

Actual WIF repository/ref conditions, runtime/build/deploy IAM bindings, secret
access scope, Firestore TTL policies, log access/retention and provider-side spending
caps were not audited live. App logs exclude raw URLs and secrets, but Cloud Run's
managed request logs are separate. Their OAuth query exposure requires review of
retention and access. Authentication and in-process throttles are not edge DDoS
protection or a hard infrastructure cost cap. Do not loosen IAM to repair a quota
error. Do not disable direct Cloud Run ingress without a configured alternate route.

## Verification and next steps

169 server tests pass; six Firestore emulator tests are CI-only for this change.
50 native tests and 30 frontend tests pass. Frontend build, generated contracts,
Rust format/Clippy, workflow YAML and Docker context consistency checks pass.
Native loopback tests required sandbox network permission; they make no paid calls.
The previous deployed commit passed all six emulator tests and the container gate;
that does not establish deployment of this audit's changes.

1. Review and commit the local changes, including server/.dockerignore. Push to run
   server CI/deployment. Restart the native app to apply key-destination and filesystem
   permissions; no native release was produced by this audit.
2. Enable repository safeguards above; review live cloud IAM and managed logging.
3. Keep the GTK advisory as a Linux/BSD release blocker until a compatible upstream
   fix or a documented reachability assessment resolves it. Track unmaintained
   dependencies through compatible upstream upgrades.
4. Confirm hosted diagnostics and one chat after deployment. Confirm ordinary saved
   OpenRouter/Groq use after native restart; custom destination changes now require
   explicit replacement/removal of a saved custom key.

This applies [OWASP secure review](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html),
[REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html),
[secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
and [GitHub Actions security guidance](https://docs.github.com/en/actions/reference/security/secure-use).
The concrete limits and supported-platform decisions are application choices;
following guidance does not confer security certification.
