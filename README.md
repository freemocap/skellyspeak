# SkellySpeak

A convivial tool for learning languages through welcoming conversations,
useful assistance and understandable progress.

This checkout is the **rebuild** branch: the next-generation application.
The published v0.13.7 application is maintained on **main** in the separate
`skellyspeak-main` worktree. Recovery is complete; see
[branch ownership and outcomes](RELEASE-RECOVERY-PLAN.md) and the
[current implementation plan](BUILD-PLAN.md). Do not merge main wholesale into rebuild.

**Current implementation: immediate chat, desktop recording/transcription, a separate
coach thread, Google sign-in and own-key/custom-server text execution.** Rust persists
messages, conversation settings and validated replies. The integrated conversation UI
reads those native records and uses native commands for sends and settings changes.

The interface pairs a light chat canvas with a dark lesson/analysis pane. The partner
chooser selects partners and conversations; narrow windows use Chat and Lesson tabs.
Unsent drafts are session-only. The AI activity frame currently reports that its graph
is not connected. Execution controls, broader usage reports and lesson editing
still need UI wiring; native capabilities are not a claim that those controls work
in the interface. No skill estimates or XP are fabricated.

Saved partner-reply translation and whole-message word glosses are implemented through
the scheduler. Structured coaching and source-derived XP now feed the skill map and practice
statistics. Vibe computation and measured garden rendering remain planned. Standard handles partner replies;
Fast has no active assignments until evaluated. Hosted access uses the service's
approved Gemini 2.5 Flash model.

## Parallel development

Read [domain assignments and integration rules](workflow/README.md) before starting
a domain task. Each implementation stream uses its own user-created worktree.
Coordinate native app runs because worktrees share the app identity and local data.

## Run locally

Use Node.js 24, npm, Rust and the platform's Tauri prerequisites. Install and run:

