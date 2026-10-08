# Graph durability and authority boundary

Status: isolated foundation implementation contract, 2026-10-08.
Extends [the core semantics](ai-graph-core-semantics.md). Production workspace
migrations and workflow adoption remain outside this checkpoint.

## Ownership and atomicity

The graph owns legal transitions and captured values. The domain owner owns current
source/access authority, publication and its database transaction. A durable host
must commit a graph transition through that owner before exposing its effects.
The persistence interface is a semantic transaction contract, not permission
inferred from an opaque scope string.

Begin exposes captured graph inputs to the owner for comparison with the trusted
source; dispatch exposes the exact recorded work inputs and operation. The adapter
must validate their provenance and current access/configuration as appropriate,
not merely compare two caller-provided strings. The core validates typed bindings;
it cannot certify that a value came from a particular external source record.

Each checkpoint has a UUID engine identity, format version, ordered event revision,
artifact manifest and integrity checksum. Attempt/execution IDs are qualified by
that engine identity outside the process. The manifest retains the exact artifacts;
recovery requires matching implementations, never whichever version is current.
Checksum validation detects corruption; it is not authentication or authorization.

Every storage commit compares the entire previous checkpoint stamp, including its
engine identity, revision and checksum. Initialization requires absence. Within
the same owner transaction, the adapter checks the required current authority,
publishes any adopted output, and replaces the checkpoint. Any known rejection
rolls back all three. An uncertain commit result poisons the in-memory host: it
cannot issue further commands or invocations until storage has been reloaded.

Dispatch names an exact prepared consumer attempt. At least that consumer must
still be authorized under its captured scope; other subscribers retain their own
adoption checks. Durable dispatch intent commits before the single-use invocation
is returned. Authorization linearizes at that commit. Cancellation after it cannot
promise to retract an external effect. Adapters needing another check after an
async credential lookup must perform that check before submitting, and settle
revoked work explicitly; the core cannot make remote services transactional.

Adoption publishes the exact validated Available output together with its graph
transition. The owner checks current source/access authority inside that same
transaction. Publication failure leaves the attempt Available and unpublished.
Replay reconstructs state without invoking handlers or republishing domain data.
Recovery changes are committed before a recovered host becomes usable; an already
recovered state needs no additional event.

## Format and limits

The initial checkpoint uses the existing replay journal plus exact artifact
manifest, serialized under explicit byte/event limits. Unknown versions, corrupt
checksums, missing or changed artifacts, invalid transitions and oversized payloads
are errors. Versioned event and artifact objects also reject unknown fields,
including nested graph definitions; a future field cannot be silently ignored
under the existing format. No events, values or history are dropped to fit a bound.
Limits are resource ceilings, not retention policy. Admission now reserves space
for bounded settlements, consumer adoption and recovery as specified below.
Exhaustion remains explicit backpressure; callers must retain uncommitted outcomes
and surface the failure. Format 2 adds lossless archive compaction as described in
the [retention contract](ai-graph-retention.md). Production use still requires
bounded historical reads, cold-state handling and a workspace migration.

Checkpoint bytes contain source content and must follow workspace content handling.
They are never diagnostic exports. The [inspection protocol](ai-graph-inspection.md)
exports the same topology with explicit sensitive-value omissions. Rich provider
metadata retention remains a separate foundation obligation.

## Settlement admission contract — 2026-10-08

The durable owner declares `DurableLimits`: hard
checkpoint byte/event ceilings, total retained archive ceilings and a maximum
serialized settlement-event size.
This is an admission contract, not an operation's output type or a provider limit.
Provider adapters must eventually establish compatible response/metadata bounds.
No finite reservation can guarantee storage for an unbounded response.

For candidate state `s`, let `J(s)` be its complete serialized checkpoint, `U(s)`
the distinct dispatched executions without outcome or recovery uncertainty, and
`A(s)` the current, uncancelled consumers in Running or Available state. Reserve:

```text
events(s) = |U(s)| + |A(s)| + needsRecovery(s)
bytes(s)  = |U(s)| * (maximumSettlementEventBytes + 1)
            + sum(encodedAdopt(a).bytes + 1 for a in A(s))
            + (encodedRecover.bytes + 1 if needsRecovery(s) else 0)
```

Every commit must leave `J(s).bytes + bytes(s)` and
`journal(s).events + events(s)` within their respective hard ceilings. Arithmetic
overflow rejects admission. Each extra byte accounts conservatively for a JSON
array separator. Both formats have an immutable manifest and fixed-width checksum;
format 2 also freezes its snapshot base between compactions. Appended-event size
is the only checkpoint growth involved in settlement/adoption. Compaction must
recheck all reservations against its replacement snapshot footprint.
Tests must exercise this assumption against actual checkpoint bytes.

Reservations belong to distinct producers and independent consumer adoptions.
Joining a running producer adds an adoption reservation, not another settlement
reservation. Cancelling all consumers does not release the running producer's
settlement reservation. Successful settlement retains adoption reservations;
failed settlement releases them. Available retained results reserve adoption when
a new consumer is admitted. Prepared work has no external effect; dispatch must
reserve before returning an invocation. Ordinary commands cannot consume these
reservations. Storage/authority/commit failures remain possible and are not
covered by the capacity guarantee.

