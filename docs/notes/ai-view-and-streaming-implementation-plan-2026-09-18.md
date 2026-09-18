# AI View, live status and token streaming: implementation plan (September 18, 2026)

Status: **proposal for review, revision 3. Nothing here is implemented.**
Revisions 2 and 3 incorporate two external reviews; sections 12 and 13 map each
finding to its resolution. The file and line references were re-checked against the
working tree on this date, after the review. Any behaviour described as
"current" was checked in the code, not inferred.

Design mockups are on the canvas "AI View Panel"
(https://claude.ai/artifact/B1PYspJmNHKYuxV54qXWqe). Its sample data mirrors
`turn_plan.rs`, but it is a mock, and its simulated run exists only for the
demo (see A3: no replay).

Reviewers: section 2 is the hard constraint. Section 10 is the checklist.

**Working-tree note.** The tree has uncommitted work from another session:
- Lessons removed (`LESSON_PLAN`, `lesson_review`, `learning/lessons/`,
  `LessonDialog`).
- Schema at **23**.
- `SavedGlossText` being moved from `features/conversation/reading/` to
  `components/reading/`.

Re-check line numbers once that work lands. Choose the schema version at
implementation time.

---

## 1. Goals

1. Clicking **AI Connected** opens the AI View as a docked bottom panel. The
   panel can expand to fill the window (a pop-over) or pop out into its own
   desktop window, with **Pop in** to return it.
2. The AI View is a clean, interactive view of the **actual** operation graph:
   - Nodes and edges update live.
   - A node click expands an inspector. An expand button opens the node
     full-screen.
   - Per-node and whole-graph history is available across exchanges.
3. The status line that says "Thinking…" shows a live summary of what is
   actually running.
4. Surfaces that are waiting for AI data show tasteful, state-driven hydration
   animation.
5. Model tokens are streamed and shown **the moment they arrive**:
   - Partial information is never withheld.
   - Streamed text never disappears from the user's view. That covers failure,
     cancellation, invalidation, retry and window reload, as defined in D.7.
   - **One accepted exception:** on abrupt app termination, text received
     since the last periodic flush (normally under about 1 s, best effort) may
     be lost.

## 2. Hard constraint: no middle layer

The AI View is a view onto the scheduler's own records. Nothing may
re-describe the AI process.

**The single source of truth, as it exists today:**
- `native/src/conversations/turn_plan.rs` declares each operation once as a
  `Declaration { kind, dependencies, role, contract_version }`. The lists are
  `PLAN`, `COACH_PLAN`, `OPENING_PLAN` and `RETAINED`. Its doc comment reads:
  "The scheduler and inspection share these operation declarations."
- `publication.rs:12` `plan_for` picks the plan for a turn.
- Snapshots build `OperationView.dependencies` from the same declaration
  (`snapshots.rs:150`). Each attempt is a row in `attempts`.
- The UI receives this as `ConversationSnapshot.turns[].operations` and
  `.attempts` (generated contracts).

**Operation states.** The UI must handle exactly the states the code produces:
- **Stored:** `waiting_dependencies`, `ready`, `running`, `succeeded`,
  `failed`, `unknown`, `cancelled`, `invalidated`.
- **Snapshot-derived:** `held`. It is a `ready` operation while inference is
  paused, or while its turn is paused without a permit (`snapshots.rs:176`).
- The `ChatMessage` fields `translation_state`, `gloss_state`,
  `explanations_state`, `feedback_state` and `suggestions_state` are these same
  **operation states**, joined from `operations` (`snapshots.rs:~100-107`).
  They are not a separate vocabulary.

**Allowed derivations (pure functions of the snapshot and stream reads):**
- Nodes are `turn.operations`, and edges are each operation's `dependencies`.
- Columns are dependency depth.
- A node's state is the `operation.state`.
- Timing, tokens, model and errors come from `turn.attempts`.
- History is turns and attempts (see A5 for retrieval).
- Display text is `kind.replaceAll('_', ' ')`.

**Forbidden: a second definition of the graph.**
- No hand-written collection of operation kinds, labels, purposes,
  descriptions, dependency relations, layouts or groupings, in TypeScript or
  Rust, outside `turn_plan.rs`.
- The v0 graph, `old/skellyspeak-app-v0/src-tauri/src/graph.rs`, had exactly
  that layer (hand-written `label` and `purpose` per node). Use v0 as a UX
  reference only.
- Single kind literals remain legitimate in integration code. Example:
  `reply-state.ts:11` identifies the reply as `persona_reply | persona_opening`.

**Guard (narrow).** A UI test (A8) fails if:
- any module under `features/activity/**`, or the summary or hydration helpers,
  contains an operation-kind literal. Those modules must be kind-agnostic, and
  reply identification is imported from `reply-state.ts`; or
- any UI source outside `generated/` and tests contains an array or object
  literal holding two or more distinct kinds from `turn_plan.rs`, or a
  `dependencies:` literal.

## 3. Verified current state

**UI entry points**

| Area | Current behaviour | Reference |
|---|---|---|
| AI Connected button | Opens settings | `TopBar.tsx:60` |
| Settings | The gear also opens settings | `TopBar.tsx:74` |
| Docked panel | Already exists: a resizable bottom sheet (height in `localStorage` `skellyspeak_dev_h`) with a mobile `DetailDialog` path. Reachable only via the `activity` overlay. | `features/activity/LogsOverlay.tsx`, `app/AppShell.tsx:78` |
| Activity entry points | More dialog button; "Open AI activity" buttons | `MoreDialog.tsx:20`; `ReplyStatus.tsx:23`, `OpeningStatus.tsx:17`, `CoachAnalysisPanel.tsx` error text |
| Graph view | React Flow graph of real operations, with its own `watchConversation` loop | `LiveActivity.tsx` |
| Popped-out window | `open_ai_window` builds window `ai`, which renders `DevWindow`. Unused by the UI. | `workspace.rs:63`; `main.tsx:32-40`; `platform/ipc/window.ts` |
| Window capabilities | `main` and `ai` listed | `native/capabilities/main.json` |
| Pending reply | Shows "Thinking…" | `ReplyStatus.tsx:13` |

**Transport**
- **Scheduler** (`scheduler.rs`):
  - OpenRouter: one direct request per operation (`:111`).
  - Hosted and Custom: up to 8 compatible operations in one `/v1/operations`
    NDJSON request (`:125`).
  - `persona_reply` is normally batched with `user_translation`,
    `user_word_gloss`, `skill_assessment` and `coach_retry_check`.
- Every payload sets `"stream": false` (`provider/payload.rs:11`).
  - The direct route reads the whole body, capped at 256 KB (`request.rs:122`).
  - The grouped route publishes each item's final result before the batch
    finishes (`grouped.rs:302`).
- The grouped decoder is a tagged enum with `deny_unknown_fields`
  (`grouped.rs:22`). An unknown event makes the whole batch `UnknownOutcome`.
- `provider::decode` produces diagnostics from the **whole** response JSON
  (`diagnostics::response::metadata(&value, …)`, `response.rs:~94`). Any
  reconstruction must therefore reproduce the provider's top-level and choice
  metadata, not only text.

**Server**
- `/v1/operations` accepts only version 1 and non-streaming items
  (`grouped.py:61,82`).
- Each item has a durable claim (`grouped.py:109`), a reservation and a
  settlement (`main.py:744`).
- Results reach the response through a memory stream with buffer 1
  (`grouped.py:95`).
- `/v1/chat/completions` streams SSE with settlement, but has no per-attempt
  claim. It is not used for operations.
- `inference/streaming.events` **raises** on an `error` payload and on the
  `length`, `content_filter` and `error` finish reasons, before yielding
  (`streaming.py:40-44`). It is unsuitable for preserving partial output,
  finish reasons or trailing usage.
- `/v1/protocol` reports `version: 1` (`main.py:818`). The native app reads it
  only in tests.

**Publication and persistence**
- `finish()` (`publication.rs:67`):
  - Writes retained diagnostics to the attempt **before** checking scope
    (`:74`).
  - Then **returns early** if the attempt or operation is no longer `running`
    or the turn is no longer `pending`/`assisting` (`:78`). Examples:
    cancelled, invalidated, replaced.
- Validation: `finish_reason == "stop"` (`:180`) and `validate_prose`
  (`response.rs:6`).
- Text is inserted into `messages` verbatim (`:277`).
- Reply success unlocks the downstream fan-out (`:234`) and sets
  `speechSourceText` (`:279`).
- Glosses are validated against the exact saved message text (`gloss.rs:86-98`).
  Next-turn history reads `messages` (`turns.rs:168,231`).
- Startup recovery marks `running` attempts and operations `unknown`
  (`execution/recovery.rs:7`). Attempt rows survive a crash.
- Snapshots:
  - Delivery: `watch_conversation` polls a global SQLite revision every 150 ms
    (`workspace.rs:91`). `bump()` is a database write (`execution/mod.rs:78`).
  - Contents: the latest 50 turns plus the turns owning the current
    **message** page (`snapshots.rs:110-123`).
  - Paging is by message sequence (`before`). Older coach turns and turns with
    no qualifying message are **not** reachable by paging.
- `attempts` (schema 23 in the working tree, `schema.sql:28`): no request or
  response text. `Dispatch` (`execution/mod.rs:55`) has the exact request
  `messages` but no `turn`, `conversation` or `kind`.
- Rendering: `TargetText` keys spans by `${text}:${index}`, and
  `SavedGlossText` is keyed by text or attempt. Both remount on text change.

## 4. Decisions

| # | Decision | Status |
|---|---|---|
| S1 | Partial output is displayed as soon as it arrives. Nothing is withheld for display, including in complex scripts (D.6). | Settled (owner) |
| S2 | Streamed text never disappears. The lifecycle is in D.7. | Settled (owner) |
| S3 | Operations keep `/v1/operations` with its claim, reservation and settlement. | Settled (technical) |
| S4 | The terminal `result` event and publication pipeline are unchanged. Streaming adds previews and an unpublished-text record only. | Settled (technical) |
| S5 | Development workspace resets for schema changes are already authorized (`AGENTS.md:238-244`). Use the next schema version at implementation time. | Settled (policy) |
| D1 | A reply that fails validation does **not** become the conversation message. Its text is kept on the attempt and shown (D.7). Only validated replies enter `messages`, which feeds next-turn history, glosses, speech and skill evidence. | Open. Default is "not published". |
| D2 | Store full request messages and response text on attempts (local workspace only), for inspection. | Open. Default is "yes". |
| D3 | When **not** connected, the top-bar button opens AI access settings. When connected, it toggles the AI View. | Open. Default as stated. |
| D4 | Stream structured-output items (gloss and coaching JSON). Structured requests stay **non-streaming on all routes** until phase 5. | Open. Default is "defer". |
| D6 | On retry, the failed attempt's text stays attached to the replaced turn: visible under an "Earlier attempt" disclosure on the retried exchange, and in the AI View history. | Open. Default as stated. |
| D7 | Crash durability: a periodic flusher writes every dirty running preview to its attempt row about once per second, including during provider stalls. Loss on abrupt termination is **best effort**, normally under about 1 s but not guaranteed under scheduling or storage delays. | Open. Default is "1 s periodic flush, best effort". |

## 5. Design summary

The canvas has four artboards:
1. Docked panel.
2. Node full view.
3. Popped-out window with **Pop in**.
4. Status and hydration states.

The visual language uses app tokens only (`--bg/chrome/sheet`, `--ink*`,
`--line*`, `--accent*`, `--danger*`, `--warning*`), IBM Plex Sans/Mono, and
Newsreader for target-language text. The layout is dense.

**Node states** (all states from section 2):

| State | Appearance |
|---|---|
| `waiting_dependencies` | Dashed muted border, no motion |
| `ready` | Solid muted border, "ready", no motion |
| `held` | Warning-tinted border, "held", no motion |
| `running` | Border sweep and pulsing dot. This is the **only** animated state. |
| `succeeded` | Settled border with duration |
| `failed` | Danger border |
| `unknown` | Warning border, "unknown outcome" |
| `cancelled`, `invalidated` | Faded, label struck through |

Edges: the target is `running` gives an animated dash; the target has
`succeeded` gives solid; otherwise muted. Reduced motion: a static accent
border and no sweep, dash animation or caret blink.

---

## 6. Workstreams

### A. AI View panel and history

**A1. Entry point**
- In `TopBar.tsx`, when connected, the button toggles the AI View
  (`aria-expanded`, `aria-controls`). Its dot pulses while any operation in
  the selected conversation is `running`.
- When not connected, it opens settings (D3).
- AI access remains reachable from the gear and from a link in the panel
  header.
- When the AI window is open (B, queried state), the button focuses that
  window.

**A2. Panel container**
- Evolve `LogsOverlay.tsx`. Keep its resize handle, stored height, clamping,
  back-gesture integration and mobile dialog.
- Rename it through `npm run move`, for example to `AiViewPanel`.
- Header: title, summary (E), exchange selector, **Follow live** toggle,
  **Expand**, **Pop out** (desktop Tauri only), **Close**.
- **Expand** is a panel state filling the app area below the top bar.
  Escape, the same button or back restores it.
- On mobile, the panel is always the dialog, with no pop-out.

**A3. Graph**
- Split `LiveActivity.tsx` into `ActivityGraph`, `OperationInspector`,
  `OperationDetailDialog` and `ExchangeHistory` within `features/activity/`.
- Layout: dependency depth from `operation.dependencies` only. Rows are
  ordered deterministically by first attempt `startedAt`, then `kind`.
- Keep React Flow (`@xyflow/react`) with a custom node, edge classes, and no
  dragging or connecting.
- Coach, opening and retained plans draw as their operations arrive.
- **Follow live vs pinned.** Follow mode shows the newest turn and advances
  automatically. Selecting an older exchange pins it. **There is no "replay".**
  Attempt timestamps cannot reconstruct historical transitions or token
  timing, and no extra recording is proposed.
- Transcription attempts and persona generation stay as separate sections, not
  fused into turn graphs.

**A4. Inspector**

| Field | Source |
|---|---|
| kind, state, role, contract version, dependencies | `OperationView` |
| Downstream count | Operations whose dependencies include this one |
| Latest attempt: models, provider, tokens, started/finished/duration, error, diagnostics | `AttemptView`, shown with `ResponseDetails` |
| Response | Live preview from the stream registry (D.4) while running; afterwards the attempt text (C, D.7) |
| History | The same kind across loaded turns (A5) |

**A5. History retrieval (small native addition; phase 1)**
- A new read-only command `list_turn_history(conversation_id,
  before_turn: Option<String>, limit)` pages turns by `rowid`, independent of
  message paging. It returns `TurnView`s built by the **same** function the
  snapshot uses. Refactor the per-turn builder out of `snapshots.rs:123-190`;
  do not duplicate it.
- The snapshot remains the source for the live, recent window. History pages
  are cached per conversation and invalidated by snapshot revision.
- This makes complete per-node and whole-graph history reachable, including
  coach turns and turns without messages.

**A6. Node full view**
- `OperationDetailDialog`, on `components/dialogs/DetailDialog`, shows:
  request messages, response, attempt switcher (retries), history table with
  latency sparkline, full diagnostics.
- Bodies load through `get_attempt_detail` (C).
- Attempts recorded before C show "not recorded". Content is never
  fabricated.

**A7. Whole-graph timeline**
- In the expanded and window layouts, show a timeline of one exchange from
  `startedAt/finishedAt`. Running bars extend to now.
- It is a static reconstruction of recorded intervals, not a replay.

**A8. Styling, i18n and tests**
- Styles in `styles/features/activity/`, registered in `styles/index.css`.
  Shared hydration utilities in `styles/components/activity.css`.
  `npm run styles:check` must pass.
- Strings go through `useI18n`, added to all locales.
- Tests:
  - Graph equals snapshot for all plans.
  - Every state renders, including `held`.
  - Follow and pin behaviour.
  - History paging reaches old coach turns and turns without messages.
  - The narrow guard from section 2.

### B. Pop-out window and pop-in (Tauri)

1. **Authoritative window state.** A new command `ai_window_state() ->
   { open: bool }` reads `app.get_webview_window("ai")`. The main window
   queries it on mount, on focus, and after any window event. Events are hints
   that trigger a re-query and are never trusted alone. This makes reloads and
   missed events safe.
2. **Selection handoff.** A small in-memory native value `ai_view_selection
   { conversation_id, turn_id | follow, operation_id }` is set by the side that
   is handing off and read by the side receiving it.
   - Commands: `set_ai_view_selection` and `get_ai_view_selection`.
   - Selection and follow mode survive pop-out and pop-in. Panel expansion
     does not.
3. **Pop out.** Main sets the selection, invokes `open_ai_window` (which shows
   and focuses an existing window), closes the docked panel, then re-queries
   state.
4. **Pop in.** The AI window sets the selection and invokes a new
   `dock_ai_window`. Native emits `ai-view-docked` to `main` and closes `ai`.
   Main re-queries, reads the selection and opens the docked panel.
5. **OS close.** Native handles `WindowEvent::Destroyed` for `ai` and emits
   `ai-window-changed`. Main re-queries and does **not** reopen the panel.
6. The AI window keeps following the main window's selected conversation, as
   `LiveActivity.tsx:20-50` does today.
7. Register the commands, update the `DiagnosticCommand` contract and
   `platform/diagnostics/log.ts`, and run `npm run contracts`.
   - Hide pop-out outside desktop Tauri.
   - No capability changes are needed: windows are opened and closed natively,
     and events are covered by `core:default`.

### C. Attempt bodies: one loading contract (next schema version)

**Columns** on `attempts`, all nullable:

| Column | Contents | Written | In the snapshot? |
|---|---|---|---|
| `request_messages` | `json_valid` copy of `Dispatch.messages` | At attempt creation in `dispatch` | No: inspection detail only |
| `response_text` | Complete text of a finished attempt, validated or not | In `finish` (D.7) | No: inspection detail only |
| `preview_text` | Streamed text so far | Periodic flush while running (D7); final value in `finish` (D.7) | See below |

**Bounds:**
- The request is already bounded by the 42-message / 96,000-byte input
  contract (`dispatch.rs:39-44`).
- Text columns are capped at 256 KB UTF-8, the existing direct-response
  ceiling. Nothing larger can arrive, because responses above the hard limit
  are errors (D.2, D.4) whose preview stops at the limit.

**The snapshot contract (one rule):**
- `AttemptView` gains `unpublishedText: string | null`.
- It equals `preview_text` for attempts of **prose operations whose text did
  not become a message**: failed, unknown, cancelled, invalidated, replaced,
  or still running after a crash-recovery restart.
- Prose operations are identified the same way `reply-state.ts` does. Coach
  replies use `coach_reply`. Extend that one helper; do not add a second list.
- Everything else is fetched by `get_attempt_detail(attempt_id) ->
  { requestMessages, responseText, previewText }`.
- This keeps the 150 ms snapshot small while guaranteeing the chat can render
  retained text without a separate fetch.

**Privacy:**
- Bodies are excluded from diagnostic logs (`diagnostics::inference`), server
  traffic and telemetry.
- They are excluded from `conversation_export.rs` unless the owner decides
  otherwise.
- Tests assert these exclusions.

### D. Token streaming

**D.1 Server: SSE framing separated from completion judgement**
- Add `streaming.frames(chunks)`. It does line and event framing, strict
  UTF-8, per-event and total size limits, and the `[DONE]` marker. It yields
  parsed payloads and **makes no decisions** about errors or finish reasons.
- Add `CompletionAccumulator`. It consumes frames and keeps:
  - `choices[0].delta.content` accumulated as text.
  - `id`, `model`, `created` and `provider`.
  - Every top-level scalar field seen, last value wins, bounded by the same
    field and depth limits the native metadata retention uses.
  - `choices[0].finish_reason` and `native_finish_reason`.
  - The last `usage` object **as received**, including cost and details.
  - Any `error` payload, bounded and redacted using the existing
    `provider_errors` capture rules.
- It ends in one of three classifications:
  - `completed`: `[DONE]` seen, with any finish reason.
  - `provider_error`: an error payload was received. Keep reading until EOF or
    `[DONE]` so trailing usage is captured.
  - `transport_broken`: EOF without `[DONE]`, a decode failure, or a timeout.
- `completed` builds a normal `chat.completion` object from the accumulated
  fields. It uses `object:"chat.completion"`, and choice 0 has `message:
  {role:"assistant", content}` plus finish reasons. The server emits the usual
  `result` event, whose fields are unchanged (`operation_id`, `attempt_id`,
  `response`). No new outer fields are added, because the native decoder
  rejects unknown fields. A `length` or `content_filter` finish is **not** a
  server error: native publication rejects it exactly as today for non-streaming
  responses. The accumulated text still reaches native as deltas.
- `provider_error` and `transport_broken` produce the existing `error` event
  (status and code as today). The event gains an optional bounded
  `diagnostics.partial` object with the finish reason, usage and character
  count. It never carries text; text already went out as deltas.
- Settlement uses the final usage if received, otherwise conservative
  settlement exactly as the current relay does (`main.py:647-653`). The claim
  state follows today's rules.
- The existing `/v1/chat/completions` relay keeps `streaming.events` unchanged.
  It is out of scope.

**D.2 Server: `/v1/operations` protocol version 2 and ordering contract**
- `parse` accepts version 1 or 2. Version 2 items may carry `"deltas": true`.
  - Version 1 is byte-for-byte unchanged.
  - The duplicate-protection digest is still computed over the client request,
    as in version 1.
  - Only prose items may request deltas (D4).
  - Delta mode sends `stream: true` plus usage reporting upstream, added after
    `contracts.chat_request` validation.
- **Offsets** are in **Unicode scalar values**. That is Python `len(str)` and
  Rust `chars().count()`. Non-BMP characters count as 1.
- The server keeps one **ordered, lossless** outbound state per item. The
  shared memory-stream-of-events is replaced for delta mode by a writer loop
  over per-item state:
  - `pending`: text not yet sent.
  - `sent`: a scalar count.
  - `terminal`: the pending result or error event.
  - A wake signal.
- Rules:
  1. Coalescing appends to `pending`. No character is ever dropped.
  2. A delta event is `{"type":"delta","operation_id","attempt_id","offset":sent,"text":pending}`.
     After it is written, `sent += len(pending)` and `pending = ""`.
  3. Deltas for an item are rate-limited to no more than 20 per second. The
     rate limit only delays; it never drops.
  4. **Flush before terminal.** When an item's terminal event is ready, the
     writer first emits that item's remaining `pending` as a final delta, then
     the terminal event. No delta for an item is ever written after its
     terminal event.
  5. The writer serves items round-robin. A terminal event waits at most one
     pending flush, so results are never starved by other items' deltas.
  6. **Hard response limit**, per item: accumulated content is at most
     **256 KB UTF-8**. That matches the native direct-route ceiling
     (`request.rs:127`) and sits far above the 12,000-character prose
     contract. When exceeded:
     - Stop reading and close the upstream stream.
     - Emit the pending text up to the limit as a final delta, then the
       existing `error` event: status 502 and code `RESPONSE_LIMIT`, with
       `diagnostics = {stage:"stream", reason:"response_limit",
       chars:<sent>}`. It goes inside the already-allowed `diagnostics` field,
       so no new outer fields are added.
     - Settle conservatively (usage unknown); the claim becomes `unknown`.
     - There is no truncated `result`. A response is either complete and
       within the limit, or an error.
     
     Also:
     - Delta events are at most 20 per second times `WORK_SECONDS`.
     - Delta wire bytes are at most 256 KB plus framing per item. The native
       `STREAM_LIMIT` is updated to match (D.3).
  7. The `complete` event follows all terminal events, as today.
- `/v1/protocol` adds `"operations_versions": [1, 2]`.
- Logs and `runtime.emit` never include text.

**D.3 Native: the grouped route**
- The connection check reads `/v1/protocol` for Hosted and Custom. It caches
  `supports_deltas` in memory per connection revision. If the endpoint is
  missing or has no version 2, the route uses version 1. **Unmodified custom
  servers must keep working.**
- Send version 2 with `deltas: true` only for prose items when supported.
- `Decoder`:
  - Accepts `Event::Delta` only in version 2 mode.
  - The attempt must be pending, and `offset` must equal the accumulated
    scalar count. Anything else is `unknown()`.
  - A delta after that item's terminal event is `unknown()`. The server
    guarantees it never happens.
  - A delta never removes the item from `pending` and never publishes.
  - Accumulated delta text above 256 KB is `unknown()`. The server never sends
    it.
  - The `RESPONSE_LIMIT` error needs no decoder change. Status 502 with a
    code that `hosted::provider_failure_message` does not recognize falls
    through to the existing `status >= 500` branch and becomes
    `UnknownOutcome` ("Usage is unconfirmed"). That matches conservative
    settlement.
  - `STREAM_LIMIT` adds per-item delta allowance per D.2 rule 6.
- The callback `on_delta(index, text_so_far)` is invoked after each accepted
  delta.

**D.4 Native: the OpenRouter direct route (prose only)**
- Prose requests send `stream: true` plus usage reporting. **Structured
  requests stay non-streaming** (D4).
- Add a native SSE framer mirroring `streaming.frames`, with no finish-reason
  judgement, and a native accumulator mirroring D.1.
- On `completed`, serialize the accumulated completion JSON and pass it to the
  **existing `provider::decode`**. Diagnostics, validation and billing fields
  then go through the identical code path as non-streaming.
- `provider_error` and `transport_broken` map to the same error codes as
  today's non-streaming failures. The HTTP header capture from
  `request_payload` is kept.
- Same hard limit: accumulated content above 256 KB stops the read and
  closes the response. The result is a provider error with
  `reason: response_limit` diagnostics and no `Completion`. Text up to the
  limit stays as the preview.
- Non-2xx handling is unchanged.

**D.5 Native: the stream registry and delivery to the UI**
- **Registry.** `Application` gains `streams: Mutex<StreamRegistry>`, keyed
  by attempt. Each entry holds `workspace_generation`, `conversation`, `turn`,
  `operation`, `kind`, `text`, `seq: u64` (monotonic per attempt), `terminal:
  Option<"succeeded"|"failed"|"unknown"|"cancelled"|"invalidated">` and
  `persisted_seq`.
- `Dispatch` gains `turn`, `conversation` and `kind`.
- **Workspace generation.** A monotonic counter increments on workspace
  open, factory reset and workspace switch, and the registry is cleared on
  increment.
  - `Dispatch` captures the generation at dispatch time.
  - Every registry mutation from a transport callback (`on_delta`, terminal)
    first checks that the dispatch generation equals the current generation
    **and** that the attempt's entry exists. Otherwise the callback is
    rejected, so an old dispatch can never repopulate the registry after a
    reset.
  - Every read and event carries the generation.
  - UI rule: an incoming generation **greater** than the store's is adopted.
    The store clears, and the UI re-runs `read_attempt_streams` and the
    snapshot read. An incoming generation **lower** than the store's is
    dropped. Equal generations proceed to `seq` comparison.
- **Updates.** `on_delta`:
  1. Updates the registry: `seq += 1`, `text = text_so_far`, mark dirty.
     **Every** registry change increments `seq`: text, terminal state and
     cancellation. No change is ever published with a repeated `seq`, so the
     UI's "discard `seq` at or below stored" rule can never drop a terminal
     change.
  2. If the attempt is no longer active (checked at most once per emit
     window), sets `terminal = cancelled` (`seq += 1`), emits it, and rejects
     further deltas for that attempt. The text is kept.
  3. Emits `ai-attempt-stream {generation, attemptId, conversationId, turnId,
     operationId, kind, seq, text}` to all windows, throttled to no more than
     20 Hz per attempt. The latest state is always delivered on the trailing
     edge.
- **Read.** A new command, `read_attempt_streams(conversation_id) ->
  {generation, entries:[{attemptId, …, seq, text, terminal}]}`.
- **UI reconciliation.** Subscribe to events first, then call
  `read_attempt_streams`. For each attempt, keep whichever copy has the higher
  `seq`, and discard any event with `seq` at or below the stored one. This
  handles late-opened windows, reloads and stalled providers: the read returns
  the current text even when no further event arrives.
- **Terminal handling.** `finish` sets the registry entry's `terminal`
  (`seq += 1`) and emits a terminal event with that new `seq`. The entry is evicted only after
  `finish`'s transaction has committed **and** the snapshot revision produced
  by that commit exists. From then on, the attempt's text is served by the
  snapshot (`unpublishedText`) or by the message.
  - **Commit ordering:** the terminal registry update happens after the
    `finish` transaction (including its revision bump, D.7) has committed. The
    first snapshot showing the attempt finished therefore already contains
    its retained text.
  - If the terminal event arrives **before** the UI sees the snapshot: the UI
    keeps showing the registry copy until the snapshot shows the attempt
    finished.
  - If it arrives **after**: the UI already has the authoritative snapshot and
    drops the entry.
  - The UI never shows an empty state between the two.
- **Never** call `bump()` from `on_delta` or from periodic flushes. The
  snapshot revision changes at existing state transitions and at the terminal
  retention write (D.7).
- **Periodic flusher (D7).** One native task wakes every ~1 s. It writes
  `preview_text` for every **dirty** running entry of the current generation
  in one short transaction, then clears the dirty flags. It runs whether or
  not deltas arrive, so text received before a provider stall is flushed
  during the stall. It is best effort: under scheduling or storage delays the
  gap can exceed 1 s.

**D.6 UI streaming display**
- `platform/ipc/attemptStream.ts` handles subscription and reads. The store
  lives in `state/`, keyed by attempt and scoped by generation and
  conversation.
- `StreamingReply` renders **one plain text node** (`dir="auto"`,
  target-language `lang`, no interactive spans, **no word buffering and no
  per-word wrappers**) with a caret.
  - It shows exactly the text received, in every script.
  - If a complex-script rendering defect is demonstrated later, buffering
    becomes a separate owner-approved change.
- When the reply message arrives, render the normal path (`TargetText` or
  `SavedGlossText`). This is a single remount.
- `TurnView`:
  - Reply operation `running` with no message: `StreamingReply`, whose text
    comes from the store.
  - Reply operation in any non-success end state: the failed or ended bubble,
    `ReplyStatus`, renders `unpublishedText` (or the store copy until the
    snapshot catches up), styled by state, with the error and existing
    controls.

**D.7 Retention lifecycle: text never disappears**

`finish` writes `response_text` / `preview_text` **before** the scope check,
next to the diagnostics write at `publication.rs:74`.

**Revision bump on terminal retention.** Today the early return
(`publication.rs:78-80`) commits **without** `bump()`. A window could then see
the cancellation or invalidation snapshot before the text is stored and never
be woken to see it. So whenever the terminal write changes data the snapshot
exposes (`unpublishedText`, or attempt state and text), `finish` calls
`bump()` in the same transaction, **including on the early-return path**. This
is one bump per terminal attempt, not per token.

Case by case:

| Case | What happens |
|---|---|
| Success | `response_text` is written, and the message is published as today. `unpublishedText` stays null, because the message is the display. |
| Validation failure (D1) | `preview_text`/`response_text` written; attempt failed; the bubble shows the text. |
| Provider or transport error | Text accumulated from deltas is written; state as today. |
| Cancellation | The scheduler's cancel paths call `finish(Err)` for unfinished items (`scheduler.rs` bottom loop); text written via the pre-scope write, with a revision bump. |
| Invalidation / replaced turn | Same pre-scope write; the text is shown on the invalidated or replaced exchange (D6). |
| Retry | A new turn and attempt stream in their own bubble. The old attempt's text stays under "Earlier attempt" (D6) and in AI View history. |
| Window reload | `read_attempt_streams` plus the snapshot restore everything. |
| App termination (**accepted loss window**) | The periodic flusher (D7) keeps text up to the last flush, normally under about 1 s old but best effort. Startup recovery marks the attempt `unknown` (`recovery.rs:7`), and its `preview_text` shows via `unpublishedText`. Text received after the last completed flush may be lost. This is the one stated exception to "never disappears". |

### E. Live status summary

- A pure function `domain/conversation/activity-summary.ts(turn, replyText:
  string | null)`, with no kind literals (it imports the reply helper):
  - One running operation: its humanized kind.
  - A running reply with text: "… streaming · N words". N is counted with
    `Intl.Segmenter(lang, {granularity:'word'})` word-like segments over the
    text, so it is correct for spaceless scripts. `lang` comes from the
    conversation's target language.
  - Several running: up to two humanized kinds, then "+k more", then
    "· done/total done".
  - Queued (`waiting_dependencies`/`ready`) and `held` operations are counted
    separately: "· 2 waiting", "· held".
- The most recently finished operation comes from `attempts.finishedAt`.
- It is used by `ReplyStatus` (replacing "Thinking…"), by a one-line turn
  status under the latest turn while `turn.state === 'assisting'` (fading 3 s
  after it settles), and by the AI View header.
- `role="status"` announces state changes, not individual words.

### F. Hydration animation (operation states only)

- Utilities: `.is-hydrating` (moving border), `.hydrating-line` (shimmer
  placeholder) and `.stream-caret`, with reduced-motion fallbacks.

| Operation state | Surface treatment |
|---|---|
| `running` | Animated (sweep, shimmer or caret, per surface) |
| `waiting_dependencies`, `ready` | Static placeholder at reduced opacity, no motion |
| `held` | Static warning-tinted placeholder with a "held" label |
| `succeeded` | Content; the border transitions back to `--line-soft` |
| `failed`, `unknown`, `cancelled`, `invalidated` | The existing error/status treatment |

- Bindings:

| Surface | Driven by |
|---|---|
| Reply bubble | Reply operation state |
| Translation line | `translation_state` |
| Word-by-word | `gloss_state` |
| Explain | `explanations_state` |
| Feedback | `feedback_state` |
| Suggestions | `suggestions_state` |
| Speak button | Speech operation state |

- At most one moving edge per surface. **No per-word fade** (D.6). The
  streaming node fades in once when it first appears.

---

## 7. Phasing

| Phase | Contents | Notes |
|---|---|---|
| 1 | A (including the A5 native history command), B, E, F | No protocol change. A5 and B add read-only or window native commands, no schema. |
| 2 | C (attempt bodies, `unpublishedText`, `get_attempt_detail`) | Next schema version (S5) |
| 3 | D.4 (OpenRouter prose streaming), D.5, D.6, D.7, periodic flusher | Needs 2 for retention |
| 4 | D.1, D.2 (server; **deploy needs owner authorization**), D.3 | Server deploys before the app enables version 2 |
| 5 | Structured-output deltas | D4 |

## 8. Test plan

**Server:**
- `frames`: split UTF-8, oversize, missing `[DONE]`, data after `[DONE]`.
- Accumulator:
  - `length` and `content_filter` finishes with trailing usage produce a
    result event with text and usage.
  - An error payload after partial output produces an error event with
    `diagnostics.partial`, with usage captured if it arrives later.
  - Broken transport produces conservative settlement.
- Version 1 unchanged: parse, digest, duplicate replay.
- Version 2:
  - Offsets contiguous with non-BMP text (emoji, CJK extension B).
  - A slow consumer drops no characters.
  - Flush-before-terminal holds under forced races.
  - No delta after a terminal event.
  - Round-robin fairness with 8 items.
  - Hard limit: exceeding 256 KB produces a final delta up to the limit,
    then an `error` event with `RESPONSE_LIMIT` and `reason:response_limit`
    in `diagnostics`, upstream closed, conservative settlement, no `result`.
  - The terminal `result` event contains exactly `type`, `operation_id`,
    `attempt_id` and `response` in version 2, checked against the unchanged
    strict native decoder fixture.
  - The result from assembled chunks equals the non-streaming result for the
    same fixture, **including diagnostics fields**.

**Native:**
- Decoder:
  - Version 1 rejects `delta`; version 2 accepts it.
  - Offset gap or overlap produces `unknown()`.
  - A delta after a terminal event produces `unknown()`.
  - Deltas never publish.
  - Sibling results survive a broken stream.
- Direct SSE: the stream-assembled `Completion` equals the non-streaming
  `Completion` (text, finish reason, model, provider, tokens and
  **diagnostics**).
- `finish` writes text before the scope check, for cancelled, invalidated and
  replaced turns.
- **Regression (review 2):**
  - Every registry change, terminal and cancellation included, strictly
    increases `seq`. A terminal update after a text update with no new text
    is still applied by the UI reconciler.
  - After a generation increment, a late callback from an old dispatch is
    rejected and leaves the registry empty.
  - `finish` on the early-return (lost-scope) path writes retained text
    **and** bumps the revision once. A watcher that received the cancellation
    snapshot is woken and sees `unpublishedText`.
  - With deltas stopped (stalled provider), the flusher writes dirty text
    within one period. A simulated kill after that flush recovers the text.
  - Direct-route hard limit produces a `response_limit` error with the
    preview kept.
  - No `bump()` from `on_delta` or the flusher (revision counter test).
- Registry:
  - `seq` is monotonic.
  - A generation change clears entries.
  - `read_attempt_streams` returns the current text during a stall.
  - Eviction happens only after the commit and its revision.
- Recovery keeps `preview_text` and exposes it through `unpublishedText`.
- `list_turn_history` reaches coach turns and turns without messages, and uses
  the shared builder.
- `contracts:check` passes; clippy runs with `-D warnings`.

**UI:**
- Graph equals snapshot for every state, including `held`.
- The narrow guard.
- Store reconciliation:
  - Subscribe, then read.
  - Higher `seq` wins.
  - A lower generation is dropped. A higher generation is adopted: the store
    clears and the UI re-reads (regression, review 2).
  - A terminal event before or after the snapshot never shows a blank.
- `StreamingReply` shows exact received text in Latin, Arabic, Hindi and
  Mandarin, with a single remount on commit.
- Failed, cancelled, invalidated and recovered bubbles show retained text.
- Retry shows the "Earlier attempt" disclosure.
- The summary function (word counts via `Intl.Segmenter`, held and waiting).
- Window state after reload and after a missed event; selection survives
  pop-out and pop-in.
- Reduced motion.

**Manual:**
- Hosted with server version 2.
- Custom against an unmodified version 1 server.
- OpenRouter.
- Android.
- Pop-out, pop-in, OS close, reload of either window.
- Kill the network mid-stream.
- Kill the app mid-stream and reopen.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Unknown events poison batches | Version 2 only, only on request |
| Custom servers | `/v1/protocol` negotiation, falling back to version 1 |
| Lost characters or ordering races | Lossless per-item buffers, flush-before-terminal, scalar offsets, native contiguity checks |
| Starved results | Round-robin writer; a terminal waits at most one flush |
| Late listeners or stalls | Registry read plus sequence reconciliation |
| Stale events after reset | Workspace generation |
| Text lost on the scope early return | Pre-scope write |
| Text lost on crash | Periodic ~1 s dirty flush, including during stalls (D7); stated best-effort loss window |
| Stale snapshot after a lost-scope finish | Terminal retention write bumps the revision on every path (D.7) |
| Unbounded responses | 256 KB hard limit on both routes, surfaced as an error inside the existing event shape |
| Diagnostics drift between streaming and non-streaming | Both sides assemble a completion JSON and reuse the existing decode; equality tests include diagnostics |
| Incomplete history | Turn-keyed `list_turn_history` |
| Middle-layer drift | Section 2 rules plus the narrow guard |
| 90 s total reqwest timeout (`request.rs:10`) | Unchanged; flagged for review if long prose streams approach it |

## 10. Reviewer checklist

- [ ] Is there any second definition of the graph (a kind collection,
      dependency relations, labels or descriptions) outside `turn_plan.rs`?
- [ ] Is version 1 byte-for-byte unchanged, including the digest? Does the
      version 2 ordering contract guarantee no lost characters and no delta
      after a terminal event?
- [ ] Do both routes produce completions through the unchanged
      `provider::decode`, with equal diagnostics?
- [ ] Is text written before `finish`'s scope check? Does every row of the D.7
      table hold?
- [ ] Do registry reads, `seq` (incremented on **every** change),
      generation adoption, dispatch-generation rejection and eviction timing
      prevent blanks and stale repopulation?
- [ ] Does every terminal retention write, including the early-return path,
      bump the revision exactly once?
- [ ] Is the 256 KB hard limit enforced identically on both routes, with the
      terminal event shape unchanged?
- [ ] Is the crash loss window described as best effort, with a periodic
      flush that runs during stalls?
- [ ] Is `bump()` never called per delta?
- [ ] Are all nine states handled in graph, summary and hydration, with motion
      only in `running`?
- [ ] Is window state queried rather than assumed, and does selection survive
      handoff?
- [ ] Are bodies excluded from logs, exports and server traffic?
- [ ] Are D1–D4, D6 and D7 resolved before their phases?

## 11. Out of scope

- Changing snapshot delivery (the 150 ms long-poll stays).
- Scheduler batching and priority.
- Automatic retries.
- Streaming speech.
- Historical replay.
- The `/v1/chat/completions` relay.
- Large-file decomposition beyond the shared turn builder (A5).

## 12. Review log: first external review (September 18, 2026)

All findings were verified against the source before integration.

| # | Finding | Verified at | Resolution |
|---|---|---|---|
| 1 | `streaming.events` raises on error and on `length`/`content_filter`/`error` finishes, losing text, finish reasons and usage | `streaming.py:40-44` | D.1: separate `frames` framing from `CompletionAccumulator`, three terminal classifications, trailing usage kept, tests for each |
| 2 | Full-text events do not recover late listeners | Design gap | D.5: registry with `read_attempt_streams`, monotonic `seq`, subscribe-then-read reconciliation, workspace generation, defined terminal ordering |
| 3 | Retention lifecycle incomplete; `finish` returns early; lazy-body contradiction; crashes | `publication.rs:74-80`, `recovery.rs:7` | C: one body contract (`unpublishedText` in the snapshot, detail command for the rest); D.7 lifecycle table; pre-scope write; D7 checkpoints; D6 retry display |
| 4 | Lossy latest-value delta path unsafe; delta-after-result race; offset units; bounds | `grouped.py:95` | D.2: lossless per-item buffers, flush-before-terminal, round-robin, Unicode scalar offsets, explicit bounds and tests |
| 5 | Message-keyed paging cannot give complete turn history | `snapshots.rs:110-123` | A5: turn-keyed `list_turn_history` in phase 1 using the shared turn builder |
| 6 | `held` omitted; `*_state` fields are operation states; "pending" contradiction; word count from length | `snapshots.rs:176`, `:~100-107` | Sections 2 and 5, F: full state set, motion only in `running`; E: word count with `Intl.Segmenter` over text |
| 7 | Complex-script buffering contradicts immediate display; per-word fade conflicts | Plan inconsistency | D.6: one plain text node, no buffering, no per-word wrappers; F updated |
| 8 | Reconstruction may drop diagnostics | `response.rs:~94` | D.1 and D.4: accumulate all bounded top-level and choice metadata and usage as received; native reuses `provider::decode`; equality tests include diagnostics |
| s1 | Schema 23 in use; resets already authorized | `schema.rs:4`, `AGENTS.md:238-244` | S5; old D5 removed |
| s2 | Structured OpenRouter requests should stay non-streaming | Plan inconsistency | D4 and D.4: prose only |
| s3 | Window-open state can go stale | Design gap | B1: `ai_window_state` queried; B2: selection handoff |
| s4 | "Replay" cannot be reconstructed | Design gap | A3: removed; replaced by follow/pin |
| s5 | The kind-literal guard is too broad | Plan inconsistency | Section 2: narrow guard |

## 13. Review log: second external review (September 18, 2026)

| # | Finding | Verified at | Resolution |
|---|---|---|---|
| 1 | Terminal changes must increment `seq`; the UI must adopt newer generations; old dispatch callbacks must be rejected | Plan gap | D.5: every registry change increments `seq`; generation captured in `Dispatch` and checked on every mutation; UI adopts higher generations and drops lower ones; regression tests |
| 2 | The early-return path in `finish` commits without a revision bump, so readers may never see retained text | `publication.rs:78-80` | D.7: terminal retention write bumps the revision once on every path, including early return; terminal registry update after commit; regression test |
| 3 | The 256 KB cap contradicted "accumulation continues"; truncation metadata must not add outer fields to the strict terminal event | `grouped.rs:22` (Result fields), `request.rs:127` | D.2, D.3, D.4: single hard 256 KB limit on both routes; exceeding it gives an `error` event with `RESPONSE_LIMIT` and `reason:response_limit` inside the existing `diagnostics` field; no truncated results; tests check the event shape |
| 4 | "At most once per second" is not a guarantee | Plan wording | D7, D.5, D.7 and goal 5: periodic dirty flush that runs during stalls; loss on abrupt termination stated as a best-effort accepted window; regression test |
