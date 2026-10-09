# AI graph production integration

Date: 2026-10-08. Status: **shared core, graph storage and declared turn ownership
implemented; accepted publication and production graph workflow conversion remain
unfinished**.
The architecture-first direction is authorized. This note makes the next delivery
milestone concrete; it does not claim that a production workflow has been migrated.
The [foundations](ai-graph-foundations.md) remain the ontology owner. The
[original audit](executable-ai-graphs-audit-and-plan-2026-10-08.md) remains the
whole-application migration and regression inventory.

## Next delivery milestone

One real coach conversation request must run through the native graph, persist its
execution and accepted reply, survive restart, and appear in the generic graph
viewer with its run/attempt timeline. The graph in that viewer must be the artifact
used by execution. A separate demonstration graph or a provider wrapper around the
old scheduler does not satisfy this milestone.

Coach reply is the selected first conversion because its existing topology is
small: `coach_context -> coach_reply`. It exercises actual captured inputs,
provider admission, streaming, publication, diagnostics and learner credit without
requiring the unresolved reading policies to be decided first. This selection does
not alter the domain-independent graph model or waive its completion gates.

## Findings from the current source

| Boundary | Existing owner and integration consequence |
| --- | --- |
| Admission | `conversations/execution/turns.rs` captures prompts, sources, settings, access target and policy, then creates legacy operations. Preserve the command transaction; graph initialization cannot commit independently of accepted user input. |
| Topology | `conversations/turn_plan.rs` declares `COACH_PLAN`; `execution/graph.rs` uses operation kinds and SQL success states to release dependents. Remove that scheduling authority for converted runs. |
| Dispatch | `execution/dispatch.rs` validates captured context and selects provider work from SQL operation states. It checks network capacity before selecting even local context work. New local graph work must use local admission independently. |
| Transport | `application/scheduler.rs` resolves secrets late, checks current access, batches compatible requests, streams and settles siblings independently. Preserve those behaviors through an execution adapter; do not put secrets in persisted graph inputs. |
| Streams | `application/streams.rs` keys previews by legacy attempt ID and workspace generation. Terminal updates follow `finish_retaining`; snapshot revision does not advance per token. These identities and ordering need an explicit graph contract. |
| Publication | `execution/publication.rs` retains original response/preview and provider metadata, cleans and validates prose, checks ownership, then inserts the assistant message in its transaction. Computation success and owner adoption must remain distinct. |
| Credit | `learning/effort/exploration.rs::conversation` includes `coach_reply`. Its stable operation ID prevents duplicate exploration awards across retries. Coach conversion therefore includes credit preservation, not just message insertion. |
| Viewer | `ActivityGraph.tsx` consumes `TurnView.operations`; `DefinitionGraph` consumes another catalog. `AiView.tsx` selects these as different modes. Replace the converted workflow's inputs with the native artifact and overlays; changing labels alone cannot fix this. |

Paths above are relative to `native/src/` except viewer files, which live under
`ui/src/features/activity/`. Findings are source inspection, not running-app tests.
The current workspace schema is **58**, as declared in
`native/src/storage/store/schema.rs`. Earlier format-54 audit context is historical;
the next migration must use the actual current consecutive version at implementation.

## Shared contracts required before conversion

These are concrete outstanding foundation obligations, not coach-specific types.

1. **Execution evidence independent of output values.** Native invocation now returns
   a bounded evidence report separately from `Result<Values>` and persists it with
   the producer record. Complete the production adapter for this durable execution
   evidence carrying invocation identity, requested/actual models, usage and billing
   provenance, timing, provider IDs, finish/error reasons and validation details.
   Retain useful partial evidence when transport, decoding, validation or adoption
   fails. Unknown fields require explicit sensitivity handling and omission markers.
   Never encode this metadata in an exception string or a success-only output port.
2. **Invocation identity and host capabilities.** Bind the handler to its producing
   execution, with explicit access to a bounded evidence/provisional-output sink.
   The adapter receives declared inputs and current authorized transport capabilities;
   it must not discover its owner through a global operation-kind lookup. Secret
   resolution remains outside serializable inputs, artifacts and diagnostics.
