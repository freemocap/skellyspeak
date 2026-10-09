# Executable AI graphs: runtime audit and implementation proposal

Date: 2026-10-08. Status: **audit findings and authorized implementation plan**.
The initial audit changed no application source. The user subsequently authorized
implementation; an isolated native core now implements the
[initial semantic profile](ai-graph-core-semantics.md). Production workflows,
preferences and stored workspace formats have not been migrated by this work.

The [production integration checkpoint](ai-graph-production-integration.md) records
the current source audit and concrete next delivery: close shared execution-evidence,
stream and transaction gaps, then convert one complete coach workflow through durable
publication and the native-artifact viewer. Its proposed sequence does not waive the
foundation gates below. Original audit observations and checks remain historical.

## Supersession and architectural authority

The user rejected the original reading-first sequence. The corrected plan below
puts formal specification and independent core verification before rebuilding any
product workflow. Shared reading is a later migration/regression case, not an
architecture milestone. Earlier coordination endorsement of reading-first work is
superseded. Existing source findings and recorded test results remain evidence of
the audited checkout, not approval of that ordering.

[AI graph foundations](ai-graph-foundations.md) owns the architectural vocabulary,
agreed constraints, draft formal model and invariants. This audit records existing behavior and implementation sequencing; it does not
maintain a second ontology or override that specification. The core profile records
implementation progress and remaining verification obligations separately.

## Scope and evidence boundary

Inspected HEAD `6ed72747` plus the paused, uncommitted gloss work in the shared
checkout. Findings below distinguish existing architecture from those partial
edits. Source inspection and selected disposable-workspace/loopback tests establish
runtime behavior at the inspected seams. This is not a live-provider benchmark or
a running-app reproduction of the reported missing edges or Lucia hover sequence.

The desired direction is agreed in conversation: one authoritative native graph
model, reusable typed operations, explicit connections and activation policies,
and a thin viewer showing stable structure with run history overlaid. Concrete
the architecture-first stages below are authorized. Detailed integration and
migration contracts still require the focused review described by their exit gates.

## Findings

### 1. Structure and activation are currently conflated in the run projection

[Operation declarations](../../native/src/conversations/turn_plan.rs) contain
kind, prerequisite kinds, activation, model role, and contract version. The
[scheduler dependency checks](../../native/src/conversations/execution/graph.rs)
and [definition catalog](../../native/src/diagnostics/ai_graphs.rs) use them.
This is a real shared source of dependency truth, not a UI-invented graph.

[Turn creation](../../native/src/conversations/execution/turns.rs) omits operations
when activation or captured execution preferences do not enable them.
[Explicit help](../../native/src/conversations/execution/optional_help.rs) inserts
missing operations later, checks prerequisites, reuses existing work, and requires
explicit retry for failed/unknown work.

[Snapshots](../../native/src/conversations/execution/snapshots.rs) enumerate only
stored operations and map declared prerequisites to those operation IDs.
[ActivityGraph](../../ui/src/features/activity/ActivityGraph.tsx) and
[layoutTurn](../../ui/src/features/activity/graph-layout.ts) render that subset.
[AiView](../../ui/src/features/activity/AiView.tsx) switches between this projection
and a separate definition browser; definitions are not offered on its phone mode.
Unrequested nodes therefore disappear even though the workflow declares them.

Edges are created for every supplied dependency, independent of execution phase.
Missing prerequisite IDs cause an error rather than being silently pruned.
The [styles](../../ui/src/styles/features/activity/ai-view.css) change edge colors;
they hide handles through opacity, not the edge paths. There is no inspected rule
that deliberately removes edges when execution ends. Completely disconnected
visible boxes remain a separate, unreproduced rendering/data diagnosis.

### 2. The native declaration is an ordering DAG, not a typed dataflow contract

[Dispatch](../../native/src/conversations/execution/dispatch.rs) selects operation
kinds and builds inputs by querying messages and captured JSON. It also handles
local context validation and empty attribution completion. Prerequisite success
does not itself describe the exact source value flowing into an operation.

[Publication](../../native/src/conversations/execution/publication.rs) validates
results, checks source ownership, writes domain data, releases dependents and
commits. These safeguards must remain. Their logic is not represented as typed
input/output bindings in the declaration. The definition inspector separately
assembles explanatory metadata and sample prompt/schema presentations.

User and partner gloss kinds call the same linguistics builder; both translation
kinds call the same translation builder. The duplication is principally invocation
identity and lifecycle/wiring, not two independent translation algorithms.
Operation kind currently serves several jobs: reusable operation identity, node
identity, dispatch selector, storage lookup, and UI selection.

