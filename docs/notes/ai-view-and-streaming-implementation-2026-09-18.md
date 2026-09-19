# AI View, live status and token streaming: implementation record (September 18, 2026)

Status: **implemented in source, all phases of the plan.** This record covers
the plan in `ai-view-and-streaming-implementation-plan-2026-09-18.md`
(revision 3). Local verification is recorded below.

Nothing here describes a deployed server or a restarted desktop application.
**The server change (protocol version 2) is not deployed.** Deployment needs
explicit authorization (`AGENTS.md`). Until it is deployed, the hosted route
keeps using version 1 automatically. Nothing was committed or pushed.

## Implemented behavior

### AI View (phase 1)

**Entry point**
- When connected, **AI Connected** toggles the AI View panel.
- When not connected, it opens AI access settings, as before.
- While any operation of the open conversation is running, the status dot
  pulses.
- If the AI View is popped out, the button focuses that window instead of
  opening a second view.

**Panel**
- The resizable bottom panel (evolved from `LogsOverlay`, now `AiViewPanel`)
  can expand into a window-filling pop-over. Escape or back restores it.
- **Pop out** moves the view into its own desktop window, and **Pop in**
  returns it.
- Native answers whether that window exists (`ai_window_state`). Events only
  prompt a re-read.
- The selected exchange, follow mode and selected operation carry over between
  the panel and the window (`set_ai_view_selection` / `get_ai_view_selection`).
- The popped-out window uses the learner's interface language and theme.

**Recorded-run graph**
- The recorded-run graph comes only from each turn's recorded operations and their
  dependencies.
- All nine states are shown: waiting, ready, held, running, succeeded, failed,
  unknown, cancelled and invalidated. Only running work moves.
- **Follow live** tracks the newest exchange; choosing an older exchange pins
  it. There is no replay.

**Inspector** (select a node)
- Shows state, role, contract, dependencies, downstream count, model,
  provider, tokens, timing, error and diagnostics.
- Shows the live or recorded response.
- Shows the operation's history across exchanges.

**Full view** (the expand button)
- Attempt switcher, recorded request messages and response, history with a
  latency sparkline, and full diagnostics.

**History**
- `list_turn_history` pages turns by turn, independently of message paging, so
  coach turns and turns without messages are reachable.
- It reuses the snapshot's own per-turn builder (`snapshots.rs` `turn_view`).
- The expanded and window layouts add a timeline built from attempt
  start/finish times.

**Live summary**
- "Thinking…" became a live summary built from the turn's operations. Running
  kinds are named, with the count of words received so far, done/total,
  waiting, held and failed counts, and the last finished operation.
- A one-line status stays under the newest exchange while follow-on work runs,
  and lingers for 3 s after it settles.

**Hydration**
- Only surfaces whose operation is running move: the reply bubble's border
  sweep and cursor, the translation shimmer, the Word-by-word, Analysis and
  suggestions surfaces.
- Waiting and held surfaces are still.
- `held` translation and word-meaning states are now shown; before, they
  showed nothing.
- Reduced motion replaces all motion with a still accent border.

### Attempt bodies (phase 2, schema 24)
- Each attempt records its exact request messages at dispatch, plus its
  response text and streamed preview.
- The snapshot carries `unpublishedText` only for prose replies that never
  became a message. Everything else is read on inspection (`get_attempt_detail`).
- Bodies stay local: conversation export excludes them (tested), and logs and
  server traffic do not read them.

### Streaming (phases 3–4)

**OpenRouter route**
- Prose replies stream over SSE. Structured requests stay whole.
- A completed stream is rebuilt into the same completion JSON and passed to the
  existing `provider::decode`. Diagnostics and billing fields match a
  non-streamed response (tested).
- Failures keep the text that arrived without putting it into diagnostics.
- Responses are capped at 256 KB; exceeding that is an error, never a
  truncation.

**Hosted and Custom routes**
- `/v1/operations` protocol version 2: the server streams each prose item
  upstream and sends ordered, lossless `delta` events, then the unchanged
  `result` event.
- Per item, the server flushes before the terminal event, serves items
  round-robin, and caps text at 256 KB. On overflow it sends the existing
  error event with code `RESPONSE_LIMIT`.
- Version 1 is unchanged.
- The app uses version 2 only when `/v1/protocol` advertises it
  (`operations_versions`), so unmodified custom servers keep working.

**Stream registry** (native)
- Every change raises a per-attempt sequence number, including terminal
  changes.
- A workspace generation rejects callbacks from before a reset.
- Windows subscribe to events first, then read the current text
  (`read_attempt_streams`), so late-opened or reloaded windows catch up.
- A pump pushes changes at about 20 Hz. It saves running text about once a
  second, including during provider stalls, without moving the snapshot
  revision.

**Retention**
- `finish` saves the text before its scope check.
- It bumps the revision once on the early-return path, so readers that already
  saw a cancellation still get the text.
- A reply that fails validation is not saved as the conversation message (D1).
  Its text stays visible in the failed bubble and the AI View.
- After an abrupt exit, the last flushed text shows on the recovered `unknown`
  attempt. Loss is best effort, normally under about 1 s.

### Other changes
- Error messages no longer claim that nothing was shown.

## Decisions applied

The plan's defaults were used for D1–D4, D6 and D7. S5: the schema moved to
24; older development workspaces need a Factory Reset.

## Verification

- **UI:** 768 tests passed across 121 files. This includes the new AI View,
  panel/window, top-bar, summary, stream-store, reply-stream and guard tests.
  - Production build passes.
  - Stylesheet checks pass.
  - The contract check passes.
