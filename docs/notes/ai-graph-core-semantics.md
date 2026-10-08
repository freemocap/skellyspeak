# Executable graph core: initial semantic profile

Status: implementation specification for the isolated native core, 2026-10-08.
The user authorized proceeding with the architecture-first plan. This refines
[the foundations](ai-graph-foundations.md); it does not claim production workflow
migration or full formal verification. No workspace schema changes belong here.

Continuation: [durability and authority](ai-graph-durability.md) now specifies and
implements a transactional host around this same reducer, with SQLite fixture
evidence. The production owner adapter and workspace migration are still absent.

## Scope and representation

The core owns finite, acyclic typed graph validation, implementation binding,
composition, deterministic state transitions and direct inspection. It imports no
product workflow, Tauri command, provider transport or database. Domain adapters
must establish source/access authority and commit adoption with their domain
transaction. `DurableEngine` supplies a commit interface for these checks and only
returns an invocation after dispatch intent commits. The core cannot verify an
external permission by inspecting a string; the adapter must inspect trusted
current source/access state and the supplied inputs/work.

Contract identity is `(name, positive version)`. Registration is unique. The initial
closed type algebra is boolean, signed integer, text, list and exact-field record;
contracts with equal shapes but different identities are incompatible. Optional
ports use explicit absence rather than JSON null. Every declared input is bound,
including optional ones. Unknown input/output fields are errors. Semantic source
refinements belong in declared validation operations until refinement contracts
are specified; plain text is not evidence of source ownership.

Operation registrations bind metadata and the actual async handler together.
Compilation resolves and freezes those registrations, validates boundary/data/
control/guard bindings and computes an artifact identity over the resolved graph,
operation definitions, implementation version IDs and type shapes. The identity
does not hash machine code; changing implementation semantics requires a new
implementation identity. It is not safe to reuse IDs for changed implementations.

Composition accepts a compiled child and captures its source, artifact identity
and caller bindings. Parent compilation recompiles and verifies that child, then
expands its namespaced nodes and validates all boundary bindings. Boundary metadata
cannot independently assert a different expansion. Nesting is limited to 16 and
each expanded graph to 1,024 nodes in this initial profile.
Guards are required boolean sources. A guarded/disabled producer has potentially
absent outputs; a required consumer must use an explicit branch/merge operation
instead. Control prerequisites require adoption, so a skipped parent blocks a
control successor. An optional data input can instead accept a skipped parent's
absence. On-demand parents remain waiting until requested, not absent.

## State and transitions

Every run retains all graph nodes, bound inputs, an immutable authority/configuration
scope supplied by its adapter, demand, cancellation, pause and append-only attempts.
Effective activation policy is captured per run: Begin validates supplied node
keys and fills unspecified choices from the artifact defaults. Inspect exposes
all effective choices directly. Automatic/on-demand/disabled settings do not
change the artifact or topology. Disabling an otherwise required producer blocks
its required consumers; it does not fabricate a value or mark them successful.

An engine can host several artifacts and runs. IDs are monotonic within one engine
journal; persistence integration must namespace the engine identity before using
them globally. Operation implementation IDs, type contracts, exact input values and
authority/configuration scope define exact reuse. No equivalence is inferred from
display labels. Fresh operations and explicit retries do not join prior executions.

Each command is transactional in memory: validate/apply to a candidate state, then
commit state and journal together. Rejection changes neither identities nor state.
Journal entries are ordered source-containing checkpoint data, not diagnostics.