### 3. Historical graph identity is not captured by the inspected run contract

`plan_for` in publication infers opening/coach/reply from existing operation kinds.
Snapshot dependencies and contract versions come from current declarations.
[TurnView](../../native/src/model.rs) carries operations and attempts, but no
immutable graph-definition reference. Current declarations must not be presented
as proven historical topology when a run predates a graph change.

### 4. Gloss divergence involves both execution and display

Before the paused bridge, scheduled conversation gloss/translation ran through
the conversation scheduler/grouped transport. Hover reading used
[shared reading](../../native/src/application/reading_results.rs),
[reading contracts](../../native/src/language/reading/text.rs), and
[shared results](../../native/src/ai/results/mod.rs). Sharing prompt builders did
not ensure sharing an execution, validated result, or repair history.

[SavedGlossText](../../ui/src/components/reading/SavedGlossText.tsx) and
[WordHoverHelp](../../ui/src/components/reading/WordHoverHelp.tsx) have distinct
popup lifecycles. The paused `WordHelpContent` extraction shares their body and
actions, but does not by itself unify result selection or lifecycle.

The coordinating agent also identified a source-binding risk: hover can receive a
rendered substring while Words receives the complete message. Equal operation
definitions cannot deduplicate unequal requests. Preserve original passage identity
and offsets through Markdown/annotated fragments, with explicit selection bindings.

[Saved gloss indexing](../../ui/src/domain/reading/saved-gloss-index.ts) prefers
exact contextual passages, then contextual word matches, then dictionary entries;
it can combine alternative saved meanings. This is consequential domain policy,
even though its implementation currently lives in the UI domain. Sharing a graph
does not automatically make an isolated-word request equivalent to a passage
request or make dictionary meaning equivalent to contextual analysis.

The other agent confirmed that popup/execution divergence predates dictionary
preloading. Imports use the existing saved-reading lookup; they did not originate
the two execution paths. This audit did not independently reconstruct that Git
history or replay the original user's conversation.

### 5. Shared execution is already a useful, separate abstraction

[Result keys](../../native/src/ai/results/text.rs) include exact transport payload,
contract/context, workspace, route, endpoint and credential identity, excluding
consumer/execution IDs. [Pending subscriptions](../../native/src/ai/results/pending.rs)
allow multiple consumers to share a producer. Consumer cancellation and provider
settlement are intentionally separate. Explicit fresh reading uses a distinct
pending identity. [Receipts and blobs](../../native/src/storage/schemas/inference_results.sql)
separate durable execution provenance from evictable payloads.

Reading, speech, transcription and coaching use shared execution mechanisms with
different publication owners. [Proposal execution](../../native/src/application/commands/proposal_execution.rs)
records shared execution receipts but intentionally generates fresh content for
each explicit request. A universal graph abstraction must preserve these differing
reuse policies rather than globally enabling caching/deduplication.

### 6. Scheduling and observability need explicit representation

[Application scheduling](../../native/src/application/scheduler.rs) acquires a
network permit before native dispatch, including local work. Dispatch also checks
the running-operation cap before selecting local context. Source inspection thus
confirms local planning can wait behind network capacity. No saturation latency
measurement was performed.

Grouped transport publishes completed items independently; it must not become a
barrier waiting for all siblings. [Recovery](../../native/src/conversations/execution/recovery.rs)
marks interrupted work unknown and pauses pending turns. The graph model must
retain unknown outcomes rather than infer success or automatically rerun them.
[Rate-limit retry policy](../../native/src/ai/policy/retry.rs) already permits
bounded explicit rate-limit retries while refusing ambiguous/group replay. Moving
scheduled reading out of grouped transport can change applicable retry semantics;
this requires explicit parity review, not an incidental behavior change.

## Architectural specification owner

The [foundations document](ai-graph-foundations.md) is the single owner of the
proposed formal ontology, execution semantics, invariant definitions and inspection
contract. The earlier duplicate ontology/activation draft in this audit has been
removed so these documents cannot evolve into competing specifications.

This audit owns evidence about existing paths, coordination and migration risks.
Product composition and publication must retain explicit domain ownership during
migration; concrete module boundaries follow specification review. No new database,
server framework, remote state or orchestration library is selected by this audit.

## Coordination decision and existing work

Coordination and a second review of this plan completed with “Fix inconsistent word glosses” on 2026-10-08. It
remains paused at the user's request. No rollback or restart was performed.

