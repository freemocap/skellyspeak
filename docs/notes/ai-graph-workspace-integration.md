# Graph workspace integration design

Date: 2026-10-08. Status: **native SQL storage, turn ownership, accepted-effect
publication and format-60 producer wire identities implemented; production workflow, access
callback and scheduler wiring remain unfinished**.
This makes step 2 of the
[production integration plan](ai-graph-production-integration.md) concrete.
The [foundations](ai-graph-foundations.md), [durability](ai-graph-durability.md)
and [retention](ai-graph-retention.md) remain the semantic owners.

## Ownership before tables

The workspace owns locking, reset, migration and the transaction. Conversations
own turn identity, message channel, source authority and accepted messages.
Learning owns qualification and stable award identity. The graph owns readiness,
attempts, producers, sharing, uncertainty and adoption facts. A database adapter
must not translate those facts into a second executable operation state machine.

The format-57 storage boundary supports one engine per **conversation and exact
executable catalog identity**, containing multiple coach runs. A turn is a run,
not an engine. Catalog identity means a deterministic digest of the exact sorted
artifact identities bound to the engine; it is not the application version.

This permits exact reuse across turns and artifacts in that engine, subject to
the core's operation/contracts/inputs/scope equality and reuse policy. It does
not authorize reuse across conversations or catalog versions. The conversation
boundary follows source deletion ownership, rather than the shape of the coach
graph. Other domains need their own explicit source ownership review before
joining a partition; this is not a new restriction in the generic graph core.

The alternatives have concrete consequences:

| Partition | Consequence |
| --- | --- |
| Per turn | Prevents cross-turn sharing even when exact reuse is authorized. Reject for this integration. |
| Entire workspace | Shares broadly, but deleting a conversation leaves its protected data in mixed checkpoints and archives. The core has no selective record-deletion transition. Requires a new erasure protocol first. |
| Conversation/catalog | Supports cross-turn reuse and whole-conversation deletion without rewriting another conversation's history. Catalog upgrades explicitly separate executable versions. Implemented storage partition. |

Do not create new engines to evade state/history limits. A catalog change is a
real implementation change, not a rollover counter. Existing runs keep their
original engine/artifact. Historical inspection uses retained definitions without
handlers; resuming an old run requires its exact compatible handlers. Missing
handlers are an explicit execution-unavailable condition, not permission to bind
today's implementation or silently retry under a new identity.

Scope must encode the relevant captured access/configuration authority without
credentials. It is an equality key, not proof that access is still authorized.
Dispatch and adoption recheck current ownership and access in the transaction.

## Persisted records and domain ownership

The first three tables below are installed by **56 -> 57**, with the matching
`ai/graph_store/` adapter. `turn_execution_owners` is installed by **57 -> 58**,
with historical backfill and explicit writes in current turn admission. The last
two records are installed by **58 -> 59**, with coach-reply declaration/publication
adapters under `conversations/execution/graph_publication.rs`. These adapters are
verified through the real native commit boundary but are not yet called by the
production coach command. Native checkpoint/record encodings are unchanged.

| Record | Identity and meaning | Required constraints |
| --- | --- | --- |
| `graph_engines` | Engine UUID; conversation owner; catalog identity; current exact stamp and checkpoint BLOB. Checkpoint already retains immutable artifacts. | Unique conversation/catalog; immutable owner; conversation FK with cascade. Decode and verify stamp engine, revision and checksum against bytes. |
| `graph_records` | Engine plus canonical serialized native `RecordKey`; exact `RecordWrite::bytes` BLOB. | Composite primary key; engine FK with cascade; no provider-specific columns or scheduler state. Verify native key, envelope and commitment on reads. |
| `graph_archives` | Engine plus exact archived stamp; original checkpoint bytes. | Immutable insert; identical reinsertion may succeed, conflicting bytes fail. Engine FK with cascade; native chain verification remains mandatory. |
| `graph_transport_identities` | Native engine/producer, artifact and operation contract mapped to wire attempt/operation IDs. | Immutable, unique wire IDs; engine FK with cascade. Stage inside provider Dispatch; no binding for local work. Missing identities fail, recovery preserves IDs, explicit retry binds a new producer. No scheduler state or claim that HTTP was sent. |
| `turn_execution_owners` | One row per turn; executor `legacy` or `graph`; durable channel classification; graph engine/run/artifact when applicable. | Turn FK; graph tuple all present or all absent; graph run unique within engine; owner conversation must agree with engine. No mutable attempt status. |
| `conversation_graph_effects` | Stable domain effect UUID for a turn/node/result role, declared output port, captured scope, language/variety and award source identity. | Unique owner/node/result role; immutable attribution. Turn ownership supplies engine/run/artifact. Format 59 admits the reviewed `coach_reply` role only. Not an execution/attempt ID. |
| `conversation_graph_publications` | Accepted effect, graph attempt/execution identity and resulting message. | One accepted publication per effect; message belongs to the same turn/conversation; append-only adoption provenance. |