Settlement checks the complete incoming event against its declared bound before
mutation, including malformed successes and structured failures. Oversized
evidence is rejected intact, never truncated, substituted with a generic failure,
or marked settled. The caller must retain the outcome for explicit remediation.
Recovery records uncertain work using the reserved recovery event. Once replay is
already in recovery's fixed point, another recovery does not append an event;
repeated startup must not consume the bounded journal indefinitely. Subsequent
mutations still use the owner transaction's checkpoint compare-and-swap.

This introduces no persisted fields or workspace migration. Reservations are
derived from replayed state. Old checkpoints are decoded unchanged; recovery
under new or smaller limits can refuse before a write if the resulting state and
remaining obligations do not fit. There is no deletion or invented evidence to
force acceptance. Production adoption still needs a reviewed migration policy.

The [retention contract](ai-graph-retention.md) implements archive compaction
separately from reservations. It preserves original checkpoint bytes, source
bindings and outcomes in one transaction with the new snapshot. Absolute revision
does not reset. Recovery audits the full history and compares native state at
every snapshot cut; arbitrary deserialized state is never installed. Future
cold-state handling must distinguish execution caches from immutable accepted
results and provide historical runtime inspection without requiring old handlers.
Inactive runs and on-demand nodes cannot be removed to make admission pass.

## Required evidence

Use real disposable SQLite transactions to verify compare-and-swap rejection,
rollback after tentative domain publication, current authority changes before
dispatch/adoption, independent shared consumers, uncertain post-commit failure,
and recovery without duplicate effects. Also reject corruption, incompatible
artifacts, future versions and resource-limit violations. No production tables or
workspace format versions change to establish this interface.

## Implemented boundary and remaining work

`native/src/ai/graph/checkpoint.rs` owns checkpoint validation and encoding.
`durable.rs` coordinates the existing reducer with the owner's commit transaction.
The actual SQLite implementation is confined to test fixtures; no production
database tables, command handlers or AI workflows call this boundary yet.

Remaining foundation work is explicit:

1. Extend the implemented archive compaction with historical pages, bounded active
   state and production migration contracts that preserve accepted evidence and
   unresolved external work.
2. Integrate the implemented [inspection export](ai-graph-inspection.md) without a
   second visualization catalog or UI interpretation of missing execution records.
3. Provider/stream metadata needs typed sensitivity handling and bounded retained
   provenance on success and failure. Raw internal inspection is still unsuitable
   for diagnostic export.
4. A separate abstract transition model and bounded conformance checks must state
   their assumptions and coverage before claiming the foundation gate complete.

## Initial owner-boundary verification — 2026-10-08

- Final targeted graph suite: **30 passed**, including eight durability tests
  using disposable SQLite files. Tests cover source mismatch, authority changes,
  rollback, stale writers, lost acknowledgments, sharing, restart and limits.
- Final Clippy (`--lib --tests -- -D warnings`) and `npm run check:fast` passed.
- Full native suite: **884 passed, 6 failed, 6 ignored**. The six failures are the
  same paused-workflow activation/metadata/migration failures recorded in the
  [initial core report](ai-graph-core-semantics.md#verification-record--2026-10-08).
  That full run preceded the final unknown-field rejection hardening; the changed
  core's targeted suite passed separately on the final state, including rejection
  of unknown nested event and graph fields.
- Documentation entry-point checks, all 38 local links across the four graph
  notes, and tracked diff whitespace checks passed.
- No production migration, running-app verification, deployment or commit.

## Settlement-admission verification — 2026-10-08

Implemented in `settlement_capacity.rs`, used by every durable commit. No
production callers were added. The checkpoint serialization remains format 1;
the generated inspection contract only adds the `settlement_limit` fault code.

- Final graph suite: **46 passed**. Nine new tests use disposable SQLite owners
  to cover exact event exhaustion, byte exhaustion with maximum-size successes in
  both producer orders, shared and retained consumer admission, cancellation,
  maximum-size failures, oversized evidence, failed commit retry, checked arithmetic,
  dispatch rejection, uncertain recovery, repeated startup and changed byte limits.
- Final fast gate, Clippy (`--lib --tests -- -D warnings`), generated-contract
  verification and application TypeScript/Vite build passed. Vite retains its
  existing bundle-size advisory. IPC registration regressions: **2 passed**.
- Full native library suite: **899 passed, 6 failed, 6 ignored**. It reproduces
  the same six activation/model-metadata/migration-default failures listed in the
  [inspection checkpoint](ai-graph-inspection.md#verification-checkpoint--2026-10-08).
  This full run preceded the final unchanged-recovery byte validation correction;
  the final 46-test graph run, Clippy and fast gate cover that correction. The
  application suite is not green and production integration remains gated.
- The existing one-event admission fixture now provides two events: one Begin
  plus its required recovery reservation. It still rejects subsequent ordinary
  work atomically; this is the stricter admission contract, not a relaxed limit test.
- Documentation entry-point links, 13 local links across the three changed graph
  notes, and tracked whitespace checks passed.

These tests verify the bounded contract and selected interleavings, not a formal
proof or unlimited storage guarantee. Retention/compaction, provider evidence
bounds, abstract-model conformance, production migration and live viewer acceptance
remain open. No history was pruned, no workflow/default policy changed, and no
commit or deployment was performed.
