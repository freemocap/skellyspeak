# SkellySpeak

A convivial tool for learning languages through welcoming conversations,
useful assistance and understandable progress.

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

Structured passage assistance, assessment, XP, Vibe computation
and measured garden rendering remain planned. Standard handles partner replies;
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

Settings → AI access has Hosted sign-in, API keys and Custom URL tabs. API keys
use OpenRouter for partner/coach replies and Groq Whisper for transcription.
Custom URL uses OpenAI-compatible Chat Completions and optionally multipart audio
transcription, with explicit Standard/Fast IDs, transcription model, base URL and
bearer/no-auth choice. Include the service's API path (often `/v1`) in the base URL.
HTTPS is required except on loopback. There is no automatic endpoint or key fallback.

Groq key verification uses authenticated GET `/models`. Custom **Check connection**
uses GET `/models` without inference; failure to implement model listing is reported
explicitly and does not silently try another protocol. Successful listing establishes
connectivity/authentication, not audio support or inference quality. Actual requests
validate their output. Fast remains unassigned. Read-aloud is still future work.

Saved API keys remain in the platform credential store; no session-only or plain-file
storage option was added. See [credential decisions and sources](SECURITY.md).
Native visual inspection of this change was blocked by computer-use access. Live
Groq/custom inference and microphone permission remain unverified. Restart the
signed native development app after Rust changes; frontend reload alone is insufficient.


AI access layout: OpenRouter and Groq keys are grouped together, with model
preferences collapsed below. Hosted sign-in precedes usage/service details. Access
configuration has no toolbar button. UI wording uses functional labels and compact
spacing. The actual React settings components were inspected in an isolated visual
fixture at 1180×820 and 390×780; this verifies layout, not native authentication.
