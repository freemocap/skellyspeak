# Implemented application and boundaries

The local foundation, desktop hosted access and own-key execution are implemented. Native/live
verification status is recorded in README.md. Assistance, custom URLs
and evidence contracts remain future work.

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
There are no migrations or imports. Source-owned records cascade on deletion.
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

The resolver captures either hosted or own-key OpenRouter access per turn. `provider.rs` uses
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

A single pending reply is permitted per conversation and two workers app-wide.
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
uploads to the hosted Whisper endpoint; transcript insertion checks conversation and
credential revision. Audio uploads are not yet represented as local graph attempts;
the hosted service meters them. Native credential reads run outside the database
lock on blocking workers so keychain prompts cannot prevent chat hydration.
