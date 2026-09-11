# SkellySpeak

A convivial tool for learning languages through welcoming conversations,
useful assistance and understandable progress.

This checkout is the **rebuild** branch: the next-generation application.
The published v0.13.7 application is maintained on **main** in the separate
`skellyspeak-main` worktree. Recovery is complete; see
[branch ownership and outcomes](RELEASE-RECOVERY-PLAN.md) and the
[current implementation plan](BUILD-PLAN.md). Do not merge main wholesale into rebuild.

**Current implementation: immediate chat, desktop recording/transcription, a separate
coach thread, Google sign-in and own-key text execution.** Rust persists messages, conversation settings and complete validated
replies. The toolbar **AI** panel exposes operations, model targets, attempts,
reported tokens and pause/step/cancel/retry; it can dock or open in a separate window.
**Profile** reports retained usage globally, by language and by partner. **Settings**
has searchable sections, automatically saved reading preferences and account controls.

The interface pairs a light chat canvas with a dark lesson/analysis pane. The partner
chooser selects partners and conversations; narrow windows use Chat and Lesson tabs.
Unsent drafts are session-only. Avatars are static SVGs. Evidence visualizations remain independent of domain records. No skill estimates
or XP are fabricated.

Saved partner-reply translation is implemented through the scheduler. Token glosses,
structured coaching, assessment, XP, Vibe computation and measured garden rendering
remain planned. Standard handles partner replies;
Fast has no active assignments until evaluated. Hosted access uses the service's
approved Gemini 2.5 Flash model.

## Run locally

Use Node.js 24, npm, Rust and the platform's Tauri prerequisites. Install and run:

```sh
npm ci
npm run macos:dev
```

On macOS, this builds a debug executable, creates **SkellySpeak Dev.app**, signs
and verifies it with the existing **SkellySpeak Local Development** certificate,
starts Vite, and runs the signed bundle executable. PyCharm's signed-app run
configuration uses this same command. Frontend edits reload through Vite; restart
the command after Rust changes. Quit the app or stop the command to stop Vite.
The launcher fails if port 1420 is occupied or signing fails.

The signing identity must already exist in Keychain Access → My Certificates,
including its private key. To use another certificate, run
`SKELLYSPEAK_SIGNING_IDENTITY="certificate name or SHA-1 fingerprint" npm run macos:dev`.
Self-signed local certificates are supported; no certificate trust settings are
changed. Ad-hoc signing is rejected because it cannot preserve the certificate
identity across rebuilds. If macOS requests access to an existing SkellySpeak
credential, **Always Allow** can remember access for this signed app; switching
from a previously unsigned build may require that initial grant.

`npm run macos:dev-bundle` and `npm run macos:dev-sign` are also available
separately after `cargo build --manifest-path src-tauri/Cargo.toml --bin skellyspeak`.
For other desktop platforms use `npm run tauri dev`. On macOS, that direct Tauri
command bypasses the certificate-signing launcher and may prompt again for Keychain
access after rebuilds.

Run this from the repository root. `npm run dev` alone starts frontend assets;
local storage requires the native Tauri application. Quit an already-running
SkellySpeak workspace before launching another instance of the same database.
The app fails explicitly if the workspace is locked, invalid or incompatible.

The authoritative application version is in `src-tauri/Cargo.toml`. Dependencies
are locked in `package-lock.json` and `src-tauri/Cargo.lock`.

Build an unsigned local macOS inspection bundle (use the signed launcher above
when testing saved credentials):

```sh
npm run tauri -- build --debug --bundles app --config '{"productName":"SkellySpeak Workspace","bundle":{"active":true}}'
open 'src-tauri/target/debug/bundle/macos/SkellySpeak Workspace.app'
```

The distinct inspection bundle name makes the running workspace identifiable.
This is a local debug build, not a signed release or deployment.

## Publish a release

Run these commands from the repository root of the **main** release worktree
(`skellyspeak-main`). The release script is `scripts/release.mjs` on main;
this rebuild checkout does not contain the active release script.
Have Node.js, Rust/Cargo and authenticated Git access available. Commit your
release changes first and ensure main is current with its upstream; the script
requires a clean working tree and refuses to release when main is behind.