3. **Snapshot/stream ordering.** Follow the
   [native read and capture-watermark design](ai-graph-inspection.md#stream-ordering-production-implementation-design).
   Identify streams by host session, engine and producing execution, with monotonic
   sequence and existing native consumer links.
   Provisional text cannot satisfy graph ports or mark adoption successful. Publish
   terminal facts only after durable settlement; publication/adoption status remains
   separately visible. Stale, duplicate and reordered deliveries cannot replace a
   newer snapshot or revive a cancelled consumer. Reconnect and missing-final-update
   behavior is specified there and must be verified before wiring the UI.
4. **Owner transaction enlistment.** The command coordinator owns admission's commit;
   settlement/adoption own their applicable store transactions. Define how a graph
   candidate becomes authoritative only after the enclosing transaction succeeds.
   `CommitStore`'s successful return currently means committed, so an adapter must
   not return success for an uncommitted borrowed transaction and expose an invocation.
   Rejected and indeterminate acknowledgements retain their distinct semantics.
   The [owned-transaction enlistment contract](ai-graph-durability.md#enlisting-an-existing-command-transaction)
   now identifies how to reuse this boundary for single-run admission, without
   adding another graph transaction state machine.

Implement and verify these contracts with domain-independent cases first. Add them
to their existing semantic/durability/inspection owners rather than treating this
integration note as a competing specification. Provider names and coach behavior
must not enter `ai/graph/`.

## Proposed owner and persistence boundary

The workspace remains the owner of the database and serialized mutation. Graph
records own execution facts; conversations own accepted messages, source authority
and turn history; learning owns credit policy. A conversation adapter supplies
current authority and publishes validated values within the same transaction as
graph adoption. It does not independently decide readiness or release dependents.

Persist immutable artifact evidence, native checkpoints/archives/records and explicit
domain-owner/result associations. Exact schema, keys, runtime partition and finite
production budgets require a migration design before SQL changes. In particular,
choose the runtime partition deliberately: a turn-local engine cannot implement
cross-turn sharing merely by giving two executions equal keys. Do not silently
commit to that limitation through the first workflow's table design.

The [workspace integration design](ai-graph-workspace-integration.md) now gives
the source-audited design: conversation/catalog partitions, explicit turn/channel
ownership, stable accepted effects, additive historical migration and caller
conversion requirements. Partitioned storage is installed in format 57 and turn
ownership in format 58; accepted-effect/publication records remain proposed. The audit also identified
atomic first-engine admission as a prerequisite not covered by the existing
already-created-engine enlistment fixture. That prerequisite is now implemented
and tested separately; production wiring remains outstanding.

The migration proposal must account for:

- Complete supported format history, recovery-copy protocol, rollback, repeated
  startup and equivalence with a fresh workspace.
- Retained historical operations, attempts, messages, evidence, metadata and earned
  credit. Old runs without an immutable artifact remain explicitly legacy/unknown;
  do not attach today's definition to them as historical fact.
- Existing unfinished work: retain known results and authority; record interrupted
  dispatched outcomes as uncertain, without automatically reissuing remote work.
  This is durable-data recovery, not a deployment-overlap compatibility project.
- Stable domain award identity across old/new execution ownership, retries and
  recovery. Do not mint new credit just because the new graph has a new attempt ID.
- Current access/source checks at dispatch and adoption, serialization with reset,
  and the distinction between retained diagnostics and protected content inspection.

Existing operation rows may remain as historical records. For converted new runs,
do not dual-write a second executable operation model just to satisfy old UI or
learning queries. Refactor those consumers to explicit owner/result associations.

## Finite implementation sequence and evidence

| Step | Deliverable | Exit evidence |
| --- | --- | --- |
| 1. Shared execution boundary | Evidence, invocation/stream and enclosing-transaction contracts above, implemented in their shared owners. | Success, failure, partial metadata, cancellation, late results, restart and commit ambiguity retain the correct facts; no early invocation or adoption. |
| 2. Workspace integration | Reviewed migration plus production native record adapter and owner associations. | All supported migration starts, atomic rollback, exact artifact recovery, historical preservation and fresh-database equivalence. |
| 3. Coach conversion | Actual command, typed graph, provider adapter, reply validator and atomic message/credit adoption. | Local work proceeds with provider capacity zero; one authorized provider execution; cancelled/stale results retained but not adopted; explicit retry; one message/credit; restart never blindly resends. |
| 4. Thin viewer | One native artifact projection with optional run/attempt overlay and generated contracts. | Exact node/edge/port identities across not-started, running, failed, cancelled and recovered states; selecting runs changes overlays within an artifact version. |
| 5. Running acceptance | Real coach user flow, persistence/restart and rendered graph inspection. | Reply visible in the conversation; evidence inspectable; edges actually rendered after resize, dock/pop-out and phone layout; inspection itself starts no work. |

A fake-provider integration test is required for deterministic failure/recovery
coverage. It does not substitute for running-app inspection or justify a claim
that the original missing-edge symptom is fixed. Live-provider verification, if
performed, must be reported separately from local fixtures.

The coach slice cannot prove on-demand child activation or independent sibling
completion by itself. Those remain shared-core obligations and mandatory tests in
the next branching conversation/assistance conversion. Subsequent inventory covers
reply/opening, learning/coaching helpers, reading, speech, transcription and
proposal workflows from the original audit; finish each converted workflow's old-
path removal rather than leaving permanent parallel schedulers.

## Scope control and present verification

### Turn execution ownership checkpoint

Format **57 -> 58** adds one immutable executor/channel association per retained
turn. Historical primary operations identify coach, persona reply or opening;
missing evidence stays unknown and conflicting channels reject the migration.
No historical engine, artifact, attempt or award is synthesized. The sole current
turn-admission path now writes its declared legacy owner/channel with the command.
Startup validates completeness before ordinary recovery. Existing direct-record
test fixtures now declare their intended ownership; historical downgrade fixtures
remove the new table and its parent-table trigger before declaring an older format.

Graph associations require engine/run/artifact together and a known channel. The
engine FK is deferred for first admission, while both insertion orders reject a
different conversation. Owner fields and an owned turn's conversation cannot be
changed. The SQL adapter callback now receives the borrowed native `CommitRequest`,
including the exact new engine UUID, rather than only its intent. The integration
fixture stages the actual association before the engine insert and proves both
commit and rollback with the domain turn.

Focused tests cover first-engine ordering, absent/cross-owner engines, immutable
ownership, malformed executor tuples, retained unknowns, ambiguous history,
rollback and real coach admission. The final focused ownership, SQL adapter and
migration selection passed **10 tests**. An earlier expanded selection, including
coach command admission, passed **17 tests** before the additional conversation
immutability constraint. Clippy (`--lib --tests -- -D warnings`), native binary
checks, generated-contract verification and the final fast gate passed.
Documentation entry-point links and 21
local links across the three updated notes passed; frozen migration SQL matches
the current ownership schema. Tracked whitespace and the nine new ownership/adapter
files passed whitespace checks.

The full native suite finished with **1,025 passed, 6 failed, 6 ignored** (1,037
total, 459.85 seconds). All ownership, graph-storage and supported-version migration
tests passed. The failures remain the five existing reading-activation cases and
the baseline migration reading-default mismatch recorded at earlier checkpoints.
The overall suite is still non-green; no product policy or assertions were changed
to hide those failures. No live provider or running-app verification is claimed.
Changes remain uncommitted; unrelated microphone work was preserved. No commit,
push or deployment was performed.

This is declared ownership, not the coach workflow conversion. Prompt history,
revision preservation, status and activity still use existing legacy queries;
their conversion must accompany graph admission. Next is stable accepted-effect
and publication ownership/credit, followed by those caller conversions and actual
coach execution. No new UI is ready to inspect and no release version was changed.

### Workspace graph storage checkpoint

Format **56 -> 57** adds `graph_engines`, `graph_records` and `graph_archives`.
Fresh startup and the complete migration chain install the same schema. The
migration creates no engines and changes no historical domain records or awards.
Its frozen SQL is separate from the current-schema source. The historical
format-56 test now uses its exact registry prefix, preserving its original target.

`ai/graph_store/` implements the native `CommitStore`, `RecordStore` and
`HistoryStore` interfaces outside the database-independent graph core. Engines are
partitioned by conversation and exact sorted artifact catalog. Engine/record
ownership and archives cannot be updated; conversation deletion cascades through
that conversation's native storage. There is no alternate operation catalog or
executable status table.

The write adapter consumes the real owner transaction. It verifies the expected
stamp and catalog, invokes the required owner authority/publication callback,
writes native bytes and commits once. Staging errors explicitly roll back;
unconfirmed rollback/commit returns Indeterminate. Foreign keys must be enabled.
Read adapters hold one SQLite transaction, bound bytes before allocation, check
engine/stamp/partition identity, and leave record commitments and historical replay
to the existing native verification. SQLite failures retain numeric primary and
extended codes and a static stage, without raw source values or SQL error prose.

Four adapter tests cover a real local invocation through settlement, adoption,
compaction, eviction and recovery; atomic rollback; stale/wrong-partition reads;
bounded reads; corrupt records; catalog/authority checks; immutable archives;
conversation deletion isolation; and safe SQLite error details. Migration tests
cover all supported starts, rollback, unchanged retained source/uncertainty/award
rows, fresh-schema equivalence and repeated startup with one recovery copy.

Verification:

- Final focused run: **166 passed** (159 graph-core tests, four SQL-adapter tests
  and three corrected historical-fixture regressions).
- Full native run: **1016 passed, 9 failed, 6 ignored** (506.59 seconds).
  Both new migration tests passed, including every supported starting format.
  Three failures were artificial format-45 fixtures retaining format-57 tables;
  those fixtures now remove the newer graph tables before declaring the older
  format, and all three pass in the final focused run. The remaining six failures
  are the five known activation failures and baseline reading-default mismatch.
  The whole suite was not rerun after these fixture-only corrections; it remains
  non-green because of those six known failures.
- Final Clippy (`--lib --tests -- -D warnings`) and fast gate passed. Native
  binaries and generated contracts passed with the final production code;
  fixture corrections did not alter it or generated output.
- Documentation entry-point links, 24 local note links, tracked/new-file whitespace
  and exact fresh/migration SQL equality passed. Changes remain uncommitted and
  unrelated microphone work was preserved.

This is the storage half of step 2. The next checkpoint adds turn/channel ownership,
stable domain effects and accepted-result associations in a consecutive migration
with command writes/backfill. No real workflow writes graph engines yet. The
coach conversion must still replace the history/revision/status/credit consumers
listed in the workspace design; installing tables alone does not satisfy that
milestone. No provider, UI, release version or deployment change is included.

### Atomic first-admission implementation checkpoint

`DurableEngine::create_with_run` now commits the initial engine and ordinary Begin
event with one owner transaction, using the existing Begin authority contract.
There is no intermediate committed empty engine, no invocation at admission and
no new persisted format. Initialization shares the existing create path; the
cohesive durable transaction owner remains above the file-size guideline rather
than splitting this small addition into a competing lifecycle owner.

Five new SQLite tests cover one-shot commit visibility, validation/state/event
budgets, changed source/authority, partial-record rollback, lost acknowledgment,
conflicting create and the exact recovery-byte reservation. Production command
receipt replay remains to be wired; the fixture verifies the core/adapter contract.

Verification: **159 graph tests passed**. Clippy (`--lib --tests -- -D warnings`),
native binary checks, the fast gate, generated-contract verification, documentation
entry-point links, 26 local note links and tracked/new-file whitespace checks
passed. Full native suite: **1013 passed, 6 failed, 6 ignored** (483.77 seconds).
The same five activation failures and baseline-migration reading-default failure
remain; no new failures appeared, and the complete suite is not green.
The initial test run caught two
fixture expectations (the existing authority error name and recovery's deliberate
pause); both were corrected to assert the existing contract. No UI source or
generated contract changed at this checkpoint. Changes remain uncommitted; unrelated
microphone changes were preserved.

Next deliverable is the consecutive workspace migration and production native
record adapter from the [workspace design](ai-graph-workspace-integration.md).

### Production ownership and migration design checkpoint

Audited the actual command, startup, revision, history, publication, credit and
statistics callers against the shared runtime. The
[concrete design](ai-graph-workspace-integration.md) records proposed keys,
constraints, transaction order, migration preservation and a finite implementation
sequence. No code or persisted format changed at this checkpoint.

Two hidden legacy dependencies are now explicit conversion gates: coach follow-up
history and preservation of coach turns during persona revision both use legacy
operation rows to identify the channel. Merely routing new coach work to the graph
would break those behaviors. Channel ownership must land with the conversion.

Deletion ownership also constrains the proposed partition: whole-conversation
deletion can remove a conversation-owned engine, while selective turn deletion
cannot erase source from the present immutable archive chain. The latter remains
a prerequisite for subsequent persona workflow conversion, not a reason to invent
a deletion mechanism in the viewer or silently retain deleted source.

Next implementation: atomic first-engine/first-run admission, then the migration
and production record adapter. The already-proven one-transition enlisted commit
does not cover `create` followed by `Begin`, which currently commits twice.
This is a concrete integration prerequisite, not a new general transaction model.

Verification: documentation entry-point links and local links in the new design
and integration note passed; whitespace checks passed. Runtime checks were not
rerun for this documentation-only checkpoint. The last source checkpoint below
remains the runtime verification baseline, including its six known native failures.

### Native materialized live-read checkpoint

Implemented the protected native join of the existing graph projection, current
attempt ownership, retained capture and an explicitly supplied native capture batch.
Native facts determine preview eligibility and handoff. The generated wrapper
contains source text by design; the public graph-only export is unchanged. No
frontend graph semantics, production command or stream event was added.

Tests cover exact topology/state parity, no read side effects, corrected/stale
captures, shared-consumer cancellation, settlement/adoption, pause/restart,
poisoned hosts, retry identity, metadata disclosure, verified cold reads and exact
input/output limits. The asynchronous handler fixture also reads live text before
settlement and the retained correction afterward.

Next delivery work is the concrete production workspace migration/owner-adapter
design and coach integration, including host capture collection and serialized
read delivery. Subscription sessions, invalidation/reconnect behavior and actual
rendered edges still require production wiring and tests. The live-read contract
is documented in the [inspection owner](ai-graph-inspection.md#implemented-protected-materialized-read).
Do not add another isolated stream scheduler or frontend state interpretation.

`durable.rs` keeps only the entry-point/verified-reader setup for this operation;
the join and wire mapping live in `live_read.rs`. Its existing transaction
coordinator responsibility remains intact despite exceeding the 500-line guideline.

Verification for this checkpoint:

- Graph suite: **154 passed**, including seven new materialized-read cases and the
  extended asynchronous handler test. The initial corruption fixture wrote a SQL
  TEXT value; it now writes a damaged BLOB to test record integrity as intended.
- Clippy (`--lib --tests -- -D warnings`), native binary checks, final fast gate,
  generated contracts/check, UI TypeScript/Vite build and IPC tests (**2 passed**)
  passed. An initial slice serialization borrow error was corrected before these
  final verification runs.
- Full native suite: **1008 passed, 6 failed, 6 ignored** (485.67 seconds).
  The same five activation failures and baseline-migration reading-default failure
  remain; the complete suite is not green. No new failure appeared in this run.
- Documentation entry-point links, 39 local links across four updated graph notes
  and tracked/new-file whitespace checks passed.
- No production schema, command registration, provider path or UI behavior changed.
  This is an isolated source checkpoint, not a running app. Changes remain
  uncommitted and unrelated microphone work was preserved.

### Provisional capture and durable handoff checkpoint

Implemented in the isolated native runtime: bounded cumulative provisional text,
checked sequence numbers, corrected replacements, callback closure, explicit latched
capture failures and atomic retention with observations/final outcome. The same
execution record supplies protected reads and historical replay. Checkpoint format
6 and execution-row format 3 explicitly version the extension; older metadata-only
records retain their original encodings. Production workspace format 56 is unchanged.

The asynchronous fixture checkpoints text while its handler is suspended, then
accepts a corrected final capture whose text is not a prefix extension. Other tests
exercise stale/conflicting watermarks, unchanged watermark after rollback, cancelled
shared consumers, unknown recovery, acknowledgement loss, byte/sequence limits,
version downgrade rejection and exclusion from public inspection. These are native
fixtures, not an actual provider stream or running viewer.

Next: native materialized reads joining committed consumer facts with provisional
capture, followed by the production migration/owner adapter and coach conversion.
UI refresh/session handling will use those reads; no frontend readiness inference
or second topology catalog is authorized by this work.

Verification for this checkpoint:

- Final graph suite: **147 passed**. Nine new tests cover capture, watermark
  persistence and exact reservation bounds; existing live-handler and old-format
  continuation tests also exercise provisional content. The future-version rejection
  test now uses 7 because 6 is implemented; its rejection requirement is unchanged.
- Clippy (`--lib --tests -- -D warnings`), native binary checks, final fast gate,
  generated contracts/check, UI TypeScript/Vite build and IPC regressions (**2 passed**)
  passed. A missing optional-field initializer and a Clippy conditional finding
  were corrected before these final passes.
- Full native suite: **1,001 passed, 6 failed, 6 ignored** (1,013 total, 490.86
  seconds). The same five reading-activation failures and baseline migration-default
  mismatch remain. The full suite is not green; no policy or assertions were weakened.
- Documentation entry-point links, 58 local links across seven graph notes and
  tracked/new-file whitespace checks passed. Public generated contracts add only
  the three capture fault codes; protected capture content is not exported.
- Changes remain uncommitted. Unrelated microphone changes were preserved. No
  production workspace migration, application release/version change, live provider
  call or running-app/renderer verification is claimed.

### Stream design and transaction enlistment checkpoint

Source review pinned down the current frontend text-prefix handoff heuristic and
the actual command receipt/commit boundary. The stream design now specifies native
materialized reads, notification-only invalidation, producer capture watermarks,
separate consumer authority and committed settlement/adoption. It is a documented
implementation design, not a working stream API or renderer fix.

The command transaction gap does not require expanding the core ontology. A
one-shot owner adapter can consume the coordinator's open SQLite transaction at
its final commit point. A new fixture exercises that contract using the existing
native transition machine and shared SQLite transaction writer. Production command
code and workspace format 56 remain unchanged.

Next implementation: bounded provisional-content capture and its versioned durable
watermark, then native materialized stream reads. Use the transaction contract above
for production admission when the migration/owner adapter is introduced. Do not
create a second frontend interpretation of graph state or a parallel scheduler.

Verification for this checkpoint:

- Graph suite: **138 passed**, including four new enclosing-transaction tests.
- Clippy (`--lib --tests -- -D warnings`), native binary checks, the final fast
  gate and generated-contract checks passed. No generated/UI source changed in
  this pass; the preceding UI build remains historical evidence, not a new run.
- Full native suite: **992 passed, 6 failed, 6 ignored** (1,004 total, 284.53 seconds).
  The same five reading-activation failures and baseline migration-default mismatch
  remain. The full suite is not green. No assertions or product policies changed.
- Documentation entry-point checks, 21 local links across the three updated graph
  notes and whitespace checks passed. The new test fixture's initial SQL count
  decoding compile error was corrected before the passing verification runs.
- This pass changes test fixtures and design documentation, not production runtime
  behavior. No running-app, live-provider or rendered-edge verification is claimed.
  Changes remain uncommitted; unrelated microphone work was preserved.

### Durable evidence checkpoint

Implemented in the shared core and disposable SQLite owner: cumulative observation
commits, complete-report settlement and protected evidence reads from the same native
execution record. Checkpoint format 5 and execution-row format 2 explicitly extend
the previous encodings. Every older base representation can continue; production
workspace format 56 and its migration chain remain unchanged.

Reports are bound to the claimed engine, producer, artifact and operation. Partial
prefixes cannot be rewritten or erased by finalization; interrupted work retains
acknowledged evidence without becoming successful or dispatchable. Final evidence,
validated outcome and consumer state commit atomically. Evidence survives failed
adoption, compaction, eviction and handler-free historical replay. Dispatch reserves
the enclosing format-upgrade bytes before external work is exposed.

The asynchronous fixture actually pauses a handler between observations, commits its
prefix, then releases it and commits its final report. Fault fixtures cover rollback,
partial record writes, acknowledgement loss, conflicting/foreign reports and size
limits. These are native integration tests, not a running product demonstration.

Next: reviewed production metadata adapters, stream/snapshot ordering and enclosing
command-transaction enlistment. A snapshot is only durable after its host commit;
there is no automatic database writer hidden inside `InvocationContext::observe`.
Production SQL, coach routing and the activity viewer are still not converted.
There is no new app surface requiring user inspection yet.

`durable.rs` remains a cohesive 532-line owner-transaction coordinator, including
the small protected-read entry point. Evidence data and transition rules live in
`execution_evidence.rs`; capture lives in `invocation.rs`. No unrelated large-file
reorganization was included.

Verification on this checkpoint:

- Graph suite: **134 passed**, including eleven new persistence/integration tests.
  The unknown-future-format test now uses version 6 because version 5 is implemented;
  its rejection requirement is unchanged.
- Clippy (`--lib --tests -- -D warnings`), native binary checks, final fast gate,
  generated contracts/check, UI TypeScript/Vite build and IPC tests (**2 passed**)
  passed. A Clippy nested-condition finding was corrected before final verification.
- Full native suite: **988 passed, 6 failed, 6 ignored** (1,000 total, 334.65 seconds).
  These are the same five reading-activation failures and baseline migration-default
  mismatch recorded at the preceding checkpoint. No product policy or assertions
  were weakened to hide those failures; the overall suite remains non-green.
- Documentation entry-point links passed; 52 local links across seven graph notes
  were checked separately. Tracked whitespace checks and new-file whitespace checks
  passed. No live provider or running-app/viewer verification is claimed.
- Changes remain uncommitted. Unrelated microphone changes were preserved. There
  was no production migration, release/version change, commit, push or deployment.

### Invocation capture checkpoint (preceding)

The user authorized proceeding with this plan. The first code checkpoint implements
the [shared invocation capture contract](ai-graph-core-semantics.md#invocation-identity-and-evidence-capture):
actual producer identity, typed response observations, explicit count/byte budgets,
evidence preservation through handler/output-validation failure, and closed callbacks
after completion or future cancellation. Synthetic execution callers now explicitly
extract output outcome from the report. Production callers have not been converted.

This is part of step 1, not its exit. Next implement versioned durable report
settlement and partial-evidence recovery, then the stream ordering and enclosing-owner
transaction contracts. No SQL, stored graph format, provider call or UI flow changes
in this invocation checkpoint.

Verification on this checkpoint:

- Native graph suite: **123 passed**, including six new invocation tests for partial
  evidence, output/handler failures, exact and insufficient budgets, original-error
  preservation, shared-consumer cancellation and callback closure on future drop.
- Clippy (`--lib --tests -- -D warnings`), native binary checks, final fast gate,
  generated contracts/check, UI TypeScript/Vite build and IPC regressions (**2 passed**)
  passed. The final UI build followed contract generation. The first IPC invocation
  was rejected by npm argument parsing under PowerShell; the cmd invocation passed.
- Full native suite: **977 passed, 6 failed, 6 ignored** (989 total, 379.65 seconds).
  The same pre-existing activation/default failures remain: defaults scheduling,
  late assessment, late helper access/model binding, opening help retry, reading
  before reply, and baseline migration reading defaults. No assertions or product
  policies were weakened. This is not a clean full-suite result.
- Documentation entry-point links passed; an additional check validated 14 local
  links across the three changed notes. Tracked whitespace checks passed; new files
  were separately checked for whitespace/conflict markers.
- No running-app, live-provider, durable-evidence or viewer verification is claimed.
  Changes remain uncommitted; unrelated microphone work was preserved.

### Prior planning-pass verification

The next code checkpoint is step 1's production-required execution boundary. Further
storage optimizations, disk-backed indexes or broader model exploration must identify
a correctness/capacity blocker for this delivery before displacing it. Existing
limits and model-proof limitations remain documented; this is not a claim that they
are solved or safe to ignore.

This pass changed documentation only. It did not change provider behavior, schema,
runtime or UI, and did not run the application. Previous core test results remain
historical evidence of their tested tree; shared-checkout changes require new
verification before code handoff. `npm run docs:links` passed for nine current
entry points; an additional check validated 44 local links across this note,
the foundations and original audit. Tracked whitespace checks passed, and the
new note was separately checked for trailing whitespace. No application test or
running-app result is claimed for this documentation pass.