The last three records belong to conversation persistence, not the graph core.
They describe ownership and accepted domain facts, not readiness or topology.
Local context-node adoption may have no message or award, but still checks owner
authority. The reply node publishes its validated text and eligible award.

Keep `u64` revisions/attempt/execution IDs lossless: use canonical native encoding
or validated decimal text, not SQLite signed-integer narrowing or JavaScript
numbers. SQL columns useful for lookup are checked indexes over native identity,
not alternate facts. Read BLOB lengths before allocating content, within one
stamp-consistent read transaction. All reads use existing native budgets and
verification; no resident fallback after a damaged stored row.

Do not add a second artifact description for visualization. The retained
checkpoint's native artifact and `InspectionSnapshot`/`LiveInspection` supply it.

## Migration and historical ownership

Migration 57 adds only storage tables inside the existing complete
chain/recovery-copy transaction. It does not instantiate engines, invoke providers,
rewrite old attempts, reaward credit or attach today's graph to old turns.

Migration 58 backfills each existing turn as `legacy`.
It derives its channel only from retained
primary operation evidence (`coach_reply`, `persona_reply`, `persona_opening`).
Preserve missing evidence as unknown. Contradictory primary channel evidence must
produce a migration diagnostic and rollback, not a guessed classification.
Historical graphs without immutable artifacts remain explicitly unavailable.
Keep old rows, IDs, receipts, message text, metadata, settings and award policy
provenance unchanged. Empty graph tables are the correct migration result.

Migration 59 adds empty effect and publication tables. It backfills no publications
or awards and leaves legacy source identities unchanged. The current coach-reply
adapter declares its effect in Begin after its graph turn association, captures
attribution from the turn, and publishes only matching native Adopt values. Its
required authority callback must recheck current access in the same transaction.
Accepted text passes the existing conversation reply validator without altering
the retained native result. Message, provenance, existing exploration-policy award,
conversation/workspace revisions and native adoption commit together. Returned
`AppError` diagnostics must be retained by the future host when bridging a domain
rejection to the core's bounded fault; do not discard them during that conversion.

Attempt and producer identities are canonical decimal text through `u64::MAX`,
without SQLite or JavaScript numeric narrowing. Publication stores the exact native
consumer/producer pair; it does not create an operation or decide graph state.
The stable `graph-effect:<UUID>` source uses the existing exploration policy and
remains unchanged across retries. Cascading source deletion removes effect and
publication content/provenance, while detached lifetime awards remain intact.

Keep existing unfinished legacy work under its recorded executor/recovery rules;
never manufacture graph attempts for it. New converted coach turns use only the
graph executor. Routing by explicit stored ownership is a finite conversion
boundary, not dual scheduling of a turn. Removing the remaining legacy executor
belongs to completion of the workflow inventory.

## Transaction and lifecycle protocol

1. The command coordinator checks the existing action receipt, captures inputs,
   writes the turn/user message, stages workspace revision and receipt, then
   transfers its owned transaction to the adapter. Current legacy admission writes
   its owner row directly. Graph admission will stage its ownership/effects in the
   adapter callback using the exact engine identity from the native commit request.
   The graph engine FK is deferred until commit; both insertion orders reject a
   different conversation owner. No placeholder engine identity is permitted.
2. An existing engine's `Begin` uses the proven one-shot enlistment contract.
   Check expected stamp and current authority, write native records/checkpoint,
   and commit all command effects once. No invocation is exposed by admission.
