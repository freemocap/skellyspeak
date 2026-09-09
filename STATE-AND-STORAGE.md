# State, storage and application boundary proposal

Status: architecture proposal for review. No database, state library or IPC code
is implemented. This contract connects [domain ownership](./DATA-MODEL.md),
[execution](./EXECUTION.md) and [AI routing](./AI-STRATEGY.md). It proceeds against
their proposed defaults without treating every open choice as approved.

## Ownership and storage shape

Use one device-local transactional domain store, owned through Rust. Its logical
structure is relational: stable identities, references, uniqueness constraints and
atomic changes across related records. Database engine, bindings and physical
schema are a subsequent implementation selection, not additional product scope.

| State | Owner and persistence |
| --- | --- |
| Learner, partners, relationships, conversations and settings | Rust; durable domain records |
| Accepted messages, assistance provenance, memory and evidence | Rust; durable, source-referenced records |
| Operation intents, attempts and accepted output identities | Rust; durable execution records needed for recovery and accounting |
| Standard/Fast bindings, routing rules and nonsecret route configuration | Rust; durable device configuration with revisions |
| Credentials | Rust; platform credential storage, separate from the domain database |
| Projection caches, embeddings and private analysis caches | Rust; rebuildable, versioned and subject to source deletion |
| Model resources, emoji reference tables and public lexical data | Rust-managed versioned resources; no learner content |
| Selected contact, tab, hover/focus and unsent draft | React; transient, scoped by conversation or coach thread |
| Tutorial completion, accessibility and visualization preferences | Rust; durable preferences; React presents and edits them |

Proposed draft policy: retain drafts across navigation during the app session,
separately for each conversation and private coach thread. Persisting unsent drafts
across restarts is not required initially. Do not represent a draft as an accepted
message or include it in evidence, partner memory or usage counts of sent text.

Embeddings and projections are replaceable derivatives, not parallel editable
truth. Evidence records remain durable analysis; a statistics view does not rerun
assessment merely because a projection cache is absent.

## Transaction boundaries

No transaction stays open while waiting for inference or network access. Prepare
durable work, dispatch outside the transaction, then revalidate at publication.

| Mutation | Atomic domain effect |
| --- | --- |
| Create conversation | Conversation, complete independent settings and creation action receipt |
| Accept Send | Learner message, input provenance, turn, initial work intent and action receipt |
| Publish accepted output | Source-authority checks, result/message, successful output identity, operation outcome and projection invalidation |
| Edit settings | Expected-revision check, new settings revision and affected work invalidation where required |
| Cancel | Revoke publication authority for unfinished work and record cancellation before signaling workers |
| Remove/correct memory | Memory mutation, applicable extraction exclusion, dependent unpublished-work invalidation |
| Delete conversation | Revoke work, remove source-owned records, adjust memory support and invalidate all affected projections |

Provider usage belongs to the actual attempt, even if output validation fails.
Accepted output publication and provider accounting are distinct facts. Persist
usage when available without claiming local storage and a remote provider share a
transaction. Local deletion and hosted incurred metering follow the data-model rules.

Every write checks ownership, references and expected revisions in Rust. Worker
callbacks cannot create missing parents. A process/session execution identity and
revocable operation authority prevent callbacks from cancelled or replaced work
from publishing. Store constraints reinforce these checks rather than relying on
UI ordering. Source removal wins over an in-flight operation's captured settings.

## Commands, queries and events

Use typed domain commands across IPC, rather than arbitrary record updates or a
frontend-exposed database interface. Rust is authoritative for validation and effects.
Generate or verify shared wire types so TypeScript and Rust cannot silently diverge.
The type-generation tool and serialization conventions remain implementation choices.

| Interface | Illustrative contract |
| --- | --- |
| Command | `SendMessage`, `SetConversationSettings`, `RequestAssistance`, `RetryOperation`, `CancelTurn`, `DeleteConversation` |
| Query | Conversation snapshot, relationship summary, language report, global usage report, execution graph |
| Event | Scope changed, operation state changed, accepted output available, resource removed |

A mutation envelope identifies its action ID, target scope, expected revision where
applicable and typed payload. A response supplies the accepted identity/revision
or a typed failure. Repeating the same action ID with the same payload returns its
existing receipt; reusing it with another payload is an error. Receipts have an
explicit session/retention boundary, after which stale commands are rejected rather
than blindly replayed. Deletion removes content-bearing receipts for that scope;
missing parents and revoked sessions still prohibit resurrection.

Failures distinguish validation, revision conflict, missing/deleted scope,
authentication, unavailable capability, interrupted/unknown provider outcome and
persistence errors. Include retry eligibility and safe diagnostic IDs. An IPC
transport failure is not proof that Send failed: query the action receipt before
offering resubmission. Do not clear the draft until acceptance is established.

