# Security audit — 2026-09-08

Historical assessment of `freemocap/skellyspeak`, starting at `bc6c84a`, plus the
local remediation described below. This is an audit snapshot, not a certification
or a claim that the application is free of vulnerabilities. Open work belongs in
`skellyspeak-docs/docs/future-work.md`; completed items here remain historical.

## Scope and method

Reviewed the React/Rust boundary, Tauri capabilities and CSP, credential storage,
provider routing, OAuth callbacks, persistence and reset, diagnostic retention,
hosted authentication and request contracts, accounting, audio decoding, deployment
configuration, mobile manifests, updater/release paths, and every Actions workflow.
Used read-only `gh` queries for repository security settings and recent CI evidence.
Queried npm and OSV using locked package versions, scanned local Git history with
Gitleaks, and ran local checks. No production attack traffic, secret reads from the
OS vault, account changes, Git writes, deployments, or releases were performed.

The Keychain prompts are evidence of an identity/persistence problem, not evidence
that someone obtained credentials. Higher-impact findings concern the build and
release trust boundary and missing repository controls.

## Findings and disposition

| ID | Priority | Finding | Disposition |
|---|---|---|---|
| S01 | High | Mutable third-party Actions and an unchecked signing executable run in privileged release jobs | Fixed locally; GitHub execution pending |
| S02 | High | Build jobs inherit unnecessary token/signing privileges | Workflow exposure reduced locally; repository default remains open |
| S03 | High | Release publication does not depend on CI | Release workflow gated locally; iOS remains independent |
| S04 | High | Unprotected main branch and no repository rulesets | Open: repository administration |
| S05 | Medium | Secret scanning, push protection, and security updates disabled | Open: repository administration and dependency monitoring |
| S06 | Medium | Repeated vault reads on preference saves; development shares release identity/storage | Vault reads fixed locally; development identity isolation open |
| S07 | Medium | Known Rust dependency advisories and maintenance warnings | Open: platform/feature assessment and upgrades |
| S08 | Medium | Docs dependency advisories and an old forced webpack version | Open: dependency upgrades and build testing |
| S09 | Medium | Operational logs duplicate private content; provider errors are not a secret boundary | Open: logging/error sanitization |
| S10 | Medium | API infrastructure work remains outside spending and abuse limits | Open: request admission controls |
| S11 | Medium | Android backup behavior is implicit | Open: explicit backup policy and device validation |
| S12 | Medium | Custom provider permits credentials over remote HTTP | Open: transport contract |
| S13 | Medium | Release verification checks presence more than signer identity; concurrent publication can race | Open: artifact verification and publication ordering |

Priorities reflect the potential impact in this application. Dependency matches,
hardening gaps, and exploitable vulnerabilities are distinguished below; an advisory
match alone does not prove an attacker can reach its vulnerable operation.

### S01 — Privileged supply-chain inputs

Before this change, release/deployment workflows used tags such as
`tauri-apps/tauri-action@v0`, `google-github-actions/auth@v2`, and
`actions/checkout@v5`. A moved upstream tag could change code without a repository
diff. The Windows job downloaded `artifact-signing-cli.exe` and executed it with
Azure signing credentials without checking a digest.

All external action references now use resolved full commit IDs. Pinned Rust
toolchain actions explicitly request `stable`. The signing CLI must match SHA-256
`ddc6f6ef68631bf367ad051d7d37109e58d46095406e1fbba60d553b10f94393`
before being added to PATH. That digest was obtained from GitHub's asset metadata
for upstream release `0.11.0`; it pins the inspected asset, not an independent
attestation that the executable is benign. Download failures and digest mismatches
abort the step.