3. **First engine admission is now supported by `create_with_run`.** It validates
   the ordinary native `Begin` transition and commits once with `expected=None`
   and Begin authority. Its separate first-admission enlistment tests cover the
   previously unproven case. Production commands must use this path, not empty
   `create` followed by `Begin`, which would commit twice. See the
   [atomic admission contract](ai-graph-durability.md#atomic-first-run-admission).
4. Dispatch checks current owner/access and commits before returning invocation.
   Settlement stores source/evidence/outcome even when publication is rejected.
   Adoption commits the graph fact, validated message, publication association,
   learning award and workspace revision together. Failed publication leaves no
   message, award or adopted graph state.
5. Rejected commits roll back. Indeterminate commits invalidate the resident host;
   reload under workspace ownership and resolve receipt/stamp before further work.
   No-op commands use the coordinator's explicit commit; do not assume every
   native apply calls the adapter.
6. Startup validates persisted engine ownership and native history before graph
   recovery. Dispatched work becomes Unknown, never an automatic remote resend.
   Legacy recovery must not update graph-owned turn state through broad SQL.
7. Explicit conversation/contact deletion removes its engines, archives, records,
   publications and captures under the same ownership lock. Evict resident hosts
   and reject late callbacks before delivering further content. Whole-workspace
   reset uses the existing reset owner. Earned awards follow the existing retained
   credit policy; deleting source content does not implicitly reverse credit.

Message edits remove product exchanges and revoke publication ownership. The user
approved retaining superseded graph history; rewriting archives is not required
for persona conversion. Coach history retains its existing ownership.

## Required caller conversions for the coach slice

Paths below are relative to `native/src/`. These findings are source inspection.

| Caller | Dependency to replace and acceptance case |
| --- | --- |
| `conversations/execution/turns.rs` | Implemented: prompt history, partner-exchange context and coach evidence sources use declared channels. Follow-up questions retain graph-owned coach text and its attached guide without putting either in the persona prompt. |
| `conversations/revision.rs` and `message_history.rs` | Implemented: revision eligibility/counts, version-history entry and coach suffix preservation use declared ownership. Graph coach messages, receipts and native storage survive persona revision. Persona admission conversion remains unfinished; graph-owned suffix removal no longer requires physical archive erasure. |
| `conversations/execution/publication.rs` | `refresh_turn` infers state from legacy operations. Graph-owned summaries use native facts and accepted domain results; absence of legacy rows must never imply success. |
| `learning/effort/exploration.rs` | Implemented publication adapter: qualification reads accepted graph effects using the same policy and stable effect source across retries. Legacy qualification and old award sources remain unchanged. |
| `conversations/execution/recovery.rs` | Broad turn pause/recovery SQL must respect executor ownership; graph recovery supplies graph facts. |
| `conversations/execution/snapshots.rs` | Message-channel selection and pagination now use declared ownership. Controls, turn execution status, attempt detail and activity still need native graph projection before production admission; the old turn builder remains a legacy reader. |
| `statistics/mod.rs` | Count new provider executions once, not once per consumer. Combine legacy facts and graph producer evidence without duplicating shared inference results; unknown usage stays unknown. |
| `storage/store/commands/` and `application/scheduler.rs` | Receipt replay, controls, current access, local/provider capacity, host captures and post-commit notifications follow explicit executor ownership. |

Keep old SQL for genuinely legacy records until their workflows are converted.
Do not implement a view that pretends graph attempts are legacy operation rows.

## Finite implementation and verification order

1. Atomic first-engine admission is implemented in the isolated core, with
   rollback/indeterminate acknowledgment tests. Production receipt recovery still
   needs the real coordinator wiring.
2. The additive format-57 storage migration and native SQLite adapter are
   implemented. Their verification is recorded in the delivery checkpoint.
   Turn/channel ownership now has its format-58 migration and command writes.
   Accepted effects/publications now have their format-59 migration, a coach-reply
   transaction adapter and existing-policy credit qualification. Production host
   authority/error delivery and invocation adapters remain unwired.
3. Channel/history/revision consumers are implemented. Add the actual coach host,
   current authority, provider/evidence adapter and native turn-state projection.
   Verify conversation
   deletion, persona revision preserving coach history, retry credit identity,
   follow-up prompt history, usage accounting and no legacy coach operations.
4. Wire native read delivery and the generic viewer; run the actual coach flow and
   rendered-edge acceptance checks from the delivery plan.

Before production admission is enabled, choose finite record/checkpoint/history,
capture and export budgets from representative captured coach requests and retry
histories. Record the fixtures and headroom, test exact bounds, and reject excess
explicitly. Fixture constants from isolated tests are not production defaults.
Capacity exhaustion must not trigger hidden rollover or deletion.

Storage, legacy command ownership writes and graph publication adapters are
implemented; graph command routing and UI behavior remain unconnected.
History, message-channel and revision readers now use ownership. Turn status,
controls, activity, recovery and accounting still need native facts and explicit
executor routing before graph coach admission is enabled.
The [production integration checkpoints](ai-graph-production-integration.md)
separate storage verification from the remaining actual workflow conversion.