Queries are scoped, paginated and bounded. Reports specify language, partner,
conversation, speaker, time range, archive inclusion, units and aggregation rules
as applicable. Responses carry data revision, projection rule version, source
coverage and pending/error status. Missing assessment is not a zero score.

## Snapshot and event consistency

Events notify the frontend about Rust-owned state; they are not a second database.
Use a sequence per subscription scope, tied to committed changes. Establish a
subscription and coherent snapshot cursor through one backend protocol: buffer
changes after that cursor while delivering the snapshot, then deliver them in order.
Do not implement separate uncoordinated “fetch, then subscribe” calls.

Duplicate events at or before the applied cursor are ignored. A gap or expired
cursor requires a fresh snapshot. Bound event retention; do not keep a permanent
content-bearing event log just to hydrate React. Database commit followed by a
lost notification is repaired by reconnect/resnapshot, not a guessed UI mutation.

React stores normalized, scope-keyed snapshots and transient interaction state.
Rendering derives from those snapshots. Send may appear as a clearly pending item,
but durable messages, XP and assessment values are accepted only from Rust.
Settings can show a pending local edit; revision conflict preserves the user's
input and exposes the actual stored value instead of silently overwriting it.

Navigating from Juan to Marta changes subscriptions and selection. Juan's worker
results still update Juan's scope; late query responses cannot replace Marta's
view. A settings change affects the owning conversation, while changing Standard
or Fast bindings affects device execution configuration according to the execution
contract. A garden renderer and a numerical report can consume the same metric
snapshot without deriving scores from each other's presentation state.

## Projection refresh and invalidation

Record dirty projection scopes in the same transaction as their source changes.
Compute from a consistent source snapshot and publish with its input sequence and
rule version. If sources changed during computation, the result cannot be labeled
current; retain the dirty marker until a valid refresh succeeds.

Ordinary additions may show a clearly marked earlier aggregate while recomputing.
Deletion and exclusions require stricter handling: immediately make affected cached
quotations, evidence lists and unsupported totals unavailable, including frontend
copies. Show recomputing/unavailable until safe replacements arrive. A stale badge
alone is insufficient for data the learner explicitly removed.

Reuse cache entries only for compatible input, contract, permission and model/resource
identities. Changing a Fast binding affects future resolution and cache matching;
it does not automatically rerun every retained message. Explicit reanalysis replaces
logical contributions, preserving the no-duplicate-evidence rule.

## Startup, interruption and deletion

Startup opens and validates the store and resource identities, reconciles incomplete
local work and reads preferences/onboarding state. Failure to open or validate data
is a visible blocking error, never an implicit empty database or automatic reset.
Start from fresh application data; no import, compatibility or backup subsystem.

Interrupted local deterministic work can be scheduled again under the same logical
output identity. An unresolved network attempt remains interrupted/outcome unknown;
do not replay paid work automatically. App suspension is an execution interruption,
not a promise of continuous background inference on every platform.

If private media or large derived assets use separate files, metadata deletion and
file removal cannot be assumed atomic together. Revoke access and record pending
cleanup transactionally, then remove files; show incomplete cleanup on failure and
resume it on startup. Cleanup references must not preserve removed text. Do not
report deletion fully complete while managed content files remain. This contract
does not promise forensic erasure from device storage.

Keep credentials outside record queries. Credential setup crosses a dedicated
sensitive command boundary and does not return secret values to the UI. Local-data
reset removes domain records, private caches, drafts and associated runtime work;
credential removal/sign-out is an explicit additional scope in the reset control.
The exact platform APIs and reset interaction require focused implementation design.

## Verification contract

Implementation must demonstrate:

- A crash between Send acceptance and response delivery yields one accepted message
  after receipt reconciliation, without an automatic duplicate provider request.
- Concurrent settings edits produce a revision conflict rather than a lost update.
- Cancellation/deletion racing with publication cannot restore removed records.
- Partial analysis failure leaves independent accepted results accessible.
- Snapshot/subscription races, dropped notifications and duplicates converge to
  authoritative state; switching conversations never shows another scope's result.
- Deleting evidence invalidates cached reports and frontend copies before they can
  present removed quotations or unsupported totals.
- One exchange can persist Standard and Fast attempts with separate accounting,
  while logical output uniqueness prevents duplicate learning credit.
- Restart distinguishes resumable local computation from unknown remote outcomes.
- Credential values never appear in general snapshots, events or diagnostics.

These are future acceptance checks, not test results. Native lifecycle and secure
credential claims require verification on the corresponding platforms.

## Next boundary

Review session-only drafts, the reset/credential distinction and snapshot hydration
alongside the execution defaults. Next, consolidate the remaining architecture
choices and select concrete provider protocols, Standard/Fast candidates and the
embedding approach. That pass should produce a bounded evaluation plan and an
implementation checklist, not another open-ended product questionnaire.