```sh
npm ci
npm ci --prefix skellyspeak-docs
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

Version **0.14.0** is prepared in Cargo.toml. Push the checkpoint branch, open a PR
into `main`, and require green CI before merging. Confirm CI on the merged commit,
then create and push `v0.14.0` from that commit. Merging alone does not publish.

The tag starts the Release workflow: checks, signed desktop installers and updater
artifacts, and signed Android APK/AAB. Publication as Latest requires all of those
jobs to succeed. Android PR CI also builds a debug ARM64 APK without release secrets.
The website rebuilds after a successful release and its download page selects the
current stable APK for Android visitors.

Desktop release builds install signed updates through the app. Android opens
https://docs.freemocap.org/skellyspeak/download for APK installation. Debug builds
do not install updates. Release builds use `src-tauri/tauri.release.conf.json` to
retain the distributed application's identity and signing continuity.

For subsequent releases, run `node scripts/release.ts patch` on a clean, current
`main` checkout with Node 24, Cargo and authenticated Git access. It bumps both
Cargo files, commits, tags and pushes. `--dry-run` skips writes except fetching
remote state; `--no-push` performs local Git writes only. The user runs these commands.

## Start talking

Opening the app resumes the most recent active conversation. A fresh workspace
creates a Spanish partner and conversation automatically. The composer is immediately
available; no title or setup form is required. The plus button starts another
conversation with copied preferences. The partner chooser opens a partner's latest
active chat or creates one. Names and settings remain editable afterward.

Record starts the desktop system microphone. Stop transcribes through the selected
AI route and automatically sends the transcript when Auto-send is enabled (default on).
When disabled, the transcript stays in the composer for review and manual Send.
Discard cancels capture. Audio stays in memory, is capped at two minutes, and is
uploaded only on Stop. Hosted uses Google sign-in; API-key mode uses a separate Groq
key; Custom URL defaults to the server transcription model `whisper-large-v3`.
Mobile recording remains unimplemented. Automatic reading defaults on; both voice
preferences save per conversation. Desktop voice interaction has user verification;
other devices and general speech fidelity still need their own checks.

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
and failure states. Connection verification reports authentication separately from saving a key.
Automatic API-key verification remains tracked as CQ001; do not treat a saved
credential as verified. Key entry remains masked; saved secrets are never returned to the frontend and
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

The native execution controls are implemented; their UI wiring is pending.
At the command layer, Pause all prevents new starts; it does not revoke running work. Pause a turn and
Step to admit one operation while keeping that turn paused. The app-wide gate must
be resumed to Step. Cancel revokes publication and drops the local HTTP request;
remote execution and billing may continue. Retry is explicit and may incur another
charge. Restarted in-flight requests show unknown outcomes and never auto-retry.

AI configuration changes invalidate affected pending work; it is never automatically
resent. Accepted messages and conversation preferences remain independently owned.

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
Frontend tests cover snapshot ordering and draft scope. Vitest excludes dependency, dist, reference and Node launcher test directories.
Node launcher tests run separately with `npm run logs:test`. `npm run contracts` regenerates TypeScript declarations
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
earliest retry retained in the native execution snapshot. Holds survive restart; recovery is
explicit and Step cannot bypass them. Shared access holds also block fresh Send
and transcription. The native Recover access command checks the retry time
and refuses stale recovery actions; it makes no AI call and leaves queued turns
paused. Transcription receipts now retain route, model, timing and outcome;
interrupted attempts become unknown on restart and are never replayed. Native execution snapshots expose these receipts, and usage projections include
them with unavailable token usage; presentation remains pending. Audio and transcript text are not stored in receipts;
this limit does not establish a bound on upstream work after local cancellation.
Capacity is provisional. Authored admission events persist to the native file sink
without time-based suppression. They identify capacity waiting, queue rejection
and wait duration without request content. See Development diagnostic coverage.

Automated checks cover PKCE/state validation, account decoding, hosted payload rules,
route capture, credential revocation, retained profile counts and local HTTP adapters.
Google browser authentication, keychain persistence and live hosted replies require
native verification; passing mock tests does not establish those results.
The native bundle builds successfully. Desktop and narrow-window layouts, direct
chat startup and title-free one-click creation were inspected. The keychain lookup
no longer holds the workspace lock. No database reset was needed. The user verified desktop recording/transcription and basic private coach replies;
other devices and providers still require capability-specific checks.
Hosted deployment passed its test, container and exact-revision traffic checks,
and the user confirmed hosted chat works. The client preserves documented
rate/allowance/spending-pause reasons and request IDs. See the
[security audit](SECURITY-AUDIT.md) for additional local hardening and remaining
repository/cloud checks; source changes require deployment or native restart.

The signed macOS development launcher passed local build, bundle/signature
verification, Vite readiness, native-process startup and termination cleanup checks.
Run `npm run logs:check` to type-check the logging launchers. Missing/ad-hoc signing identities
fail before launch. Account status no longer refreshes on window focus, preventing
Keychain dialogs from triggering another refresh when focus returns. Remembered
Keychain access across reloads still requires interactive verification.

Desktop Google sign-in uses a loopback callback. Mobile deep-link sign-in is pending.
The iOS prerequisite probe found no full Xcode installation; phone-device validation,
Windows, Linux and Android builds remain unverified.

## Architecture and roadmap

[Implemented architecture](./architecture.md) records ownership and tooling.
[AI request architecture](./AI-ARCHITECTURE.md) is a practical companion guide to
chat messages, structured results, routes, and operation workflows.
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
Groq key verification uses its `/models` endpoint. Fast task routing remains unimplemented. Read-aloud uses the selected route and
the dedicated speech model; actual playback requires device verification. A protocol check does not establish live inference quality.

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
operations. Word glosses bind validated UTF-16 spans to this same immutable source.

A turn can be assisting after its reply is saved; this does not block the next Send.
Assistance uses the existing bounded permits, captured route and durable attempts.
There are no automatic retries or repair calls for translation. Explicit Retry
retries only the failed operation and preserves the saved reply. Attempt admission
reserves room for dependency work. Cancellation or deletion prevents late publication.

Changing Translation toggles display and applies to future sends; it does not
backfill existing replies. Panel hydration and reopening only read saved results.

Basic hosted translation has user QA and durable receipt verification: one reply
and one translation per exchange. See BUILD-PLAN.md for the current checkpoint;
this does not establish every route or cancellation/restart scenario in live use.

## Word gloss slice

Each new partner turn declares one Standard word-gloss operation. After the reply is
saved, glossing and optional translation are independently eligible for the shared
four permits. There is no per-word inference or batch-fill delay. Existing messages
are not backfilled. Clicking a glossed word reveals its saved meaning inline; opening
or reopening the conversation creates no requests.

The model selects inclusive first/last grapheme IDs; native code derives exact
source spans and validates strict structured output before persistence. Valid partial results are usable. Malformed output fails explicitly,
retains reported usage and does not replace saved meanings. Retry word meanings
retries only that operation within the turn's attempt budget; it never regenerates
the reply or translation. Restarted unknown work requires explicit retry.

Tests cover sibling completion order, failures, cancellation, source deletion,
captured languages, partial results, restart and scoped retry. The latest local
voice run accepted four gloss attempts across three replies. Complete coverage and
linguistic quality remain the next focused slice; accepted output is not a quality
score. Reading/reopening must create no inference. Explicit retry targets glosses
only; expected new-turn work is reply, gloss, enabled translation and enabled speech.

## Voice integration checkpoint

The desktop source implements transcription → automatic Send → partner text →
speech playback. Auto-send and automatic reading persist per conversation and
remain independently switchable. Speech is a source-bound scheduler operation,
using the selected route and `openai/gpt-audio-mini`; it shares admission capacity
with other AI work but does not block translation or gloss eligibility.

Playback reads bounded in-memory audio. Opening history does not generate speech
or autoplay it. Explicit replay can request audio; cancellation prevents late
playback, and restarting loses the audio cache without automatically regenerating
it. No operating-system speech fallback is used. Audio playback releases its Blob
URL when stopped or completed. Local cancellation cannot guarantee upstream billing
stops.

The user reports working desktop voice interaction. Latest local Custom URL
receipts show three successful transcriptions/replies/speech generations, with
speech and gloss running independently. General speech fidelity, stop/replay and
other devices still need their own checks. Current automated results and next
work are in BUILD-PLAN.md; detailed evidence is in
[the integration report](workflow/reports/integration-logging.md).

The local server must allow the speech model. A restart refreshes its session token;
save the new token before authenticated Custom URL testing. Hosted access remains
an explicit selection, never a fallback.

## Development diagnostic coverage

Start the native app with `npm run macos:dev` and the local API with
`npm run server:local`. Each invocation prints its private run directory under
`.local/logs/`. These directories are Git-ignored, readable by the current user
and agents on this machine, and retained across runs without automatic deletion.
Directories use mode 700 and files mode 600. Do not attach raw log directories to
issues or commits; review them for private data before sharing.

Each run captures process stdout/stderr in `stdout.jsonl` and `stderr.jsonl`,
including inherited child output. `launcher.jsonl` records lifecycle and exit
status. The native process adds `diagnostics.jsonl` (frontend events),
`native.jsonl` (native events/log facade/panic notices), and its manifest. The
local API adds `server-logging.jsonl`, `server-stdout.jsonl`,
`server-stderr.jsonl`, and its manifest. The outer process streams preserve
credential-redacted text; structured files preserve reviewed diagnostic fields.
`SKELLYSPEAK_LOG_RUN_DIR` connects these sinks to the same run directory. Do not
reuse a run directory for a second process of the same type.

For other local development tools, including the Firestore emulator, use
`node scripts/dev-run.ts process <executable> <arguments...>` to capture their
inherited output. Running a tool directly bypasses that outer capture. Native
app runs started independently still create structured files under `.local/logs/`
in debug builds; release builds use the platform app log directory. Cloud-hosted
server logs remain in Cloud Logging and are not automatically mirrored locally.

Records are appended synchronously (Python/native streams flush each record).
Frontend delivery acknowledges the native file write before publishing a caught
fault; bridge delivery failures are explicitly reported and counted. In-memory
rings limit the UI read view only, not file retention. Files are readable while
processes run; this is not a guarantee against power-loss or hardware failure.

Credential patterns are redacted from process output. Frontend/structured sinks
exclude arbitrary argument bodies, stacks, transcripts and provider payloads;
redacted bodies have explicit markers/counts. Unknown error causes are therefore
not complete error text. Incomplete process lines get immediate arrival markers;
the body is recorded on newline or orderly close. Lines over 65,536 characters
are explicitly redacted to bound memory. Abrupt termination can lose an unfinished
line's body or an unacknowledged frontend event. Bootstrap errors before frontend
capture and output from independently launched tools are not retroactively
recoverable. A disk write failure is an error, never a successful logging receipt.

When investigating a failure, inspect **every stream from every run since the
preceding checkpoint**, including successful events; do not start with an
error-only filter. Correlate timestamps, process/run IDs, frontend sequence/fault
IDs, and local durable operation/transcription/hold records. A missing inference
attempt does not mean no failure occurred: capture, settings and admission can
fail first. Report precisely which sources were read and any missing coverage.

Logging checks: `npm run logs:check`, `npm run logs:test`, `npm test`, native
`cargo test`, and `server/test_local_logging.py`. Node launcher tests are separate
from the frontend Vitest suite. `.local/` is excluded from Vite's file watcher so
log writes do not reload the webview.

## License

SkellySpeak is licensed under the GNU Affero General Public License, version 3
or (at your option) any later version (**AGPL-3.0-or-later**). See [LICENSE](LICENSE)
for the full license text.

Third-party components and materials retain their respective licenses and notices.
