# AI workflow efficiency audit

Date: 2026-10-10. Stage 11.1 source investigation; implementation priorities,
not measured latency results. Governing checklist:
[production integration](ai-graph-production-integration.md).

## Scope and result

Reviewed conversation admission/dispatch/publication, store ownership, conversation
and activity subscriptions, saved result inspection, reading, playback and Drill
audio delivery. The findings below are confirmed source mechanisms. Their ranking
is provisional until traces distinguish frequency, lock wait, service time and
visible delay. This is not an exhaustive audit of every application command.

Provider calls are dispatched concurrently outside the store guard. Local graph
operations release the provider permit. The problem is not a universal serial
provider pipeline: synchronous shared-store work, repeated projections and polling
can delay otherwise independent work. No deadlock or exact cause of the reported
freeze has been established.

## Ranked inventory

Paths below are repository-relative. Each row identifies both evidence and the
measurement required before claiming a performance improvement.

| Priority | Confirmed mechanism and source | Measurement / candidate repair |
| --- | --- | --- |
| 1 | `native/src/language/reading/mod.rs::validate_source` calls `store.snapshot()` for learner identity, then non-speech access validation calls it again. `application/native_reading.rs` invokes source validation every 10 ms while waiting. | Count snapshots and lock occupancy per pending request. Replace full projection with an authoritative narrow identity read; wake on relevant changes while retaining cancellation and final authority checks. |
| 2 | `conversations/execution/graph_runtime/execution.rs::next` starts each claim by enumerating retained conversation runs; it exports inspection before checking active state. The host calls `next` repeatedly to drain work. | Record scanned runs, exported bytes and claim time with increasing retained history. Derive ready-work indexing from authoritative runtime state; preserve reactivation, recovery, single-step and independent branches. |
| 3 | `application/state.rs` owns one synchronous store mutex. Snapshot/history reads, scheduler claims and publication use it. `commands/workspace.rs::watch_conversation` also performs projection directly in its async command. | Separate lock wait from lock-held CPU/SQL/serialization time. Narrow expensive projections and remove synchronous blocking from async workers; moving work to a blocking worker alone does not eliminate contention. |
| 4 | `conversations/execution/snapshots.rs` uses the workspace-wide revision, projects up to 100 messages and many turns, and includes graph inspection in turn views. Owner/status/evidence SQL is repeated inside these projections. | Count queries, graph inspections and IPC bytes per changed message. Introduce appropriately scoped invalidation and bounded projections without inventing a second runtime interpretation. |
| 5 | `useConversationSnapshot.ts` and `activity/useConversationActivity.ts` independently watch full conversation snapshots. The activity watcher awaits `readWorkspace()` before publishing the received snapshot. Both refresh already-loaded history as revisions change. | Count active watchers and repeated page reads; measure snapshot arrival-to-render separately from workspace refresh. Share suitable subscriptions and avoid reloading unchanged history. Preserve edits/deletions in loaded history. |
| 6 | `application/scheduler.rs` sleeps 100 ms after dispatch. `watch_conversation` samples every 150 ms and forces a snapshot after 20 seconds. Changed streaming observations can bump the workspace revision every 250 ms. | Trace provider completion → settlement → adoption → projection → paint. A polling interval can itself exceed the agreed 50 ms target on paths that wait for the next tick. Use completion/change notifications with recovery checks, not an additional scheduling model. |
| 7 | `ai/inspection.rs::attempt` reconstructs historical inspection at the requested revision. `NativeAttemptDetails.tsx` reloads when graph revision changes. First inspection credit calls the same inspection reader again in `learning/effort/bot.rs`. | Measure reconstruction duration/bytes and duplicate work for a selected attempt. Reuse authoritative immutable evidence where valid, retain exact revision selection, and preserve one-time credit and disclosure ownership. |
| 8 | `activity/NativeGraph.tsx` memoizes layout by artifact object reference; deserialized snapshots supply new objects. Nodes/edges are rebuilt. `ResponseDetails.tsx` stringifies values even inside closed details. Selected `WorkspaceGraphActivity.tsx` runs continue polling when surrounding details are collapsed. | Profile layout, serialization and React commits during generation and selection. Retain artifact identity, serialize expanded details on demand, and make subscriptions visibility-aware. All topology still derives from the executable artifact. |
| 9 | `graph_runtime/budget.rs::outstanding` reconstructs current historical inspection across qualifying partitions to calculate admission. | Trace send/admission latency, partition count and checkpoint bytes. Read authoritative resident state where available without weakening admission or recovery semantics. |
| 10 | `platform/audio/reading-speech.ts` awaits `observer.onAudio` before playback. Drill's callback awaits `inspectDrillAudio` before returning. Message speech delivery also uses 80/100 ms waits in specific pending/stream paths. | Measure audio ready → first sound independently of provider wait and inspection readiness. Allow independent inspection/display where safe; preserve cache identity, cancellation, alignment and source ownership. |
| 11 | `TurnReplyHelp.tsx` performs conversation and workspace reads before a new helper request. `platform/ipc/native.ts` awaits diagnostic logging before rethrowing an IPC failure. | Count preflight reads and error-display delay. Remove redundant preflight only when native authority remains sufficient; preserve useful diagnostics without delaying visible failures. This helper path mutates requested work, unlike opening saved content. |

`execution.rs::maintain` checks checkpoint usage before compaction; it does not
compact on every transition. Include occasional compaction in long-tail traces,
but do not describe its cheap threshold check as a full rewrite.

Reply reveal deliberately ticks at 40 ms and can spread a burst across multiple
frames. Report first content, last received content and completed presentation
separately. Visible animation duration is not evidence of slow Rust execution.
Development React measurement retention is already bounded by
`platform/diagnostics/development-measures.ts`; benchmark the built UI as well as
development mode and keep capture measurements in their own bounded buffer.

## Agreed initial budgets and workflow set — stage 11.2

The user approved these targets on this machine on 2026-10-10:

- Existing loaded content responds by the next frame.
- Small local reads reach visible results within 50 ms at p95.
- Provider completion reaches visible results within 50 ms at p95, excluding
  provider waiting time. Record streaming first-content and final-content paths.
- Large cold-history loads receive a separately measured budget.

Representative workflows: conversation/send; opening saved suggestions and
feedback; activity selection during generation; cached playback;
recording/transcription; message revision.

These are acceptance targets, not passing measurements. Record sample counts,
warm/cold state, build identity, workspace size, capture enabled/disabled and
provider timing mode. Include p50/p95/max and individual long tasks rather than
only averages. Do not subtract provider time from unrelated queued local work.

## Measurement and repair discipline

Use correlated operation IDs for UI input, IPC dispatch, native entry, mutex
acquisition, SQL/projection, graph settlement/adoption, IPC return and browser
presentation. Each process uses its own monotonic clock; calibrate cross-process
offset and uncertainty rather than directly subtracting unrelated clock origins.
Measure queue wait separately from service time and recording overhead separately
from application latency. Repeated operations need distinct IDs.

First establish actual desktop attachment and explicit capture. The recording
agent's tooling is a foundation, not proof that native provider traffic, user
audio or the workspace have been captured. Native transport recordings must use
the real transport boundary; browser network recording cannot see Rust HTTP.
Replay must use an isolated workspace and fail when required data is missing.

At stage 11.10, take one ranked problem at a time: establish its baseline, make
the smallest coherent correction, rerun the same trace and affected regressions,
then record the result before moving on. Keep publication authority, exact source
identity, cancellations, disclosure, earned credit and executable topology intact.
No performance fixes or running-app measurements are claimed by this audit.