| Command/event | Preconditions | Atomic effect | External/recovery implication |
| --- | --- | --- | --- |
| Begin | New run ID, known artifact, valid graph inputs and scope | Create run; all nodes remain visible | No work dispatched |
| Demand | Active run, on-demand node | Record idempotent demand | Never retries or creates parent work |
| Pause | Known run | Change scheduling pause | Does not erase already submitted outcomes |
| Advance | Explicit local/provider capacity | Admit ready nodes; append attempts; join/reuse or prepare producer | Returns eligible prepared work descriptors; no handler called by reducer |
| Dispatch / claim | Prepared producer, active unpaused consumer, current capacity | Mark producer and subscribing attempts Running | Claim returns a single-use invocation with recorded inputs; edited descriptors cannot alter them |
| Settle | Dispatched unsettled execution, not recovered unknown | Validate result ports; settle producer and eligible pending attempts | Invalid output becomes a recorded validation failure; cancelled consumers stay cancelled |
| Adopt | Active owner/node, exact current Available attempt | Mark attempt Adopted | Adapter must commit this with domain publication; only then do data/control successors advance |
| Cancel node/run | Known identity | Revoke affected consumer adoption; preserve prior accepted work | Other consumers and dispatched producer settlement survive |
| Retry | Active node whose last attempt failed/is unknown | Record fresh retry demand | Advance still enforces pause, inputs and capacity; new attempt preserves old outcome |
| Recover | Explicit startup reconciliation | Pause runs; dispatched unsettled work becomes Unknown; prepared work fails as interrupted before dispatch | No automatic replay of uncertain external effects |

Attempt lifecycle: Prepared -> Running -> Available -> Adopted;
Running -> Failed/Unknown; Prepared -> Failed during recovery;
Prepared/Running/Available -> Cancelled. Terminal attempts never become running again.
Retries append new identities. A cached result creates an Available consumer
attempt without a new producer. Each attempt records Produced, Subscribed or
Retained acquisition. Node disposition also represents Disabled,
Unrequested, Skipped, Waiting, Blocked, Ready, Paused and admission Held without
fabricating attempts. Held describes the last admission pass; readiness is separate.
Unknown identifiers are errors, not an Unknown execution outcome.

`available` returns the exact validated output for the current Available attempt,
before adoption; it rejects stale or revoked consumers. Cancellation before claim
retires an abandoned prepared producer; cancellation after claim cannot retract an
external effect. Dropping a claimed invocation leaves uncertain work for explicit
settlement/recovery. A claim is single-use within one engine history, not an
exactly-once guarantee across cloned engines, process crashes or external services.
Durable dispatch intent must precede external submission when integrated.

Advance checks reuse before capacity: pending subscribers and retained results
need no extra provider permit. Local and provider limits are independent. The
reducer uses stable iteration order but does not claim starvation freedom under
unbounded external commands. Fairness is an integration requirement. Settle does
not wait for sibling results. Failed/unknown/cancelled dependencies block consumers;
none are interpreted as optional absence.

Graph output readiness is separate from all-node completion: dormant on-demand
nodes may remain indefinitely, so the core exposes outputs and per-node state
rather than calling every quiescent run Succeeded. A later product run-summary
policy must preserve that distinction. Raw/provisional streams and provider retry
subattempts are not modeled as completed data ports in this first profile.

## Recovery and inspection

Checkpoint replay requires the original executable artifacts/implementation IDs.
It validates commands and outcomes through the same transition function, discards
returned work descriptors, and never invokes handlers. Recovery distinguishes
prepared from dispatched work and pauses scheduling. This validates reducer recovery; it does
not implement workspace migrations or retention. The durable host adds versioned,
size-limited checkpoint encoding and a transaction contract; the owner implements
process I/O. Limits reject writes explicitly rather than dropping history.

Inspection borrows the exact artifact held by execution. It exports native node
dispositions, dependency/admission reasons, activation policy, acquisition modes,
attempt/execution links and logical revision. It omits run inputs/results, but is
**not content-safe for diagnostics**: artifact constants and arbitrary adapter
failure fields can contain source data. IPC integration must define sensitivity,
bounded typed failure metadata and explicit redaction before exporting this data.
Preserve useful non-content provider metadata rather than replacing failures with
generic categories. This core API is not a diagnostics endpoint. There is no
parallel inspector registry.

## Verification and remaining integration contracts

Test definition rejection, composition boundary preservation, same-operation
instances, automatic/demand/guard behavior, fan-out/fan-in, validation failure,
retry admission, sharing across runs/artifacts, cancelled consumers, adoption
identity, output availability and replay. Explore bounded independent completion
orders and assert identical adopted outputs and unchanged structure. Test that an
implementation actually runs through its compiled registration.