Choose **one** command (examples assume the current version is 0.13.7):

```sh
node scripts/release.mjs patch  # 0.13.7 -> 0.13.8
node scripts/release.mjs minor  # 0.13.7 -> 0.14.0
node scripts/release.mjs major  # 0.13.7 -> 1.0.0
```

The script updates `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`, commits the
version bump, creates the matching `vX.Y.Z` tag, then pushes main and the tag.
You do not need a separate push command.

To preview a bump, use `node scripts/release.mjs patch --dry-run`. This skips
version edits, commits, tags and pushes, but still fetches remote branch state.
To create the local commit and tag without pushing, use
`node scripts/release.mjs patch --no-push`; it prints the commands to push later.

Follow the build in [GitHub Actions](https://github.com/freemocap/skellyspeak/actions).
The Release workflow publishes the draft as Latest after its checks and desktop
and Android jobs succeed. iOS distribution runs separately and does not gate
publication. Published downloads appear under
[Releases](https://github.com/freemocap/skellyspeak/releases).

## Start talking

Opening the app resumes the most recent active conversation. A fresh workspace
creates a Spanish partner and conversation automatically. The composer is immediately
available; no title or setup form is required. The plus button starts another
conversation with copied preferences. The partner chooser opens a partner's latest
active chat or creates one. Names and settings remain editable afterward.

Record starts the desktop system microphone. Stop transcribes through the selected
AI route and inserts text for review; Send sends it to the partner.
Discard cancels capture. Audio stays in memory, is capped at two minutes, and is
uploaded only on Stop. Hosted uses Google sign-in; API-key mode uses a separate Groq
key; custom endpoints require explicitly enabled transcription and a model ID. Mobile recording,
auto-send and read-aloud are not implemented in this slice.

The right pane contains Lesson/Analysis and a resizable **Talk to your coach** dock.
Coach exchanges persist separately from partner messages and use the same gated
execution machinery. Partner prompts never include coach messages. The coach can
explain or suggest phrasing; it cannot apply lesson/settings changes. Detailed lesson
controls and word breakdowns remain pending.

## Configure and use AI

Open **Settings → AI access → Hosted sign-in**, then choose
**Sign in with Google**. Complete authentication in your system browser and return
to the app. The account panel reports daily tokens, requests, monetary allowance and
its reset time. Request/token amounts remaining are estimates; money is authoritative.
The session stays in the platform credential store. There is no transcript sync.

Choose **Own OpenRouter API key** to enter a key and configure Standard/Fast models.
Keys and model settings save automatically after typing stops, with visible pending
and failure states. The saved key is checked automatically: a green check indicates
accepted authentication; a red X includes an accessible failure explanation. Key entry remains masked; saved secrets are never returned to the frontend and
there is no Show/Hide control. Model edits
retain the saved key when the key field is blank. Pasted surrounding whitespace is
trimmed. Saving errors preserve the input. Clicking outside Settings or pressing
Escape dismisses it after pending writes complete; failures keep the edits visible.
Conversation practice preferences also save automatically on change. Hosted account refreshes are limited to
the hosted route.

Verification uses OpenRouter's authenticated `GET /api/v1/key`; it does not request
inference or prove model availability or sufficient credits. Saved state and verification
state are separate. **Send** uses the selected route and the
captured Standard model. Replies are buffered and validated before publication.

Open toolbar **AI** to inspect execution.
Pause all prevents new starts; it does not revoke running work. Pause a turn and
Step to admit one operation while keeping that turn paused. The app-wide gate must
be resumed to Step. Cancel revokes publication and drops the local HTTP request;
remote execution and billing may continue. Retry is explicit and may incur another
charge. Restarted in-flight requests show unknown outcomes and never auto-retry.

The current active workspace receives an atomic v3-to-v4 AI-configuration schema
extension, preserving accepted messages, preferences and credential references.
Pending work under the earlier profile is invalidated; it is never automatically
resent. Other incompatible databases fail explicitly. No archived application data
is imported and no automatic deletion or backup path exists.

## Check this slice

1. Open the partner chooser, choose a language and create a partner. Edit the name, background or avatar.
2. Create two conversations. Change difficulty and Translation in the first.
   The next conversation starts with a copy; subsequent edits are independent.
3. Switch between the conversations and restart the app. Accepted settings persist;
   unsent drafts are intentionally session-only.
4. Archive and restore a conversation or partner. Deletion identifies its permanent
   scope before confirmation and removes dependent local records.

The app stores `practice.sqlite3` in its platform application-data directory under
identifier `org.skellyspeak.practice`. On macOS this is
`~/Library/Application Support/org.skellyspeak.practice/`. No application data is
synchronized. Send transmits selected context through the selected hosted or own-key route;
see [privacy and data flow](./privacy.md).

## Verification

```sh
npm test
npm run build
npm run contracts:check
npm run styles:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --lib --tests -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Rust integration-style tests use disposable SQLite files for persistence, revision
conflicts, settings copying, deletion, archives, duplicate actions and session rules.
Frontend tests cover snapshot ordering and draft scope. Test discovery is restricted
to the active `src/` tree. `npm run contracts` regenerates TypeScript declarations
from Rust; the check command detects drift without changing files.

Automated verification covers execution gates, duplicate Send/publication, cancellation,
source deletion, scoped snapshots, captured settings, interrupted attempts, output
validation and token retention. Loopback HTTP conformance tests exercise the actual
adapter, explicit model requests, redirect refusal and error redaction. They require
localhost networking permission and make no live AI calls.

Native request admission now shares four permits across partner chat, coach chat and
desktop transcription on all access routes. One audio request may wait for capacity;
excess waiting audio is rejected without submission. Tests cover mixed occupancy,
queue saturation, source/configuration invalidation and release on cancellation.
Queued chat/coach turns now pause on matching HTTP 429 refusals, with the reason and
earliest retry shown in execution inspection. Holds survive restart; recovery is
explicit and Step cannot bypass them. Shared access holds also block fresh Send
and transcription. Recover access in the execution panel checks the retry time
and refuses stale recovery actions; it makes no AI call and leaves queued turns
paused. Transcription receipts now retain route, model, timing and outcome;
interrupted attempts become unknown on restart and are never replayed. The execution
panel shows these receipts, and usage reports include them with unavailable token
usage. Audio and transcript text are not stored in receipts;
this limit does not establish a bound on upstream work after local cancellation.
Capacity is provisional. `WARN ai_admission` lines go to the native process's stderr
(the development launch terminal), at most once per event per minute. They identify
chat capacity waiting, audio queue rejection, or audio wait duration without request
content or endpoint details. No persistent log file or telemetry upload is added.

Automated checks cover PKCE/state validation, account decoding, hosted payload rules,
route capture, credential revocation, retained profile counts and local HTTP adapters.
Google browser authentication, keychain persistence and live hosted replies require
native verification; passing mock tests does not establish those results.
The native bundle builds successfully. Desktop and narrow-window layouts, direct
chat startup and title-free one-click creation were inspected. The keychain lookup
no longer holds the workspace lock. No database reset was needed. Microphone
permissions, recording/transcription and live coach replies remain unverified.
Hosted deployment passed its test, container and exact-revision traffic checks,
and the user confirmed hosted chat works. The client preserves documented
rate/allowance/spending-pause reasons and request IDs. See the
[security audit](SECURITY-AUDIT.md) for additional local hardening and remaining
repository/cloud checks; source changes require deployment or native restart.

The signed macOS development launcher passed local build, bundle/signature
verification, Vite readiness, native-process startup and termination cleanup checks.
The frontend build also type-checks the launcher. Missing/ad-hoc signing identities
fail before launch. Account status no longer refreshes on window focus, preventing
Keychain dialogs from triggering another refresh when focus returns. Remembered
Keychain access across reloads still requires interactive verification.

Desktop Google sign-in uses a loopback callback. Mobile deep-link sign-in is pending.
The iOS prerequisite probe found no full Xcode installation; phone-device validation,
Windows, Linux and Android builds remain unverified.

## Architecture and roadmap

[Implemented architecture](./architecture.md) records ownership and tooling.
[The build plan](./BUILD-PLAN.md) tracks phases and user checkpoints.
[The design brief](./DESIGN.md), [data model](./DATA-MODEL.md),
[execution contract](./EXECUTION.md), [AI strategy](./AI-STRATEGY.md),
[state/storage contract](./STATE-AND-STORAGE.md) and
[model evaluation plan](./AI-EVALUATION.md) define the approved direction and
remaining work. Design intent does not imply implemented behavior.

[Working rules](./AGENTS.md) and [UI rules](./ui-guidelines.md) govern development.
`old/` is reference-only and is excluded from active tests and builds.

## Hosted service development

Active source, security boundaries, diagnostic contracts and deployment checks are
documented in [server/README.md](server/README.md). The app supports an on-demand
authenticated service status check; the matching server deployment is required.


## AI access foundation: current source checkpoint

Custom URL connects to a self-hosted SkellySpeak server. Hosted and Custom URL chat
use version-1 grouped `/operations`; OpenRouter chat and Groq transcription use
direct API keys. Include `/v1` in the custom API base URL. HTTPS is required except
on loopback. No automatic endpoint or credential fallback is provided.

Custom Check connection calls authenticated `/protocol`, validates the protocol
version and configured chat/transcription capabilities, and performs no inference.
Our server requires a session token issued by that server. Selecting no authentication
cannot bypass server authentication. Hosted session credentials are never reused for
Custom URL; its token is stored separately and bound to the saved destination.
Groq key verification uses its `/models` endpoint. Fast task routing and read-aloud
remain unimplemented. A protocol check does not establish live inference quality.

Hosted and custom chat batch only operations sharing captured destination and
credential authority. Custom requests omit hosted install/platform/version headers.
Transcription remains a separate multipart request using the configured server model.
The user verified local Custom URL chat with real configured inference keys;
all seven local Firestore emulator tests passed. Recheck the native development
session when resuming this branch; no new runtime check is implied by this summary.

Saved API keys remain in the platform credential store; no session-only or plain-file
storage option was added. See [credential decisions and sources](SECURITY.md).
Direct-key and Custom URL chat were user-verified. Groq-specific inference and
microphone permission still need capability-specific verification. Restart the
signed native development app after Rust changes; frontend reload alone is insufficient.


AI access layout: OpenRouter and Groq keys are grouped together, with model
preferences collapsed below. Hosted sign-in precedes usage/service details. Access
configuration has no toolbar button. UI wording uses functional labels and compact
spacing. The actual React settings components were inspected in an isolated visual
fixture at 1180×820 and 390×780; this verifies layout, not native authentication.

## Reply translation slice

When Translation is enabled at Send, the declared reply_translation operation waits
for the validated partner reply, then translates that message using the captured
explanation language and Standard target. No conversation history or coach content
is supplied to this task. Translation text and its operation state arrive through
the existing conversation snapshot and appear beneath the source reply.

The source message is immutable and uniquely owned by its turn; its ID is the whole-
passage identity for this slice. The result is stored in that turn's context JSON,
not as another conversation message. Source deletion cascades through its turn and
operations. Token spans and offsets remain a later contract.

A turn can be assisting after its reply is saved; this does not block the next Send.
Assistance uses the existing bounded permits, captured route and durable attempts.
There are no automatic retries or repair calls for translation. Explicit Retry
retries only the failed operation and preserves the saved reply. Attempt admission
reserves room for dependency work. Cancellation or deletion prevents late publication.

Changing Translation toggles display and applies to future sends; it does not
backfill existing replies. Panel hydration and reopening only read saved results.

Verification: 79 native tests, 31 frontend tests, Clippy, generated-contract checks,
style checks, frontend build and native binary build pass. Native translation QA
with a real provider has not yet been performed. Restart the rebuild development
app with npm run macos:dev; do not use the release-recovery bundle for this check.

Live hosted translation check, 2026-09-10: the user confirmed two exchanges work.
Read-only inspection of durable receipts found one successful reply attempt and
one successful translation attempt per exchange, one saved assistant message and
one saved translation each, no errors in these exchanges and zero active operations
at inspection. This verifies the basic hosted path; other routes and interactive
cancellation/restart scenarios are not established by this session.