| Partial work | Proposed treatment |
| --- | --- |
| `WordHelpContent.tsx` and popup changes | Retain as useful work; complete consistency/lifecycle tests after implementation resumes. Does not depend on the graph engine. |
| `scheduled_reading.rs`, scheduler/dispatch changes and permit handoff | Retain as a provisional bridge; reassess it during workflow migration after the core architecture is verified. Do not expand operation-kind special cases as the final architecture. |
| Cached original provider completion | Reconsider as the adoption contract. Shared reading may have merged repairs that are absent from that completion; conversation publication currently validates/merges again against its own saved value. Consumers should adopt one validated typed result with preserved lineage. |
| Cache-key marker and proposed equivalence | Verify exact equivalence across scheduled/hover requests, captured context, schemas, models, and repairs. A code comment claiming equal keys is not evidence. |
| Automatic reading default | Preserve explicit saved choices and historical migrations. Existing setting affects both learner and partner reading; settle scope before finalizing. No default was changed by this audit. |
| Existing tests and diagnostics edits | Preserve; extend for the cross-path regressions below. Previous checks do not establish final-state integration readiness. |

Recommendation: preserve the paused gloss work without integrating, rolling back
or expanding it now. After core architecture verification, evaluate which pieces
fit the new operation/result contracts and rewrite adapters where necessary.
Popup changes may remain useful, but they do not set architectural priorities.
The coordinating chat has been informed of this corrected sequence.

## Ordered implementation plan and exit criteria

### 1. Formal foundations and ontology

Review [the foundations](ai-graph-foundations.md): graph and operation identities,
typed ports, explicit bindings, composition, activation, execution/result/adoption
identities and the distinction between external nondeterminism and deterministic
inspection. Existing workflows contribute constraints, not architectural branches.

Exit: reviewed vocabulary and mathematical model, with explicit limits and no
unresolved conflation of definitions, nodes, attempts, shared executions or results.

### 2. Complete architectural specification

Specify the full transition system and invariants, conditional joins, concurrency,
admission, cancellation, retry, sharing, streaming/publication, recovery, version
compatibility, durable provenance and historical unknowns. Define ownership before
concrete storage/module contracts. Establish graph inspection as a deterministic
projection of the exact artifact interpreted by execution, not a second model.

Exit: reviewed transition table and contracts, invariant-to-test matrix and a
bounded verification strategy. Agree any persistence migration design before
changing stored records. Document unproved assumptions explicitly.

### 3. Implement and verify the domain-independent core

Implement graph validation, operation binding, composition, runtime transitions,
execution/result identities and authoritative inspection export. Use synthetic
local/fake-provider operations to test chains, joins, guarded branches, on-demand
activation, sharing, retries, cancellation races and crash recovery. Validate the
same exported artifact that the runtime uses. No gloss, conversation or provider
name may substitute for a missing core abstraction.

Exit: core invariants and transition conformance verified within documented
bounds, including type/dependency errors, double-adoption prevention, unknown
outcomes, local/resource scheduling and projection identity. This gate precedes
production workflow reconstruction. Passing tests is not a universal proof.

### 4. Rebuild and reconnect AI workflows

Inventory and migrate conversation reply/opening/coach, reading, speech,
transcription and proposal workflows onto the verified contracts. Preserve domain
publication ownership, source validation, independent sibling publication, explicit
freshness/reuse policies and usage/credit provenance. Select migration order by
dependency and preservation risk after the core is established.

Follow consecutive workspace migrations for incompatible persisted changes.
Preserve historical operations, attempts, messages, evidence and receipts. Do not
rewrite released migrations or invent unavailable historical graph definitions.
Identify each legacy adapter and its removal criterion; no converted workflow keeps
a permanent alternative scheduler or semantic model.

Exit: each workflow passes parity and domain regressions, including the original
gloss/hover problems, through the new architecture. The previous bridge is reviewed
as migration material, not accepted as the foundation. Fix fragment/source binding,
repair adoption and popup consistency as downstream workflow responsibilities.

### 5. Complete direct visualization and end-to-end acceptance

Use the core's authoritative artifact and runtime facts for a single graph with
run/attempt timelines. Generic serialization, generated contracts, layout and
presentation adapters may exist; none reconstruct dependencies or runtime policy.
Changing executable composition must update inspection without a parallel edit.
Nodes remain inspectable when never activated. Historical unknowns stay explicit.

Exit: semantic projection parity plus real renderer tests across resize,
dock/window/phone, run selection and execution phases. Diagnose missing edges with
actual edge IDs, rendered paths, handle bounds, stroke and viewport evidence.
Do not declare the original missing-edge symptom fixed solely from mocked tests.
Definition/run integration and original user flows must be inspected in the running
app. The projection contract and core parity tests belong to stages 2–3; visual
polish and workflow acceptance cannot redefine that contract.

