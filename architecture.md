# Implemented application and boundaries

Custom URL implementation gap: the approved route is a self-hosted instance of our
server using the same SkellySpeak protocol as hosted access. Chat uses grouped
`/v1/operations`, and connection checks validate authenticated `/v1/protocol`
capabilities. Its separately stored bearer credential is a session token from that
server. Local server/emulator and native custom-route verification remain pending.

The local foundation and desktop Hosted, API-key and Custom URL execution are implemented. Native/live
verification status is recorded in README.md. Assistance
and evidence contracts remain future work.

For a practical walkthrough of the request shapes, structured-output validation,
and operation graph, see [AI-ARCHITECTURE.md](./AI-ARCHITECTURE.md). This document
remains the implementation-boundary authority.

The selected stack is Tauri 2, React 19, TypeScript and Vite. Rust owns the SQLite
store via rusqlite with bundled SQLite; mutations use explicit transactions,
foreign keys and optimistic revisions. No ORM or frontend database API is exposed.
Rust serde contracts generate TypeScript through ts-rs. React owns transient drafts,
selection and forms; durable state comes from Rust snapshots. No additional state
library is needed for the local directory slice.

Sources: [Tauri commands](https://v2.tauri.app/develop/calling-rust/),
[rusqlite](https://docs.rs/rusqlite/latest/rusqlite/) and
[ts-rs](https://docs.rs/ts-rs/latest/ts_rs/). Exact resolved versions are in the locks.

`src-tauri/src/model.rs` owns serialized domain contracts. `languages.rs` owns the
explicit language/variety registry. `store.rs` owns validated transactions and
snapshot reads. `lib.rs` exposes local commands; `src/` presents them. The hosted client in `hosted.rs` targets the deployed authentication/metering service.
Its active client contract is in `hosted-api.md`; there is no active local server or
deployment change in this slice.

The local database lives in the application's data directory as `practice.sqlite3`.
It is initialized only when empty; incompatible or invalid databases fail explicitly.
The active schema extends transactionally through v7, with turn refusal state, shared
target admission and metadata-only transcription receipts; there are no
archived-data imports. Source-owned records cascade on deletion.
Settings are one independently editable record per conversation. Opening a
conversation records use ordering for copying settings on explicit creation.

Foundation snapshots contain the local directory and settings, with a monotonic
revision. No transcripts are loaded through this directory contract. Main and AI pop-out windows refresh directory state after mutations and focus. Conversation
hydration uses conditional full snapshots: one Rust query waits for a later committed
revision or a 20-second deadline, then returns a complete scoped page. React rejects
responses from disposed selections. No fetch/subscribe gap or event replay log is
introduced. Message pages are bounded to 100 and can be paged backward; inspection
shows the latest 50 turns. The global commit revision is a conservative invalidation
cursor, not a claim that every commit changed the selected conversation.

A workspace file lock enforces a single local writer. Opening another process fails
instead of clearing its active session receipts. Each mutation carries a session
and action ID; transaction receipts deduplicate replay, and a changed payload under
an existing ID is rejected. Receipts are removed on session initialization, and
source-bound receipts cascade on deletion. Unconfirmed UI actions retain their
identity and expose Recover action rather than creating another mutation silently.

Settings payloads are typed JSON within a one-to-one relational settings row. Serde
rejects unknown fields; language/variety and ownership validation run in Rust.
`ts-rs` exports the supported wire shape; its warning for the runtime-only serde
`deny_unknown_fields` annotation is disabled, while rejection itself is tested.

Persisted preference changes apply to subsequent defaults, not existing conversation
settings. Form revisions are captured so a refresh cannot silently authorize a stale
edit. The UI preserves drafts across navigation, deletes them when their conversation
is removed, and intentionally does not write unsent drafts to disk.

## Conversation execution

`turn_plan.rs` declares local context and Standard partner reply with their dependency,
role and contract version. These declarations drive readiness and graph inspection.
`execution.rs` atomically accepts Send, captures permitted context, revalidates source ownership/roles/budget in the gated
context operation, stores operations
and attempts, enforces gates, and validates publication authority. `lib.rs` schedules
bounded work outside SQLite transactions and exposes typed commands/queries.

The resolver captures Hosted, own-key OpenRouter or Custom URL access per turn. `provider.rs` uses
reqwest 0.12 with rustls, no redirects, a 90-second timeout, a 256 KiB response cap,
2,048 output tokens and no hidden retries. Own-key requests disable provider fallback;
the hosted service controls upstream routing. Requested and actual
model IDs are distinct attempt fields. Standard defaults to `google/gemini-2.5-flash`;
Fast's `google/gemini-2.5-flash-lite` binding has no active assignments.

Input policy v1 captures settings, partner description and the latest 40 retained
messages from this conversation, plus the initiating message. The serialized input
content budget is 96 KB; excess input fails before Send acceptance. It contains no
private coaching or other conversation sources. Reply validation rejects empty,
oversized, emoji-bearing and incompletely finished prose. Provider usage is retained
when a parsed completion fails publication validation. Unavailable usage stays null.
The Unicode policy rejects Emoji_Presentation, Extended_Pictographic, variation
selector-16 and keycap marks; ordinary digits and multilingual letters remain allowed.

A single pending reply is permitted per conversation. `admission.rs` owns four
app-wide network permits shared by partner/coach chat and desktop transcription.
Chat waits in its durable operation queue; at most one transcription waits in
memory for capacity. Additional waiting audio fails explicitly without submission.
Audio rechecks connection/source validity while waiting and after acquiring capacity
and reading credentials. Dropping a waiter or finishing/cancelling a request releases
its permit. This bounds local futures, not upstream billing after cancellation.
Pause gates operation starts; Step grants one ready operation a permit. Running work
may finish while paused. Cancel, deletion and credential revocation defeat late
publication. Duplicate callbacks cannot duplicate an output. Startup marks in-flight
attempts unknown and holds undispatched pending turns for explicit resumption.

`credentials.rs` uses keyring 3.6 platform stores: Apple Keychain, Windows Credential
Store and Linux Secret Service with encrypted transport. Unsupported platforms fail
explicitly rather than using keyring's mock store. Android credential support remains
unimplemented. Secrets cross IPC only on explicit key submission, are not React state,
are zeroized in Rust-owned temporary strings, and never enter records or diagnostics.
Credential cleanup intents are persisted before writing a new credential; replacing
or disconnecting records revocation and cleanup. Startup completes pending cleanup.

Primary references: [OpenRouter Chat Completions](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion),
[keyring platform stores](https://docs.rs/keyring/3.6.3/keyring/),
[Standard model](https://openrouter.ai/google/gemini-2.5-flash) and
[Fast candidate](https://openrouter.ai/google/gemini-2.5-flash-lite).
Provider listings establish availability, not acceptance in language-quality evaluation.

## Account and presentation queries

Desktop Google authentication uses a system browser, random S256 PKCE verifier and
state-bound loopback callback. Rust exchanges the one-time code, validates `/v1/me`,
and stores the session in the native credential store. Cancel/sign-out invalidate
pending authentication. No session token crosses into React. Route switching keeps
the captured identity of running attempts and invalidates undispatched work; revoking
a credential prevents its unpublished results from appearing. No automatic route
substitution occurs. Hosted allowance remains server-owned.

`profile.rs` derives scoped retained message, request and token totals from SQLite.
Unknown usage is counted separately; deleted records cease contributing. These are
local activity reports, not lifetime hosted billing or proficiency measurements.
The docked/pop-out AI view uses the same scoped conversation snapshots and commands.
Settings captures learner revisions, debounces preference writes, retains failed
drafts and flushes before closing. Reading scale and spacing are presentation settings.

## Immediate conversation, coach and voice

Startup prepares a usable conversation without inference: resume the most recently
used active chat, create one for an active partner if needed, or atomically create a
Spanish partner/relationship/conversation. Repeated startup does not duplicate chats.

Partner and coach turns declare separate context/reply operations. Message visibility
is derived from the owning turn's operation kind; partner context queries exclude
coach turns. Both channels use the same attempt persistence, gates, credentials and
publication validation. Coach context includes a bounded partner exchange plus its
own retained thread. Coach asks cannot mutate settings. Local conversation message
counts exclude coach text; provider attempt totals include both channels.

Desktop capture uses cpal on a dedicated thread and hound for mono WAV. Recording
IDs scope waveform/stop/cancel commands. Audio never enters React or SQLite. Stop
uploads through the capability resolver to hosted, Groq or custom transcription; transcript insertion checks conversation and
credential revision. Audio uploads are not yet represented as local graph attempts;
the hosted service meters them. Native credential reads run outside the database
lock on blocking workers so keychain prompts cannot prevent chat hydration.


## Capability-based AI access

`access.rs` resolves Chat and Transcription into captured route, URL, model,
credential reference and revision. Partner and coach turns persist that target in
their captured context; the microphone captures it before recording. Credential
revocation blocks publication. Transcription drops its HTTP future if its connection
revision changes or its source conversation disappears/is archived. Ordinary chat
route switches retain the original identity of already dispatched work, as defined
by the execution contract; they do not retarget requests in flight.

`ai_config` retains hosted, OpenRouter, Groq and custom credential references, and
custom protocol configuration. Custom Chat Completions excludes vendor-only
OpenRouter fields. The optional multipart transcription capability must be selected
explicitly. Provider implementations, rather than UI components, own endpoint constants.
Read-aloud has not yet been implemented. Credential policy is in `SECURITY.md`.

## Request-load audit — September 10, 2026

This is a source audit, not a production load test. The three access routes share
target resolution and credential boundaries; they do not yet share admission for
every network operation.

| Work | Current admission and failure behavior | Remaining boundary |
| --- | --- | --- |
| Partner/coach chat, all routes | Durable attempts; four shared network slots; no automatic HTTP retry; HTTP 429 pauses matching pending turns with durable visible hold metadata | Fresh submissions are checked before acceptance; total queued-work and graph-expansion budgets remain open |
| Transcription, all routes | Captured target/revision; bounded audio/response; no automatic retry; now shares native network admission with chat, with at most one waiting transcription | Shared target holds checked before capture, while waiting and before submission; durable metadata-only receipts are implemented; audio is not yet a Step-controlled graph operation |
| Key verification, account/status checks | Explicit native commands, timeouts and response caps; verification makes no inference call | No common native concurrency/coalescing policy across windows and repeated command delivery |
| Hosted inference | Authenticated ingress, durable daily admission and spending reservation; structured rejection codes | No distributed per-account in-flight admission. Diagnostics have separate daily counters but share authenticated short-window capacity |

Chat HTTP 429 errors now carry typed reason, scope, safe request ID and earliest
retry metadata. Recognized hosted service refusals span hosted pending work;
otherwise matching uses route, endpoint and credential reference. Holds are stored
in a dedicated turn execution-state column, never added to prompt messages. Pending turns pause and
lose Step permits; in-flight work may finish. Explicit recovery honors known timing,
but no timer or restart automatically resumes a held turn. The execution panel
shows the hold. `holds.rs` persists target refusal authority independently of turns;
fresh submissions and audio consult it. Audio HTTP 429 also records that authority.
Target keys hash endpoint and native credential reference; neither URL nor credential
reference enters the hold snapshot. Hosted service-scoped refusals cover chat/audio.
Recover access checks earliest retry and the observed generation, clears only that
hold and makes no network call. Queued turns remain paused until explicitly resumed.
The table is capped at 128 holds; saturation fails closed instead of evicting an
active refusal. Deleting conversations does not clear access holds.

`transcription.rs` records a receipt immediately before HTTP submission, inside a
transaction after permission/admission checks. Completion checks source authority
and commits outcome before returning draft text. Receipts cannot authorize a second
submission or a second publication. Restart marks running receipts unknown and
never dispatches audio. Conversation deletion cascades receipt removal; late results
cannot recreate records. No recording or transcript content is persisted in this
table. Metadata enters execution inspection and global/language/partner attempt
counts; audio token usage remains unavailable. Audio Step control is not implemented.
A chat worker cap limits simultaneous client futures;
it does not cap requests per minute, total graph work, or provider work that continues
after local cancellation.

Shared network admission is implemented after this audit; the remaining slice is
defined in [BUILD-PLAN.md](./BUILD-PLAN.md#next-checkpoint-request-load-resilience).
The incident evidence and its unresolved causality remain in
[INCIDENT-POSTMORTEM.md](./INCIDENT-POSTMORTEM.md).

## Partner-reply translation

The shared turn declaration includes reply_translation after partner_reply. A send
captures translation eligibility and explanation language. Accepted prose is saved
first; the turn becomes assisting while its child runs, permitting a new Send.
Translation reads only that immutable assistant message and publishes into its
turn context. ChatMessage carries optional translation and translationState in
the scoped snapshot. No new chat message, schema migration or rendering-side
request path is introduced. Attempt and queue budgets include dependency work.
