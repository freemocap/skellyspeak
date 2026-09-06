# Audit remediation — 5 September 2026

Implementation and automated verification are complete. Production cutover and
native-device acceptance remain user actions. Word timestamps and highlighting
are deferred; playback-speed controls are included.

## Changes

| Area | Result | Main files |
|---|---|---|
| Budget | Atomic user/global reservations, dated idempotent settlement, unknown charges retained, verified receipt reconciliation | `server/budget.py`, `transactions.py`, `reconcile.py` |
| Server contracts | Reject alternative routing, unpriced models, unsupported modalities and invalid limits; decode/bound recordings before charging | `server/contracts.py`, `audio_input.py`, `main.py` |
| OAuth | Atomic one-time code consumption, strict PKCE, bounded exchange body, account/revocation checks, stale native sign-in rejection | `server/auth_store.py`, `src-tauri/src/commands/hosted_auth.rs` |
| Credentials | Native vault, migration from inline keys, masked IPC; public-only changes avoid rewriting credentials | `src-tauri/src/credentials.rs`, `settings.rs` |
| Persistence | Atomic JSON writes, corruption preserved and reported, plan/profile saved together, deletion cannot be undone by queued saves | `src-tauri/src/persistence.rs`, `conversation.rs`, `observer.rs` |
| Conversation lifecycle | Serialized flushes, stale-load/event rejection, captured background context and single-flight coach questions | `src/pages/guided/useConversation.ts`, `src-tauri/src/commands/` |
| Prompts | One explicit precedence rule, bounded observer data, narrower analysis context and observer cadence independent of history length | `src-tauri/src/prompts/`, `commands/guided/` |
| Streaming and accounting | Shared byte-safe SSE parsing, missing completion/error detection, usage summed over retries | `src-tauri/src/sse.rs`, `trace.rs`, `server/streaming.py` |
| Voice | 0.5–1.5× speed, persisted setting, cloud pitch preservation, cache/shared synthesis, surfaced playback errors | `src/lib/speech.ts`, `src/pages/GuidedPage.tsx`, `src/components/SettingsModal.tsx` |
| Logging | IPC logs command/argument names without argument values | `src/lib/tauri.ts` |
| Deployment | Dedicated build/runtime identities, scoped permissions, restricted GitHub federation, emulator/container/revision gates | `scripts/setup-gcp-deploy.ps1`, `.github/workflows/deploy-server.yml`, `server/cloudbuild*.yaml` |

The obsolete production quota-check/charge helpers were removed. All production
admission and settlement goes through the reservation ledger. The graph remains
an execution description/reconciliation tool; it is not a second orchestrator.

## Verification

| Check | Result |
|---|---|
| Frontend | 187 tests passed; TypeScript and production Vite build passed |
| Rust | 127 tests passed; two opt-in tests ignored |
| Server | 135 tests passed; emulator tests run separately |
| Real Firestore emulator | Five passed: threaded admission, cross-process spending, cross-process account slots, midnight settlement, concurrent one-time exchange |
| Android ARM64 | Debug APK built successfully with native credential integration |
| Documentation | Production build passed |
| Deployment configuration | Three YAML files parsed; candidate built/tested under the scoped builder identity |
| Cloud Run candidate | Started successfully; health 200, unauthenticated account request 401 |
| Production | Health 200, unauthenticated account request 401; working revision retains 100% traffic |

Tests exercise actual ffmpeg decoding and actual Firestore transactions, not only
mock counters. Separate server processes share the same tested spending/account
ceiling. Browser-only preview cannot exercise this app without Tauri; it was not
counted as native visual/audio acceptance.

## Applied cloud state

- Project: `skellyspeak-api`, region `us-central1`.
- Serving revision: `skellyspeak-api-00011-r75`, 100% production traffic.
- Candidate revision: `skellyspeak-api-audit-0905`, 0% production traffic, `audit` tag.
- Candidate build: `aaa1f7b4-70e5-4526-9c3e-16e084f0fb4b`, successful.
- Candidate image: `gcr.io/skellyspeak-api/skellyspeak-api:check-aaa1f7b4-70e5-4526-9c3e-16e084f0fb4b`.
- Runtime access is limited to Firestore and five named secrets. Broad default
  compute Editor/data/secret permissions and deployer-wide storage grants were removed.
- Cloud Run concurrency is eight. Reservation TTL is active; unresolved records
  carry no expiry timestamp.
- The runtime OpenRouter key is not a management key and has a $10 weekly
  provider-side spending limit. Key material was not printed or changed.

Candidate URL: https://audit---skellyspeak-api-ndkvvlbq4a-uc.a.run.app

The reservation/API changes are in the candidate, not the production-serving
revision. IAM restrictions and concurrency changes are already live.

## Your handoff

1. Review the local changes. No Git state was changed. Commit/tag/push/release
   actions must be performed by you.
2. Arrange the native-client/server cutover together. The account response now
   uses `estimated_requests_remaining`; deploying one side alone can break the
   allowance display. The APK currently targets the production service.
3. Smoke-test Google sign-in/out and restart, credential migration, microphone
   transcription, cloud and OS playback at 0.5×/1×, cached replay, and rapid
   chat/language switches during generation. The debug APK is at
   `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`.
4. Publish the matching client and promote the candidate in the agreed release
   window. Verify account display, health/auth guards and one metered turn.
   Roll back client and server together if needed.

Signed release distribution, real Google interaction and Apple/Linux credential
vault execution were not verified on native devices in this Windows environment.
The repository privacy/operations documentation has been corrected but not
published externally.

## Operational limits

Provider token/pricing contracts underpin reservations. A billing overrun blocks
further admission after recording the actual charge; it cannot undo a provider
charge. Unknown costs require reconciliation and can temporarily consume the
allowance. Reconcile before the dated usage records become eligible for deletion.

AI limits do not cap Firestore, networking, logs or Cloud Run infrastructure
charges. Sign-in throttling is per process. Native vault/preferences writes have
rollback on ordinary failure, but are not one transaction across OS stores during
a power loss. Local model traces can contain conversation text; IPC argument
redaction does not make all local diagnostic content anonymous.

See `skellyspeak-docs/docs/architecture.md`, `hosted-api.md` and `privacy.md` for
current architecture, operational procedures and data handling.

Saved tutor memory exceeding prompt limits is migrated on load. The complete
source is archived as `memory-archive-<uuid>.json` beside `memory.json` before
the bounded active document is saved. Recent mechanics and frequent errors take
priority. Archive/save errors block loading; malformed JSON remains untouched.
Regression coverage includes both document formats, repeat startup, Unicode,
source preservation and strict validation of generated output. Rust verification:
129 passed, 2 ignored.
