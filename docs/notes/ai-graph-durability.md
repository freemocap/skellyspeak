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
Recovery itself is committed before a recovered host becomes usable.

## Format and limits

The initial checkpoint uses the existing replay journal plus exact artifact
manifest, serialized under explicit byte/event limits. Unknown versions, corrupt
checksums, missing or changed artifacts, invalid transitions and oversized payloads
are errors. Versioned event and artifact objects also reject unknown fields,
including nested graph definitions; a future field cannot be silently ignored
under the existing format. No events, values or history are dropped to fit a bound.
Limits are resource ceilings, not retention policy. Exhaustion is explicit
backpressure, like a full database; callers must retain uncommitted outcomes and
surface the failure. Production use requires reserved settlement capacity and
reviewed compaction/retention before this bounded journal can serve long-lived
workflows. This checkpoint does not claim those policies are implemented.

Checkpoint bytes contain source content and must follow workspace content handling.
They are never diagnostic exports. A separate content-safe projection remains a
foundation obligation; it must preserve topology and useful non-content metadata.

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

1. Settlement capacity, retention/compaction and migration contracts must preserve
   accepted evidence and unresolved external work under bounded storage.
2. Safe inspection export must derive directly from the executable artifact and
   authoritative native state, with generated contracts. Redaction may change
   sensitive value disclosure, never topology or node/attempt identity. No second
   visualization catalog or UI interpretation of missing execution records.
3. Provider/stream metadata needs typed sensitivity handling and bounded retained
   provenance on success and failure. Raw internal inspection is still unsuitable
   for diagnostic export.
4. A separate abstract transition model and bounded conformance checks must state
   their assumptions and coverage before claiming the foundation gate complete.

## Verification — 2026-10-08

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