Remaining: pin/verify other transitive tool downloads and Cloud Build builder
images; track base-image and OS-package vulnerabilities. Action pinning does not
make npm lifecycle scripts, Cargo build scripts, Gradle plugins, or upstream
tool downloads harmless. [GitHub guidance](https://docs.github.com/en/actions/reference/security/secure-use).

### S02 — Excess privilege in jobs

GitHub reported `default_workflow_permissions: write`. CI and iOS smoke omitted
explicit permissions, so eligible runs inherited this default. Checkouts generally
persisted credentials. Docs build jobs inherited Pages and OIDC write permissions.
Every desktop matrix job received both Windows and Apple signing secrets.

Local changes set read-only workflow defaults where missing, disable checkout
credential persistence, restrict Pages/OIDC permissions to deployment, and provide
Apple/Azure secrets only to the corresponding OS matrix entries. Release upload
jobs still need `contents: write`; updater signing still needs its private key.

Open: change the repository default token permission to read-only. Split building
and signing into separately controlled jobs where practical. Environment scoping
reduces accidental exposure, but code running in a signing job remains trusted.

### S03 — Failed checks could still be published

`release.yml` depended on version/draft/build jobs, not CI. The observed failed
frontend CI runs did not stop the simultaneous v0.10.2 release workflow. The
frontend job installed only root dependencies even though root Vitest discovers
`skellyspeak-docs/src/lib/downloads.test.ts`, causing its Docusaurus tsconfig lookup
to fail on a clean runner.

CI is now reusable through `workflow_call`; the Release version job depends on
those checks. The frontend job installs the docs package dependencies before its
existing suite. This gates the same source revision without looking up a possibly
unrelated successful run. The independent iOS signing/TestFlight workflow is not
gated by this change. Neither are protected-branch rules a substitute for the
same-revision release gate.

The local workflow validator passes. Only a GitHub run can establish that the
edited release workflow succeeds across hosted runners.

### S04–S05 — Repository controls are absent

Read-only API results on the audit date:

- `main`: `protected: false`; required status checks empty.
- Repository rulesets: empty.
- Actions: `allowed_actions: all`, `sha_pinning_required: false`.
- Default workflow token permissions: `write`.
- Secret scanning and secret-scanning push protection: disabled.
- Dependabot security updates: disabled.
- `.github/dependabot.yml` configures only GitHub Actions version updates.

This increases the impact of a compromised write-capable account/token or an
unreviewed mistake; it is not an anonymous-write vulnerability. Configure branch
and release-tag rules, required review/checks, least-privilege workflow defaults,
and protected release/deployment environments. Enable secret detection and
dependency monitoring across npm, Cargo, Python and containers. Review bypass
permissions, signing-key custody, and maintainer account security separately.

These settings were inspected, not changed. No live exposed secret was confirmed:
see the history scan below. Disabled scanning does not establish whether secrets
were leaked outside the inspected Git history.

### S06 — Keychain access and development identity

`settings::persist` previously read the vault on every preference save. Changing
voice speed or language could therefore request OS authorization. Settings already
retain raw credentials in Rust memory, so the extra read was unnecessary.

Startup now reads once. Serialized settings/auth mutations pass the previous
Rust-owned secret values to persistence. Ordinary saves make no vault call;
credential changes write the vault, and failed preference writes attempt rollback.
Tests cover a locked vault during preference saves, rejection of credential
changes while locked, inline migration, and rollback after a failed file write.

The inspected debug executable and debug app bundle were ad-hoc signed with no
Team ID and different code-hash designated requirements. Rebuilding can invalidate
the remembered application identity. Pure frontend navigation does not itself
change code identity, so repeated authorization within an unchanged process still
requires native reproduction. [Apple's identity explanation](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements).

Open: consistently sign development builds with a persistent certificate and give
development a separate application identifier, config directory, vault namespace,
and update behavior. The existing `macos:dev-sign` helper requires a certificate;
it does not automatically isolate development from release data. Do not solve this
by allowing all applications to read the keychain item or storing secrets in JSON.

### S07 — Rust dependency findings

OSV matches against `Cargo.lock`:

- `cmov 0.5.3`: AArch64 conditional-move correctness advisory,
  [GHSA-3rjw-m598-pq24](https://github.com/advisories/GHSA-3rjw-m598-pq24), patched
  in 0.5.4. It is in the lockfile, but `cargo tree -i cmov` for the current macOS
  target found no active dependency path. `digest` makes its `ctutils` dependency
  optional under the `mac` feature. Assess Linux Secret Service and other target
  feature sets before claiming runtime reachability; update the locked version.
- `glib 0.18.5`: unsound `VariantStrIter` iteration,
  [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
  This is associated with the Linux GUI dependency stack. No exploit or app call
  to the affected iterator was demonstrated. Plan an upstream-compatible fix and
  test Linux builds; do not force a new incompatible GTK/glib major version.
- `proc-macro-error 1.0.4` and the `unic-* 0.9.0` packages have maintenance
  advisories. These are upkeep warnings, not demonstrated remote execution flaws.

The attempted Linux dependency-tree resolution was blocked by missing uncached
crates/network restrictions. Native Linux and mobile execution were not tested.
No dependency lockfile was changed during this audit.

### S08 — Documentation dependency findings

The docs npm audit reported 30 affected dependency nodes, including propagated
parent-package reports; these are not 30 distinct vulnerabilities. Advisory-bearing
packages include `image-size`, `serialize-javascript`, `qs`, `uuid`, and `webpack`.

- `image-size`: crafted ICNS/JXL/HEIF inputs can hang parsing; see
  [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and
  [JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
- `serialize-javascript`: unsafe serialization of crafted JavaScript objects;
  [advisory](https://github.com/advisories/GHSA-5c6j-r48x-rmvq). An attacker-controlled
  object reaching the affected serializer is required; a working app exploit
  was not established.
- `webpack` is explicitly overridden to old version `5.94.0`. Its reported
  `buildHttp` SSRF issues require the relevant plugin/configuration. Do not label
  the static GitHub Pages site a vulnerable running webpack server.

Upgrade the docs dependency chain and remove or justify the override, checking
`@freemocap/skellydocs` compatibility. Avoid a blind force-upgrade or suppression.
The deployed static pages, local dev server, and CI build process have different
exposures. The successful docs build is not a vulnerability scan pass.

### S09 — Diagnostic privacy and reflected errors

`lib.rs` enables Debug logs in packaged builds. `ai.rs` logs raw structured output
and parsing failures; `commands/stt.rs` logs transcribed text. These duplicate
private content outside the dedicated trace archive. Clearing traces does not
clear these operational logs.

Provider HTTP error bodies also enter logs, IPC errors and traces without a
credential-aware sanitization boundary (`ai.rs`, `commands/stt.rs`,
`commands/tts.rs`). A provider that echoes a submitted bearer token could therefore
cause it to be recorded even though request headers are never explicitly traced.
No actual reflected credential was observed. This limits the absolute privacy
claim that traces never contain credentials.

Remove raw conversation content from ordinary logs, sanitize provider errors
before recording/returning them, and add tests using an upstream error containing
a synthetic submitted credential. Keep intentional trace capture distinct and
document its deletion/export scope. Automatic traces and persistent manual exports
are already disclosed in `privacy.md`; their existence alone is not a hidden leak.

### S10 — API spending limits do not bound infrastructure abuse

`/auth/start` has a per-instance global rate guard, but `/auth/exchange` and the
Google callback can attempt Firestore reads for arbitrary well-formed random
codes without a corresponding throttle. A random code cannot authenticate, but
it still consumes resources. The shared start limit can also be exhausted to
temporarily block other users' sign-ins.

For authenticated requests, `/v1/me` accepts a caller-selected install identifier
and reads/writes device documents without a cardinality or request-rate bound.
`record_device` uses that identifier as a Firestore document path rather than
validating the UUID contract. Paths remain beneath the caller's device hierarchy;
cross-account access was not demonstrated.

Transcription decodes uploaded media before reserving quota. An exhausted account
can still occupy decoder slots and CPU. The per-instance two-slot semaphore,
upload limit, decoder timeout and protocol whitelist help, but do not provide
per-account fairness or fleet-wide admission control. Model-spend caps are not
caps on Firestore, Cloud Run or decoding costs.

Add gateway/server admission limits to all authentication endpoints, validate and
bound device registration, and reject/rate-limit depleted or abusive accounts
before media decoding. Test concurrent use across instances. Do not describe the
current daily model budget as a bound on the entire cloud bill.

### S11 — Android backup policy

The checked-in Android application manifest has no explicit `allowBackup`,
`fullBackupContent`, or `dataExtractionRules`. Android's defaults may include
internal app files in OS backups, depending on device/user configuration.
Inspect the merged release manifest and decide whether chats, traces, and
credential-store data may participate in cloud backup/device transfer. Define
rules for both older and newer Android versions and test restore, including
Keystore-backed data. No backup was performed or inspected here.
[Android backup behavior](https://developer.android.com/identity/data/autobackup).

### S12 — Custom endpoint transport

`Settings::chat_provider` accepts any nonempty custom URL and attaches the custom
API key. Remote HTTP can transmit both conversation data and that credential
without TLS. This requires configuring such an endpoint; the built-in hosted,
OpenRouter and Groq URLs use HTTPS.

Define HTTPS as the remote-provider contract with a narrow loopback development
exception. Reject URL userinfo and secret query parameters, and test redirects and
error-URL logging. Avoid calling deliberate localhost access a hosted-server SSRF
vulnerability; the trust boundary here is the user's outbound provider connection.

### S13 — Artifact verification and publication ordering

The desktop verification step checks for reported artifact paths and any `.sig`
under the target directory, rather than verifying every current artifact against
the updater public key. The Android step checks that an APK has a valid signature,
but does not compare its signer to the configured upload-key fingerprint. Builds
intend to sign correctly, but the verification claims are stronger than the checks.

Add exact artifact/signature pairing, expected signer checks, macOS notarization
verification, and tampered/wrong-signer rejection tests before upload/publication.
Prevent overlapping or rerun release jobs from modifying an already-published
release and ensure an older finishing run cannot become latest after a newer one.
The workflow currently lacks release concurrency/version-order protection.
These checks need actual native artifacts; local unit tests cannot establish them.

## Protections confirmed by source review

- Hosted session tokens are blanked in settings IPC; saved API keys are masked.
  Provider calls and stored raw credentials are owned by Rust.
- Frontend model text renders as React elements, without raw HTML execution.
  Packaged CSP restricts network connections; opener scope limits webview URLs.
- Sign-in uses a system browser, S256 PKCE, callback state, strict redirect targets,
  short-lived codes, and transactionally consumed auth records. JWT verification
  fixes the accepted algorithm and checks issuer/expiry; account token versions
  provide server-side revocation.
- Hosted model IDs and request shapes are allowlisted, requests are size-capped,
  and provider usage is reserved and settled transactionally. Unknown usage keeps
  its reservation rather than becoming free. Runtime concurrency claims still
  require the Firestore emulator/live environment.
- Uploaded audio is container-restricted, duration-limited, and decoded with a
  pipe-only protocol whitelist and timeout. The runtime container uses a non-root
  user and pinned Python/uv image digests.
- Persistence uses synced temporary files and atomic replacement. Factory reset
  rejects symlink roots and completes before application workers start.
- GCP deployment uses OIDC federation and separate intended build/runtime service
  accounts in source, rather than a committed service-account key.

## Validation record

Results are this audit's historical measurements, not maintained product totals.

| Check | Result |
|---|---|
| `cargo clippy --lib -- -D warnings` on macOS arm64 | Passed |
| `cargo test --lib` | 164 passed; 2 intentionally ignored |
| `npm test` | 297 passed across 59 files |
| Root `npm run build` | Passed |
| Docs `npm run build` | Passed; Docusaurus update-check cache access failed separately |
| Actionlint 1.7.12 | Passed; optional ShellCheck/Pyflakes integrations unavailable/disabled |
| `git diff --check` | Passed |
| Root `npm audit --json` | No advisory matches |
| Docs `npm audit --json` | Failed advisory gate: 30 dependency nodes; 20 high, 9 moderate, 1 low |
| OSV batch queries for Cargo and uv locks | 660 registry package/version entries; matches only in Rust, none in Python |
| Gitleaks 8.30.1, redacted local Git history | 527 commits; 12 matches, all triaged as synthetic test fixtures or a source-code reference |
| `uv run --frozen --group dev pytest -q` | 132 passed, 4 failed because `ffmpeg` is missing, 5 Firestore tests skipped |

Python tests used uv's resolved Python 3.14 environment on this Mac; production
uses Python 3.12. The missing decoder is a test-environment failure, not a reason
to bypass the tests. Server source was not modified. Gitleaks scanned available
local Git history, not deleted remote objects, external logs, or private storage.
OSV/npm checks do not cover FFmpeg, OS libraries, container vulnerability databases,
Gradle artifacts, or every tool downloaded by Actions.

## Required follow-up and limits

1. Review/apply repository protections and scanning settings; review environment
   approval policy and access to signing keys.
2. Test these local edits on clean GitHub runners and native devices. Establish
   stable, isolated development signing and validate Keychain behavior after rebuild.
3. Address dependency advisories, diagnostic sanitization, API admission limits,
   transport policy, Android backup rules, and artifact verification.
4. With GCP read access, inspect actual IAM grants, WIF conditions, Firestore rules
   and TTL policies, secret versions/access, Cloud Run configuration, log retention,
   image scans, quotas and billing alerts. The setup script alone does not prove
   those controls are deployed. `gcloud` was unavailable in this environment.
5. Run server tests with FFmpeg and the Firestore emulator, then perform controlled
   sign-in/replay/revocation, backup/restore, and signed-update acceptance tests.

No production remediation or repository-setting change is implied by a local
fix. This audit did not establish an active compromise, and does not close the
open findings merely because desktop unit tests pass.

## Subsequent local remediation on 2026-09-08

The findings above describe the audit snapshot. Subsequent changes in this
working tree address S07–S13 as follows:

- Compatible Rust dependency updates include cmov 0.5.4. The current Tauri GTK3
  dependency still includes glib 0.18.5 (RUSTSEC-2024-0429); proc-macro-error and
  unic maintenance advisories also remain. No incompatible glib override applied.
- Docusaurus is 3.10.2 and SkellyDocs 0.3.16. Compatible serializer, UUID and qs
  overrides remove their advisories. The remaining npm audit reports derive
  from image-size's unfixed parser denial-of-service advisories.
- Transcript/model-output/plan/email logging and raw provider HTTP/SSE error
  reflection were removed from the affected paths. Fault details remain visible
  in the UI; intentional local trace records retain their documented content.
  Uvicorn access logging and HTTPX informational logging are disabled in runtime.
- Shared daily auth/account request counters, local ingress throttling,
  purpose-signed OAuth admission proofs and bounded UUID device registration
  constrain admitted infrastructure work. Audio reserves before upload/decode;
  unknown provider costs and incomplete streams retain their whole reservation.
  A pricing discrepancy blocks new spending persistently across midnight.
- Desktop debug credentials and storage use a separate identity. Android now
  explicitly excludes cloud backup and device transfer. Custom remote provider
  endpoints require TLS; credential-bearing provider clients reject redirects.
- Releases serialize, reject overwriting published releases and refuse a latest
  downgrade. Updater signatures are checked cryptographically against the app
  key, with a tampering/missing-payload regression test. APK signer identity is
  compared against the configured upload certificate.

Live configuration, dependency blockers, stable macOS signing/device validation,
GCP log retention and provider spending controls remain explicit operator work
in `SECURITY-OPERATIONS.md`. No cloud deployment or Git write was performed.
The latest observed GitHub CI failure was a missing @docusaurus/tsconfig during
root Vitest discovery; the revised workflow installs the docs dependencies.

Validation after remediation: frontend tests and production build passed;
Rust library Clippy with warnings denied and library tests passed (native-device
checks remain ignored); the standalone updater verifier passed Clippy and its
valid/tampered/missing-payload test; the server suite passed with FFmpeg and the
checksum-verified Firestore emulator, including independent-process spending,
signup and request-admission races. Additional signed-code/device-limit tests
passed. Docusaurus production build and actionlint passed. No Windows/Linux,
Android physical-device, macOS signed-rebuild or live-cloud guarantee is inferred
from these local results. The shared working tree also contains concurrent UI
changes outside this security remediation.