- **Native:** 422 passed, 1 ignored (pre-existing). The new tests cover:
  - turn history
  - attempt bodies and retention, including the early-return bump
  - periodic saves without a revision bump, and crash recovery
  - the SSE framer and accumulator, including diagnostics equality
  - streamed direct requests and their failures
  - registry sequence and generation rules
  - the v2 decoder: offsets, late deltas and limits
  - a v2 request end to end, and the protocol probe

  Clippy with warnings denied and rustfmt are clean.
- **Server:** 391 passed, 7 skipped (external integration prerequisites). The
  new tests cover:
  - v2 lossless ordering with non-BMP text
  - truncated finishes
  - errors after partial output
  - broken streams
  - the response limit
  - v1 unchanged
  - digest stability
  - a slow consumer with racing terminal events
- **Visual:** `ui/tools/ai-view-preview.html` renders the production
  components with sample data. It was checked in the browser: the graph fits
  its box and refits on resize, node clicks drive the inspector, and the
  streaming, failed-retained, held and waiting states render.
  - This check found and fixed one defect the mocked unit tests could not
    catch: React Flow disables pointer events on non-draggable nodes without
    an `onNodeClick` handler.

Not verified: the running desktop app end to end, the popped-out window on a
real display, Android, and live providers.

## Running the changes

1. Rebuild and restart the app and the local server together.
2. Schema 24 requires a Factory Reset for existing development workspaces.
3. Deploy the server before expecting hosted-route deltas.

## Review fixes (September 18, 2026)

Implemented after the independent review; these changes supersede the affected
behavior described above:

- Grouped dispatch rechecks every attempt and admission hold after the protocol
  probe, and verifies the current connection revision, route, URL and credential
  reference before submitting inference. A delayed localhost probe regression
  covers cancellation, deletion, credential revocation, a profile revision change,
  a new hold, and the unchanged-authority success case.
- A terminal snapshot no longer discards live prose merely because its attempt
  ended. Failed/cancelled/invalidated/unknown attempts keep the live copy until
  retained text covers it; success hands over to the atomically saved message.
  The inspector also keeps that live copy and rereads bodies when a later
  retention commit updates the snapshot without changing the attempt state.
  Mounted readers keep their last observed text independently, so an earlier
  handoff in the inspector cannot erase text still needed by the chat. Workspace
  generation changes invalidate those local copies as well.
- Native and server stream failures retain received provider IDs, models,
  provider names, finish reasons and nested usage metadata through the existing
  redaction rules. Native framing/limit failures retain the accumulated facts;
  server limit/timeout paths retain known usage for settlement. Regression tests
  verify both useful metadata and removal of credentials, content and unknown
  private strings. Invalid usage remains an explicit failure with its validation
  path and provider metadata; it cannot mask itself during settlement cleanup.
- Window selection is read before it can be overwritten. Restoring an exchange
  beyond the newest 50 turns pages history until that exchange is available,
  displaying a loading state rather than silently following the newest exchange.
  Tests cover both docked and separate-window modes and a failed history read.

Verification after these fixes:

- UI: **778 passed** across 122 files.
- Native: **424 passed, 1 ignored**.
- Server: **397 passed, 7 skipped** (external integration prerequisites).
- Production build, stylesheet checks, generated-contract verification, clippy
  with warnings denied and rustfmt checks pass. The build retains its existing
  bundle-size advisory.
- The existing generated `AttemptView` declaration has trailing whitespace
  reported by `git diff --check`; it was not edited by these fixes.

These are source and automated checks. The running desktop app, real window
handoff, Android and live providers still need manual verification. No commits,
staging changes, pushes or deployment were performed during the review fixes.


## Static graph exploration (September 19, 2026)

Implemented in source after the live-view review:

- The AI View now has **Recorded runs** and **Graph definitions** modes.
  Definitions work without recorded turns or configured AI access; the existing
  **More → AI activity & tools** entry remains available when disconnected.
- A graph selector offers conversation reply, conversation opening, private coach,
  persona generation and speech transcription. A second selector and clickable
  graph nodes select the inspected operation. Dependency/dependent links also
  navigate between operations. Expanded inspection uses the shared wide dialog.
- The three conversation blueprints read `turn_plan.rs` directly. Standalone
  generation and transcription are explicitly separate single-operation graphs.
  Static nodes have no attempt state, timing or animation. Optional speech and
  the declared-but-not-admitted retry check are identified explicitly. Retained
  historical producers are not presented as current executable graphs.
- Prompt inspection uses pure projections shared with runtime builders. Support,
  assessment, translation, private-coach and persona-generation messages use
  placeholder context. Conversation prompts display their authored conditional
  fragments and difficulty variants. Glosses display the canonical base
  instruction and the dynamic guidance/source-schema insertion points. These
  are definitions, not a fully resolved request for a particular conversation.
  Available output schemas and native/content source paths are expandable.
  Speech and local context steps explicitly explain that they have no chat prompt.
- Mode, graph and operation selection carry between panel/window through native
  presentation state. Incoming live activity and conversation selection do not
  change a manually selected definition. Switching back to runs restores normal
  live/history controls; returning to definitions retains the graph while mounted.
- `get_ai_graph_definitions` reads bundled configuration without a database,
  credentials, request dispatch or workspace mutation. UI components remain
  operation-kind agnostic; generated types come from Rust.

Verification: 782 UI tests pass across 122 files; 425 native tests pass, one
ignored. Production UI build, styles check, Rust formatting and Clippy pass.
Native tests include catalog coverage against the scheduler declarations; UI
regressions cover empty workspaces, manual selection, dependency navigation,
window handoff, independence from live updates and explicit catalog retry.
A temporary browser fixture using the real components verified graph layout,
long prompt wrapping and expanded inspection. The fixture and preview server
were removed afterward. No desktop restart, live inference, deployment, commit
or push was performed. The existing build chunk-size advisory and generated
`AttemptView` trailing whitespace remain.