## Required regression matrix

| Scenario | Required observation |
| --- | --- |
| Automatic vs on demand, reply succeeds/fails | Same graph/edges; correct demand and blocked reasons; no premature child execution. |
| Hover then Words, Words then hover, concurrent opens | Same contextual result/actions; one execution for equivalent requests; separate consumer identities. |
| Markdown/annotated fragments and repeated words | Original full passage and occurrence offsets survive rendering; equivalent selections bind to the same source; unrelated occurrences remain distinguishable. |
| Dictionary fallback then contextual result | Provenance and replacement policy explicit; no claim that dictionary data is passage analysis. |
| Partial gloss, repair, reverse completion order | Accepted spans preserved; same validated result adopted; stable occurrence anchors. |
| Canonical encodings and representative scripts | Exact source preserved; Unicode/offset policy shared; no language-specific wiring fixes. |
| One/all consumers close | Other consumers survive; submitted work retains outcome/accounting; no late unauthorized adoption. |
| Cache hit, pending join, restart, eviction, capacity zero | Correct result mode and provenance; durable accepted annotations/receipts survive eviction; provider use counted once. |
| Model/access/context/source change | Correct cache separation and invalidation; no stale result adopted; captured authority remains inspectable. |
| Saturated provider capacity | Local readiness/cache reuse do not wait for a new network slot; scheduled subscribers joining pending work do not retain another provider permit; true provider requests remain bounded. |
| Rate limit, malformed output, partial metadata, unknown outcome | Existing retry boundaries preserved; useful redacted metadata survives; no ambiguous automatic replay. |
| Replacement, migration, reset, repeated startup | Identity/history and one-time credit preserved; no invented historical state; correct recovery. |
| Resize, state changes, run switch, pop-out, phone | Complete visible structure; stable selection; real rendered edges; no UI inference from absent records. |

Implementation gates: final `npm run check:fast`; affected native tests and README
Clippy/native suite for native changes; affected UI tests and `npm run build` for
UI changes; generated contract checks and migration suites where applicable.
Each stage is a separately reviewable checkpoint. Commits require a fresh explicit
user instruction; deployment and release actions are outside this plan.

## Decisions still requiring focused review

1. Automatic reading scope: automatic support after partner replies was requested;
   learner-message support was not explicitly excluded. The existing setting
   combines learner/partner behavior. Resolve that scope and preserve saved choices.
2. Reading selection: what an open hover shows when a contextual result supersedes
   dictionary/alternate saved meanings. Proposed rule: stable source occurrence,
   explicit provenance, contextual precedence, and preservation of applicable
   details. Longer definitions from another context must not win just because they
   are longer; explanatory details remain distinct from short inline glosses.
3. Historical graph reconstruction: evidence available for old versions and how
   uncertain structure is labeled. Do not block new-run correctness on inventing
   unavailable history.

These decisions do not reopen platform, provider, storage-engine or no-sync choices.

## Verification during this audit

- Native declared-dependency release/dispatch/inspection test: **1 passed**.
- Existing reading shared-execution suite: **7 passed**, including concurrent
  reuse, cancellation, restart/pause, explicit retry, repair and metadata retention.
  These do not cover the new scheduled-reading bridge.
- Activity layout, ActivityGraph and AiView suites: **26 passed** through the UI
  workspace command. React Flow is mocked in component coverage; this is not a
  rendered-edge reproduction.
- An initial root-level Vitest invocation omitted the UI configuration, picked up
  a retained `.local` checkout and lacked setup; its failures are not valid app
  regression evidence. Correct workspace invocation initially hit a sandbox
  esbuild path-access error, then passed with approved local execution permission.
- Two initial shared-reading module-name filters matched zero tests; the corrected
  `application::commands::reading::shared_tests::` filter produced the seven above.
- Activation default characterization: **1 failed** on the paused working tree.
  `defaults_schedule_reply_coaching_and_assessment_without_backfill` expects five
  operations; the provisional Automatic reading default adds all four learner and
  partner reading operations. This is a concrete unresolved scope/test-alignment
  issue in the partial work, not a fix made by this audit.
- `npm run docs:links`: **passed** for nine current documentation entry points.
  Separate check of this note's 26 local links: **passed**. `git diff --check`
  passed for tracked changes; no tracked application files were edited here.
- Full native/UI suites, Clippy, UI build, live providers, running-app visual QA and
  the paused gloss changes' final fast gate are not claimed as passing.