This is the first isolated core profile. Before calling the foundation complete,
specify and verify bounded checkpoint storage, generated IPC contracts/redacted
inspection, current
authority/adoption integration, provider-invocation diagnostics/retry provenance,
incremental stream events and formal refinement evidence. Do not reconnect
production workflows merely because the isolated core tests pass.

### Invariant coverage at this checkpoint

| Foundations invariant | Implemented evidence | Remaining obligation |
| --- | --- | --- |
| G1–G4: definition, structure, bindings, node identities | Compiled registration; exact borrowed artifact; type/cycle/guard rejection; namespaced composition | Generated IPC projection parity and wider composition/shape cases |
| G5: demand/readiness/admission | Activation overlay, capacity, fresh retry and checked dispatch tests | Production admission adapters and fairness policy |
| G6: current adoption authority | Exact Available-attempt read/adoption; durable owner transaction interface; SQLite source/authority and publication rollback tests | Concrete product source, access, reset/replacement rules and production adapter |
| G7: sharing | Independent attempt IDs and acquisition modes; cross-artifact reuse; cancellation permutations | Billing/credit provenance and bounded payload retention |
| G8: history | Immutable artifact IDs; append-only attempts; versioned bounded checkpoints; UUID engine namespace; CAS and uncertain-commit recovery | Production migration, retained historical implementations, compaction and settlement-capacity policy |
| G9: failure evidence | Core validation faults preserve structural locations | Bounded typed provider metadata and content-safe diagnostic export; raw inspection does not satisfy G9 |
| G10: refinement | Deterministic reducer and enumerated finite interleavings | Separate abstract model and systematic transition-conformance evidence; current unit tests are not a formal proof |
| G11: visualization fidelity | Native inspection borrows actual executable topology and reports native reasons | Generated projection, viewer integration and real rendered-edge tests |

No stage-completion claim follows merely from passing the core unit tests.

### Verification record — 2026-10-08

- Final targeted native graph suite: **22 passed**, including real handler
  invocation, captured-input claims and the paused-owner/new-subscriber regression.
- `npm run check:fast`: passed on the final source state, including the subscriber
  dispatch regression; all 16 validation tooling tests passed.
- README Clippy command (`--lib --tests -- -D warnings`): passed on that state.
- Documentation: nine maintained entry points and 34 relative links across the
  three graph notes passed; tracked diff whitespace checks passed.
- Full native suite at the preceding 21-core-test snapshot: **875 passed,
  6 failed, 6 ignored**. Subsequent source changes only corrected final descriptor
  collection inside the isolated scheduler and added its regression. No production
  workflow calls this core yet. The full application suite is not passing.
- An earlier full-suite attempt exposed invalid `review` values in the two new
  bibliography entries. Corrected them to the existing enumerated vocabulary and
  retained review detail in `note`; the rerun above cleared those configuration
  failures. The fast gate alone did not catch that defect.
- A targeted rebuild overlapped the running Windows native test executable and
  failed to link its locked file. The retry after that process exited passed all
  22 tests; the failed invocation is not test evidence.

Outstanding full-suite failures, preserved in the paused shared-checkout work:

| Existing test | Observed mismatch |
| --- | --- |
| activation::defaults_schedule_reply_coaching_and_assessment_without_backfill | Automatic reading adds four operations absent from expected defaults |
| activation::late_assessment_shares_pending_work_preserves_source_and_credits_once | Extra automatic reading operations in expected initial work |
| activation::requesting_reading_before_reply_does_not_schedule_other_helpers | Extra automatic reading helpers beyond the requested operation |
| activation::opening_failed_help_is_a_read_and_retry_is_explicit | Ready work remains after the fixture's expected completion |
| activation::late_helpers_bind_current_access_and_reject_unavailable_sources | Model metadata is null rather than fixture-fast-current |
| migrations::baseline_upgrade_preserves_history_settings_and_has_a_recovery_copy | Migrated reading policy is on_demand; current fresh default is automatic |

The first five live under `conversations::execution::tests`; the sixth under
`storage::store::migrations::tests`. These were reported to the paused gloss chat;
their source and assertions were not rewritten to make this checkpoint green.
No UI build/rendered-app verification, live provider invocation, deployment,
workspace migration, commit or release was performed for this core checkpoint.
