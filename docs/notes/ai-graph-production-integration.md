# AI graph production integration

Updated: 2026-10-09. Status: **coach command, application-host and viewer integration
implemented in source; acceptance remains incomplete**.
The architecture-first direction is authorized. This note makes the next delivery
milestone concrete; source integration is not running-application acceptance.
The [foundations](ai-graph-foundations.md) remain the ontology owner. The
[original audit](executable-ai-graphs-audit-and-plan-2026-10-08.md) remains the
whole-application migration and regression inventory.

## Completion order agreed after coach UI check

### Approved continuous implementation checklist

The user approved this sequence with involvement only at **8 and 11**. Passing a
component suite or completing a documentation checkpoint is not a stop condition.
Continue through implementation and repairs; stop earlier only for an actual
user-dependent blocker, conflicting requirements or a proposed product-policy change.
Changes remain uncommitted; deployment and releases require separate authorization.

**Sequential execution correction, 2026-10-09:** only one numbered step is active.
**Steps 1 and 2 are closed. Step 3 is next; partner production admission remains unchanged.**
Existing code for later steps is retained, but component progress does not close a
step. Finish and record each step's stated gate before advancing. The implementation
sections below are accumulated evidence, not an alternative execution order.

1. [x] **COMPLETE - native result publication.** Verify translation, gloss,
   feedback, assessment, attribution, briefs, assistance and explanations reach
   their existing product fields/readers through native adoption. Verify exact
   source/attempt ownership, transaction rollback, disclosure, revision evidence
   and one-time credit; repair any gaps. Close with a result-by-result evidence
   list and passing affected regressions. Production partner admission is step 3.
2. [x] **COMPLETE - native speech integration.** Connect product speech discovery, requested
   playback after eviction/restart, explicit regeneration and cancellation to the
   native receipt/cache/delivery implementation. Close when the entire requested
   playback lifecycle passes, including inspection and preserved learner settings.
3. [ ] **QUEUED - switch partner application wiring.** Route ordinary opening and
   Send commands through native admission and the application scheduler/provider
   host. Close when real command-path tests produce replies and enabled helpers,
   optional failures do not block independent branches, and no legacy execution
   rows are created for these requests.
4. [ ] **QUEUED - finish conversation controls.** Connect automatic/on-demand work,
   pause, cancel, single-step, retry, regeneration and native message revision.
   Editing removes dependent product messages/ownership; graph history may remain.
   Close with command-path tests for those controls, late results and restart.
   No selective graph-history erasure or archive reconstruction work.
5. [ ] **QUEUED - convert remaining entry points.** Complete standalone reading,
   translation, gloss and explicit help; conversation/Drill transcription and
   speech; partner proposals and Drill proposals. Close each workflow before the
   next, with native command routing, product results and failure/cancellation tests.
6. [ ] **QUEUED - prove complete replacement.** Audit a finite inventory of commands,
   schedulers and provider call sites. Close only when every active AI request has
   verified native ownership, useful failures and no automatic legacy fallback.
7. [ ] **QUEUED - prepare the acceptance build.** Run native tests, Clippy, binaries,
   contracts, frontend tests/build and applicable documentation checks. Verify
   supported workspace upgrades, startup/restart and saved history; exercise local
   UI flows. Close with an identified runnable build and short acceptance script.
8. [ ] **STOP - user functional acceptance.** User exercises partner conversations,
   reading/help, playback/transcription including Drill, edits/retries and partner/
   Drill generation. Repair defects; obtain acceptance before step 9.
9. [ ] **AFTER 8 - unified activity viewer.** Finish persistent executable topology,
   timeline/state overlays, authoritative inspection and controls. All defined
   nodes/edges remain visible. No separately maintained topology.
10. [ ] **AFTER 9 - remove legacy execution and viewer.** Remove superseded active
    paths, preserve shared logic and historical readability, and verify references.
11. [ ] **STOP - final verification and acceptance.** Run final regression gates,
    update architecture/inventory and request the final running-app check.

Historical comparisons follow completion. Existing reusable domain validators and
transports remain shared; no fallback to legacy execution is introduced. Native
graph outputs for speech reference validated receipts rather than retaining audio
bytes permanently. Step 8 acceptance is required before steps 9–10.

**Scope correction, 2026-10-09:** the user explicitly superseded selective graph
erasure. Editing removes the dependent exchanges from the active conversation,
revokes their publication authority and starts replacement work. Superseded graph
history may remain. Physical graph-history erasure, archive reconstruction and
atomic multi-engine replacement admission are not prerequisites for conversion.
The experimental erasure components have been removed, including their changes
to checkpoint formats and runtime state. They were never wired to message editing.

The user exercised a coach request through the application and reported that it
worked in the frontend. This is a user-observed coach-path check, not full-system
acceptance. The user explicitly deferred old/new comparison setup until the new
system is complete; Git history is the retained baseline. Do not make comparison
infrastructure a prerequisite for conversion.

- [ ] Convert all remaining running workflows and pass their automated regression
  checks. This is the next functional endpoint; no new AI work may use the legacy
  executor or an automatic fallback to it.
  - Conversation: partner replies, openings and regeneration/revision flows.
  - Reading: translation and word gloss for learner/partner text and explicit
    reading requests, through reusable operations with explicit source bindings.
  - Assistance and learning: feedback, assessment, skill attribution, reply briefs,
    reply assistance and explanations, including publication and one-time credit.
  - Speech: read-aloud generation and transcription for conversation and Drill
    owners, including cancellation, cached results and explicit retries.
  - Generation: partner/persona proposals and Drill-item proposals.
- [ ] User tests the converted workflows in the running application; repair
  functional defects exposed by that acceptance pass.
- [ ] Finish remaining AI activity/interrogation UI work, including unified
  navigation and request/response inspection. Basic native inspection remains
  available during conversion; viewer polish is not the functional endpoint gate.
- [ ] Remove legacy execution and independently maintained viewer implementations
  after converted workflows work, preserving durable user history through reviewed
  migrations. Re-run affected regressions and application acceptance after removal.
- [ ] Only after that, perform historical comparisons and further alignment.

This order reflects the user's follow-up: workflow replacement first, running-app
check next, remaining inspection UI work and legacy source removal afterward.
Keeping obsolete source temporarily does not authorize routing new work through it.

Implemented host dependency: runtime caches now route by exact persisted engine
and catalog identities. Additional registered artifacts do not hide or replace
existing runs in the same conversation. Unavailable catalogs remain inspectable
through native historical replay, with execution controls disabled. This is host
registration and ownership routing; it introduces no new graph semantics.

## Step 2 speech integration - 2026-10-09

Implemented: explicit playback commands for native partner owners now create a
message-owned run of the same lookup/synthesis/selection artifact used by automatic
speech. They do not replay the reply or create legacy operations. Repeated clicks
reuse pending requests or resident audio. Expired, failed, unknown or cancelled
work requires a new explicit request. `regenerate: true` explicitly bypasses lookup.
Cancellation targets speech, leaving independent conversation work intact.

Format 67 stores only the auxiliary run's source/engine ownership. Command receipts
and native Begin/Cancel commit through the existing command transaction. Scheduler,
provider authorization, recovery and audio inspection resolve that ownership;
there is no extra scheduler or persisted copy of graph state. Product speech
operations expose the artifact's selection node for the existing playback hook.

Audio remains bounded in staging/delivery and the shared evictable cache. Native
values retain validated receipts; receipt alignment and provider/billing evidence
survive payload eviction. Original/normalized alignment and learner cache/playback
settings use the existing speech implementation. Delivered audio inspection checks
the recorded consumer and payload digest after eviction and restart.

The expanded command-path test covers action replay, cancellation before dispatch,
requested playback after eviction/restart, resident reuse, explicit regeneration,
provider failure without automatic retry, a subsequent explicit retry, product
speech discovery and delivered-audio inspection after another runtime recovery.
It asserts no legacy speech operations are created. Existing speech composition,
audio retention/alignment, bounded delivery and partner host tests remain applicable.
The new migration test injects rollback and checks preserved messages.

Verification complete: the full native library suite passed **1,138 tests, zero
failures, six ignored** (435.37 seconds), including supported workspace upgrades.
The initial full run exposed a format-67 reference-schema validation defect; it
was repaired, and historical downgrade fixtures were updated to remove the new
objects before simulating old formats. The full rerun above passed afterward.

A final product-discovery filter keeps unrequested/disabled speech out of autoplay
requests while preserving all nodes in native graph inspection. After that narrow
change, the complete partner/speech lifecycle regression passed again (22 seconds),
as did final Clippy (`--lib --tests -- -D warnings`), binary and fast checks. The
full-suite count above precedes this last filter; its affected regression was rerun.
Affected UI regressions passed **94 tests across 12 files**; frontend build,
generated-contract checks, documentation links and diff whitespace checks passed.
The existing frontend bundle-size advisory remains. No live-provider or running-app
acceptance is claimed. No changes were committed. Step 2 is closed; production
partner admission remains step 3.

## Step 1 publication closure evidence - 2026-10-09

Scope: native result adoption and the existing product readers. Ordinary partner
command admission remains step 3. This is not running-app acceptance or completion
of any later step. The existing publication implementation required stronger
product-reader verification; this batch adds that verification without changing
storage contracts or introducing another execution mechanism.

| Result | Publication and product read | Verification |
| --- | --- | --- |
| Learner/partner translation | Exact message source selects `userTranslation`/`translation`; snapshot exposes text and native status | Both message roles in helper authority tests and complete partner publication snapshot |
| Learner/partner gloss | Source-bound analysis into existing gloss fields and native provenance | Both snapshot gloss values/statuses; shared gloss validation and repair suites |
| Feedback | Native assessment receipt through assessment context and coach policy | Product feedback status, valid observation, retained validation omission, disclosure and foreign-receipt rejection |
| Assessment | Native receipt through current-assessment reader and conversation judgments | Product conversation feedback, adopted-attempt identity and recovery |
| Attribution | Adopted source-bound attribution into existing learning context | Complete publication fixture checks stored attribution; native producer/source authorization |
| Brief | Existing reply brief field and snapshot | Nonempty product value and native succeeded state |
| Assistance | Existing reply assistance field and snapshot | Nonempty product value and native succeeded state |
| Explanations | Existing reply explanation field and snapshot | Nonempty product value and native succeeded state |

The complete publication fixture now rejects adoption once for each publishing
branch, verifies unchanged graph revision and turn context, then adopts normally.
Assessment receipt counts are unchanged by rejection. The existing adapter tests
cover transaction-write rollback, revoked/foreign/deleted sources, exact Unicode
text and channel ownership. No legacy operations or assessment rows are fabricated.

The native practice regression covers a Unicode revision chain, experience versus
effort, unchanged-text zero credit, identical duplicate delivery and conflicting
receipt rejection with no legacy operations. Shared practice tests additionally
cover rollback, incomplete catalogs and cross-conversation revision rejection.
Native assessment and publication migrations remain covered by the full supported
workspace migration suite; this batch changes no persisted contracts.

The product-reader test exposed an incomplete disclosure object in the old test
fixture. It now uses the validated policy decision, matching the application path.
The publication fixture remains a cohesive integration scenario above 500 lines;
its new product-reader assertions live in a focused verification module.

Verification complete: full native library suite **1,137 passed, zero failed,
six ignored** (389.79 seconds). This includes publication, authority, native
practice/revision and supported-workspace migration tests. Affected UI regressions
passed **134 tests across 11 files**. Clippy (`--lib --tests -- -D warnings`),
binary checks, the final fast gate, documentation links and diff whitespace checks
passed. The initial UI runner was blocked by sandbox configuration resolution;
the authorized unsandboxed rerun passed. No live-provider or running-app acceptance
is claimed. No changes were committed. Step 1 is closed; step 2 remains next.

## Current integration batch — 2026-10-09

### Native publication and audio retention — implementation in progress

Native adoption adapters now publish translation, gloss, attribution, feedback,
assessment, brief, assistance and explanation results into the existing product
fields. They bind original producer inputs to the current message and turn inside
the adoption transaction. Gloss repair merges valid existing spans. Assessment
uses the existing revision-chain practice and skill-level algorithms; native
receipts replace legacy attempt authority without creating legacy rows.
Format 63 adds native assessment/disclosure ownership. Current native assessment
reads replay native history and require the adopted, current attempt; disclosure
rechecks that same receipt. These adapters are tested with the complete partner
artifact and application-created captures, but are not yet connected to production
partner admission.

Speech now has a typed source/routing capture and a synthesis operation returning
an execution-bound receipt, never audio bytes. Format 64 adds immutable native
audio receipts and separate evictable cache associations. Native and legacy
payloads share the existing cache capacity, recency clock and signal-cache cleanup.
Receipt alignment survives eviction; response/billing evidence remains owned by
the native execution. The same cache-lookup/synthesis/selection composition is now embedded in the
partner artifact. Disabled read-aloud has no fabricated route: its nodes remain
defined and unrequested. The host stages bounded audio and commits receipt/cache
retention in the native settlement transaction. Adoption rechecks the current
source and receipt. Application speech capabilities use the shared transport and
retain partial response evidence. Native playback reads and delivered-audio
inspection are connected; product speech discovery and auxiliary requested-playback
runs still need integration.

Verification: publication adapter suite (18), full partner publication integration
(1), format-63 migration (1), synthesis/playback composition (3), audio storage and
format-64 migration (4), existing result-cache regressions (8), and effort tests
(9) passed. The full format-64 native suite passed **1,131 tests, six ignored**.
The initial seven missing-table effort fixture failures were repaired before this
full pass. Clippy, the fast gate and documentation entry-point links passed at this
checkpoint. Subsequent native integration checks passed 48 tests, with Clippy and the fast
gate passing on that text-host state. Later speech-host edits
are undergoing separate verification; these numbers do not establish their final
state or partner running-app acceptance.

Current host work registers partner reply/opening artifacts and binds typed text
operations to shared transport preparation. Authorization reads the actual native
producer Work and checks current consumers, captured access and exact sources.
Fresh grammar evidence reads use adopted native assessment/attribution identities.
The host adoption path now invokes the helper/learning adapters, and a partner
status projection allows independent branches to continue after optional failures.
Explicit partner admission is being tested using application-created captures;
application commands still select coach-only native admission until speech,
controls, revision ownership and helper request/read paths are complete.

### Speech host and playback integration — implementation in progress

The partner executable now composes the shared playback artifact. Its lookup is
activated by captured read-aloud policy; missing optional speech configuration
never becomes a fabricated target. Source-bound synthesis uses the shared audio
transport, current native consumer authority and incremental response evidence.
Receipt/cache settlement is atomic with graph settlement, with a bounded pending
payload buffer and no audio bytes in graph values/history. Native adopted-node
reads use the core output resolver independently of unfinished branches.

Playback and delivered-audio inspection now accept native consumer identities.
Format 65 adds immutable consumer-owned delivery evidence without copying audio.
Reading playback cannot execute synthesis; eviction reports expired audio.
Dedicated host coverage exercises disabled/enabled speech, assessment failure,
settlement rollback, playback, tamper rejection, eviction and restart. The
preceding partner suite passed 32 tests. The subsequent native integration suite
passed 52 tests, including requested helper commands. The first full format-65
run had 1,134 passes, six ignored and one failure in a new fixture that attempted
to overwrite an immutable message. The fixture now invalidates the owning turn;
the repaired scenario passed in the native integration run. The subsequent full
native run passed **1,137 tests, six ignored, zero failures** (476.77 seconds).
That checkpoint predates the erasure replacement boundary below. Do not treat this as
running-app acceptance: partner command admission, requested playback regeneration,
controls and revision wiring remain unfinished.

### Requested helpers and admission — implementation in progress

Message-help, suggestions, explanations and helper retry commands now select a
native occurrence by its operation contract and exact bound source. Their command
receipt and demand/retry event commit in the same transaction. Commands against
native owners do not fall back to legacy operations. Requests preserve static
topology, including a requested node waiting for its declared prerequisites.
Blocked grammar help can explicitly retry its failed local evidence dependency.
Turn retry targets the reply branch rather than an independent assessment failure.

Command-path tests cover failed native writes rolling back the action receipt,
replay without duplicate work, restart, invalidated-source rejection, suggestions,
grammar activation and independent assessment retry. These and the existing native
integration tests passed **52 tests**; Clippy and the fast gate passed on that
helper-command checkpoint. Production partner admission remains unchanged.

The subsequent admission edit replaces the coach-only native queue count with
bounded, handler-free native inspection of all owned pending partner/coach work.
It counts provider occurrences, including paused and dependency-waiting work,
without a separate operation catalog. Dormant branches do not reserve capacity.
The admission edit and its budget regression passed in that full native run.

### Selective-erasure detour removed - 2026-10-09

Removed 12 dedicated source/test files (2,017 lines), plus erasure-specific changes
to the shared checkpoint codec, runtime state, history readers, storage adapter,
usage reads and event dispatch. Checkpoint formats 10/11 and late-erasure accounting
are removed. The interrupted admission-stage expansion was also removed. Useful
workflow publication, speech, stepping and native history work remains.

Workspace format 66 is retained solely as a no-op compatibility marker in case a
development workspace already opened at that version. It changes no data and
performs no deletion. The revision guard requiring physical graph erasure is
removed; deletion of product ownership prevents later publication.

Verification: the complete native library run passed 1,135 tests, ignored six,
and failed only the obsolete test requiring rejection of a native suffix edit.
After correcting that expectation, all four channel-ownership tests and the new
native suffix-retention/late-completion test passed. Production source was
unchanged after the complete run; only that test expectation was updated.
Clippy (`--lib --tests -- -D warnings`), binary checks, the final fast gate and
documentation links passed. The supported-version migration tests passed in the
complete run. No running-app acceptance or partner production cutover is claimed.
No changes were committed.

### Expanded partner composition — implementation in progress

The user requested continued autonomous implementation through the functional
endpoint, with larger batches and no permission requests for routine progress.
Application routing still uses the existing partner executor while the complete
replacement is assembled; no legacy execution implementation has been removed.

- [x] Add one shared source-bound gloss operation, preserving existing prompt,
  validation, independent-span recovery, pronunciation and source-coordinate rules.
  Translation and gloss share the same exact-source input contract. Captured gloss
  settings exclude unrelated presentation/transport configuration.
- [x] Connect learner and partner gloss branches beside translation in the native
  reply/opening component, including separate captured gloss and translation models.
- [x] Review and implement Number, Nullable and Map value constructors to represent
  existing assessment data without string or opaque-JSON encodings. Preserve old
  artifact encodings; new constructors require checkpoint format 9. See the
  [value-type specification review](ai-graph-value-types.md).
- [x] Add the source-bound Jev assessment operation using the shared validator and
  captured credit threshold. Preserve distributions and categorical evidence;
  settlement/adoption does not itself award credit.
- [x] Compose assessment with reply, translation and gloss in `partner_graph`.
  Opening definitions omit learner-only work. Both branches must use the same
  captured message history.
- [x] Implement local attribution selection and guarded provider attribution;
  empty selection skips the provider, retaining the node and its static edges.
  Reuse existing exact-quote/occurrence validation and source coordinates.
- [x] Add source-bound feedback, reply brief and draft-assistance operations; reuse
  existing prompts, partial-result validation and correction disclosure policy.
  Keep brief and assistance model captures separate.
- [x] Add grammar explanations with an explicit fresh local snapshot of currently
  available learner evidence, followed by the shared explanation operation.
- [x] Project finalized application turn captures into typed inputs, preserving
  source identity, existing feedback prompt bytes, separate task models and captured
  automatic/on-demand preferences. This adapter does not yet switch admission.
- [x] Verify the expanded composition, including assessment failure without loss of
  reply, feedback, briefs, draft assistance or requested grammar explanations.
- [ ] Add speech operations and application publication adapters.
- [ ] Connect complete partner admission, current-authority checks, revisions and
  explicit retry/demand paths; then move through remaining independent workflows.

Verification: the full native library suite passed after feedback integration
(1,118 passed, 6 ignored). After the final grammar snapshot, composition and admission
projection changes, all 249 graph-filtered tests and the real-turn capture regression
passed. The latter compares feedback prompt bytes against the existing production
prompt and checks fast/standard/Jev model routing and activation preferences.
Clippy (`--lib --tests -- -D warnings`), binary tests and the fast gate passed on
this state. The earlier UI build and activity regressions (11) passed; no UI source
changed in this component batch. These results establish executable source behavior,
not running-application acceptance or a switch of partner routing.

The next integration work remains speech, current-authority checks, durable
publication (including one-time learning credit and reserved reply-source identity),
revision ownership and demand/retry command wiring. Application admission must not
switch to an incomplete graph that silently drops existing helpers.

#### Reviewed explanation scheduling contract

This is a domain composition using existing local-operation and `Reuse::Fresh`
semantics, not a change to the core ontology. The old explanation request sampled
whatever learner assessment/attribution was available when help was requested. A
required edge from assessment to explanations would incorrectly make help wait for
assessment or fail when assessment failed. Silently reading mutable evidence inside
the provider handler would conceal that timing from inspection.

The partner artifact therefore contains an explicit on-demand
`explanation_evidence` local node. It depends on the adopted reply source and takes
an optional exact learner source plus captured skill definitions. Its host reader
captures available evidence once, with current source authority checked by the
application. It uses fresh execution rather than pooling mutable reads. The typed,
source-validated snapshot is adopted and then flows through a normal data edge to
`explanations`. Missing evidence remains absent; missing attribution stays distinct
from completed attribution with no localized phrase. Opening help has no learner
source and performs no evidence read. Retry must explicitly rerun the snapshot if
new evidence is wanted; an already adopted value never changes underneath a run.

The reader capability is implemented in the executable composition and exercised
by fixtures; the production host binding and publication adapters remain pending.
No hidden provider reads or second viewer topology are introduced. A standalone
explicit-help composition reuses the same explanation operation for source-owned
reading requests.

### Reserved reply-source publication — implementation checkpoint

The complete partner component already admits a reply source ID for reading and
support branches. Native reply publication previously generated a fresh ID at
Adopt, breaking that relationship. The publication adapter now follows the actual
executable `conversation.bind-reply-source` bindings and reserves their common ID
inside the Begin transaction. Conflicting bindings reject admission. Adoption uses
that ID; rollback retains the reservation without creating a message. Database
guards reject publication under a different identity.

Partner reply/opening adoption also publishes the playback source ID and exact
text in the same owner transaction. Coach replies do not acquire partner playback
fields. Rejected adoption leaves both the message and playback projection absent.
This preserves the existing conversation-facing source contract while the speech
operation and host integration remain unfinished.

Workspace format 62 adds an effect-owned reservation table without rewriting old
messages, publications or awards. Historical effects without a reservation retain
their existing behavior. This closes the reply identity gap; it does not switch
partner admission or complete helper/speech publication.

Verification: the full native run passed 1,120 tests with six ignored; its only
failure was the new fixture's SQL CRLF/LF equality assertion. After making that
assertion platform-independent, the corrected migration regression and all 17
publication tests passed on the final source. The earlier fixture error (two
assistant messages assigned to one turn) was also corrected by using separate
turns. No production constraint was relaxed. The full suite was not repeated after
the final test-only line-ending correction. Final fast gate, Clippy, binary check,
generated-contract check and documentation links passed. The all-supported-format
upgrade/reopen sweeps passed in the full run. Tests used disposable workspaces;
no live learner database was migrated and no running-app acceptance is claimed.

#### Remaining host cutover seams — source audit

The following are observed integration gaps, not completed conversions:

- Partner host scheduling/publication and branch-local status are now under test.
  Production partner command admission is intentionally not switched yet.
- `application/graph_execution.rs` now binds structured helpers through the shared
  `graph_request` transport. Verify controlled-provider application command paths
  after cutover, including cancellation during credential/protocol awaits.
- Native assessment/feedback readers and publishers now use native receipts and
  adopted-attempt selection, with transactional practice credit and disclosure.
  Production host adoption still needs to invoke those adapters. Auxiliary runs
  for explicit reassessment must retain their own producer ownership rather than
  rewriting the immutable primary turn owner or retrying an already adopted node.
- Speech has three separate responsibilities today: execution receipts, evictable
  reusable audio, and bounded one-time delivery. `ai/results/mod.rs` owns cache
  capacity/eviction separately from receipts; `speech/delivery.rs` limits delivery
  to four entries/16 MiB and each audio item to 4 MiB. Serializing those bytes into
  permanent graph outputs would change retention and exceed the host's 2 MiB
  settlement limit. The new speech binding must preserve cache/delivery semantics
  and original/normalized alignment while recording native execution provenance.
- Existing speech request, cancellation and delivered-audio inspection queries
  depend on legacy operations/attempts. They all need native-owner routes; merely
  adding a synthesis node does not complete speech conversion. Speech routing also
  carries `audio_resolution`, which the text transport capture correctly rejects.
  It requires its own typed capture rather than routing through text settings.

These seams explain why executable component tests are not yet partner application
acceptance. The agreed order remains complete behavior first, acceptance next,
legacy removal afterward.

### Executable reply and translation components

The user reconfirmed delivery order: make all workflows work on the new runtime,
leave obsolete implementation in place during conversion, then remove it after
application acceptance. Erasure remains a required revision behavior, not a
standalone cleanup project that precedes all other workflow implementation.

- [x] Implement `reading.translate` as one source-bound operation for learner,
  partner and explicit reading compositions. Its typed ports carry exact source
  identity/text, source/destination languages, writing guidance and captured
  transport settings. It uses the existing translation prompt/schema/validator.
  Null or foreign-source results fail before adoption and retain diagnostics.
- [x] Compose executable reply/opening components with context validation, prose
  generation, explicit source binding and the shared translation operation.
  Reading and reply targets/temperatures remain separate captured inputs. Run
  policy chooses automatic/on-demand translation without changing topology.
  Opening definitions have no fabricated learner source. Admission rejects
  mismatched learner text or aliased learner/reply source identities.
  An enclosing-graph execution test verifies composition through one shared
  operation registry, including qualified data and control dependencies.
- [ ] Integrate the remaining gloss, learning, assistance and speech operations
  into the complete conversation artifact, with durable domain adoption.
- [ ] Connect application admission and dispatch to the complete artifact;
  preserve editing, retries, cancellation and existing helper behavior.

These are executable components exercised by the native interpreter, not a second
viewer catalog. **They are not yet application workflow conversions.** The
application still admits partner turns to the legacy executor; no helpers were
removed or silently bypassed. No legacy implementation was deleted.

Verification for this batch:

- Full native suite before the final composition API extraction: **1,104 passed,
  6 ignored**, no failures. On the final source, all **4 reply/reading component
  tests** and **3 translation operation tests** passed, including enclosing-graph
  execution. The full suite was not repeated after that extraction.
- Final Clippy (`--lib --tests -- -D warnings`), fast validation and documentation
  entry-point links passed. Native binary checks passed.
- No running-application conversion or acceptance is claimed. Changes remain
  uncommitted; legacy execution remains in place.

### Shared inputs and revision-erasure review

Source implementation: native prose now uses shared, typed text-transport settings
under `ai/transport/graph_text.rs`. Contract identities, shapes and captured values
are preserved; malformed or absent fields return structured faults rather than
indexing missing values. Translation prompt construction now consumes an explicit
four-field semantic request (passage, source language, destination language and
destination writing guidance). Existing callers retain the same prompt and response
validation behavior. Neither extraction switches a workflow's executor.

The former selective-erasure prerequisite was explicitly superseded by the user.
Its implementation was removed. The current policy retains superseded graph
history while removing discarded product exchanges and their publication authority.

### Conversation conversion: reply ownership checkpoint

- [x] Replace coach-only reply publication with one channel-owned reply adapter.
  Coach, partner reply and partner opening effects bind their node/output to a
  required generated-text port in the actual executable artifact. Missing nodes,
  ports and incompatible output contracts reject admission atomically.
- [x] Apply the same current-authority checks to all three declared reply channels.
  Node identity comes from the declared effect, rather than a hard-coded coach
  node name. The provider operation contract and source/access checks remain required.
- [x] Add consecutive workspace format 61. Rebuild effects/publications inside
  the existing migration transaction while preserving their identities, messages,
  historical attribution and awards. New role/channel mismatches are rejected;
  ordinary partner replies/openings do not receive coach exploration credit.
- [x] Remove the native transport adapter's hard-coded prose output mode. Callers
  pass the existing explicit prose/JSON-schema contract; schema, token budget,
  wire identities and response evidence use the shared transport. This enables
  structured branch handlers without introducing a second HTTP implementation.
  Domain response validation and branch handler registration remain subsequent work.
- [ ] Compose the complete partner graph with typed reading, assistance and
  assessment dependencies, and connect partner admission, dispatch and publication.
- [ ] Connect revision/regeneration and explicit helper requests to that ownership;
  verify cancellation, restart and one-time learning publication before app testing.

The checked items are shared native ownership/publication/transport work. They do not
mean partner workflows have switched executors: application scheduling remains
coach-only until the complete dependent graph is connected. No legacy helpers are
silently omitted to make a partial partner conversion look complete.

Verification: the full native suite after the reply-role migration passed
**1,090 tests, zero failures, six ignored** (330.83 seconds), including upgrades
from every supported starting format, restart and fresh-schema equivalence. The
subsequent explicit structured-transport change and strengthened declaration-error
assertion passed **25 focused publication/transport/coach tests** on the final
source. This includes a real loopback request preserving JSON schema/token budget,
native wire identities, completed text and redacted response evidence. Final fast
validation, native binary checks, Clippy and documentation links passed; generated
contracts remained unchanged. No UI change, running-app acceptance, legacy removal,
comparison baseline, commit, push or deployment was performed in this checkpoint.

This checklist records source implementation separately from acceptance. Earlier
checkpoint results below describe their own historical trees.

- [x] Plain and guide-backed coach commands stage finalized prompt inputs, user
  message, effect ownership and receipt before native Begin commits the command.
  Converted turns create no legacy operation rows. Receipt replay returns the
  original admission; rejected graph storage rolls back the entire command.
- [x] Application scheduler claims native work, permits local computation without
  a network slot, and holds the shared chat permit for provider execution. Secret
  and protocol awaits are followed by native/current-domain authority checks.
  Provider execution uses the existing grouped transport and durable wire IDs.
- [x] Native settlement retains classified response metadata and protected text.
  Changed streaming prefixes are persisted at most four times per second; final
  reports remain distinct from message adoption. Publication and one-time credit
  commit through the native owner-checked Adopt transaction.
- [x] Cancel, pause, resume and explicit retry route to native state. Restart
  exposes interrupted producers as unknown without resending. Legacy empty-operation
  projections cannot declare a native turn successful. Usage counts native producer
  executions once, including cancelled producers with retained metadata.
- [x] Coach definitions and run snapshots feed one generic artifact renderer.
  Data, control, guard and graph-boundary bindings determine persistent geometry;
  attempts never decide node or edge existence. Native ownership identifies the
  coach panel independently of operation names. Protected previews and classified
  response details are inspectable separately from graph state.
- [x] Native single-step: the paused run grants one eligible node permission,
  consumes it on adoption/failure and revokes it on explicit pause/resume, cancellation
  or restart. Core inspection reports step eligibility and the selected node;
  AI activity controls consume those facts directly. Capacity, global pause,
  refusal holds and current provider authority remain enforced. Retry preserves
  immutable captured inputs and does not silently substitute changed access.
- [x] Native run timeline: structure, live state and historical revisions use the
  same artifact renderer. Read-only historical frames come from native replay;
  the UI does not derive their state from operation rows or event names. Exact
  owner routing, paginated reads and retained unavailable-catalog inspection are
  connected through generated contracts and workspace IPC.
- [ ] Complete inspection acceptance: unify the remaining definition/run navigation,
  expose original request inspection and its credit behavior, and provide retained
  request/response inspection for unavailable executable catalogs. Check rendered edges in the
  running app across resize, phone, pop-out and run switching.
- [ ] Exercise the application host against the loopback service, including
  credential/protocol interleavings and final response cleanup. Transport, native
  command/publication and core recovery tests cover distinct boundaries today.
  Finish refusal-policy delivery to related turns and current-authority rejection
  handling; retaining a classified refusal is not the same as applying its hold.
- [x] Resolve the six previously recorded activation/default-policy regression
  failures. Default activation tests now include automatic reading; on-demand
  cases select that policy explicitly. Migration assertions retain the original
  format-47 reading choice rather than comparing it with today's fresh defaults.
  No stored reading choice or production activation policy was changed.

### Routing and timeline verification checkpoint

- Full native library suite: **1,087 passed, 0 failed, 6 ignored**, 385.45 seconds.
  This includes multi-catalog ownership/restart, retained historical reads and all
  six corrected activation/default-policy cases. Final refinements to the timeline
  sampling key and archive-corruption assertion are verified separately by the
  native graph suite; the full run predates those refinements.
- Affected UI and IPC-registration suites: **71 passed across 13 files**. History
  selection uses native frames, preserves selection while paging, rejects foreign
  engine/run/artifact identities and excludes live text/actions from past frames.
- Final fast checks, Clippy, native binary checks, generated contract checks,
  TypeScript/Vite build and documentation links passed. The existing Vite large
  bundle warning remains. UI tests required the approved unsandboxed invocation
  because sandboxed esbuild could not resolve the workspace configuration.
- The user reported a working coach-panel request before this batch. The new
  timeline has automated coverage but no running-application acceptance yet.
  Remaining product workflows still use legacy execution; its removal is not
  complete. No comparison baseline, commit, push or deployment was created.

`execution/graph_runtime/` owns application partitioning and transaction adapters;
`application/graph_execution.rs` owns asynchronous host capabilities. Neither
defines a second readiness algorithm. The handler slot binds one host capability
per workspace lifetime; the executable artifact and implementation identity remain
the ones compiled by `coach_graph.rs`.

Initial host limits are finite: 4,096 retained runs, 32,768 attempts/executions,
32 MiB checkpoint, 4,096 suffix events, 2 MiB settlement, and 512 MiB/100,000 events/
4,096 segments of history per partition. The host compacts at one quarter of the
checkpoint byte/event ceilings. These are explicit implementation bounds, not a
complete memory guarantee or a finished long-history rollover policy. Exhaustion
fails explicitly; compaction never discards retained history.

Coach integration verification before the single-step extension:

- Full native library suite: **1,067 passed, 6 failed, 6 ignored** (1,079 total,
  328.31 seconds). The remaining failures are the five previously recorded
  activation/default-policy cases and baseline migration reading-default case.
  Four legacy-coach test assumptions exposed during integration were converted
  to native fixtures or graph-aware queue accounting and now pass. This remains
  a failing full suite, not a release gate pass.
- Five focused native-coach/stream-transport tests passed, including command
  rollback and receipt replay, one-time publication/credit, interrupted recovery
  and explicit retry, retained streaming cancellation and producer usage.
- Affected UI tests: **62 passed**. Includes static data/control/guard/boundary
  connections, disabled nodes, edge-identity collisions and native coach ownership/
  preview handling. React Flow component coverage is mocked; this does not prove
  rendered edge geometry in the application.
- Clippy for library/tests, native binary checks, final fast validation, generated
  contract checks, the TypeScript/Vite UI build and documentation link checks passed.
  The build retains the existing large-bundle warning. Sandbox restrictions blocked
  esbuild config resolution on some local attempts; the authorized unsandboxed
  UI build and regression commands passed on the final source state.
- The protected report stays in application memory if settlement acknowledgement
  fails; it is not automatically resent. Explicit reset clears that buffer. This
  does not promise durability after a failed storage commit or process exit.
- No running-app or live-provider acceptance is claimed. No commit, push, release
  or deployment was performed.

## Single-step acceptance checkpoint — 2026-10-09

The [native step contract](ai-graph-core-semantics.md#single-step-extension-2026-10-09)
is implemented. Core cases cover a chain with a sibling, on-demand activation,
failure and explicit retry, shared/retained results, capacity holds and interrupted
recovery. Durable cases cover compaction/replay, format downgrade rejection,
transaction rollback and cold run records. Command cases cover two-step coach
execution/publication, receipt replay, explicit pause/restart revocation and
current authority checks after asynchronous waits.

Final-state verification: **169 graph-core tests, 4 native step tests, 5 native
coach/transport tests and 65 UI tests passed**. Clippy (`--lib --tests -- -D warnings`),
native binary checks, generated-contract checks, UI build, fast validation,
documentation links and diff whitespace checks passed. The UI build still reports
the existing large-bundle warning.

The broad native run reported **1,077 passed, 7 failed, 6 ignored** (1,090 total,
375.63 seconds). One failure was its unsupported-future-format fixture still using
format 8; that fixture now uses format 9, and its final-state graph-core rerun passes.
The other six are the previously recorded five activation/default-policy cases and
the baseline migration reading-default case. The whole suite was not repeated after
that fixture-only correction; this is not a clean full-suite or release result.
No running-app/live-provider acceptance, commit, push or deployment is claimed.

The UI has Pause, Step, Resume exchange and Cancel controls for pending native
runs. Step availability comes directly from native inspection, with additional
product hold/global-pause gates. No graph or scheduling rule is reconstructed in
the UI. The graph continues displaying the complete executable artifact.

Running-application acceptance remains open: in AI activity, pause a pending coach
run and use Step. One eligible node should complete while the turn stays paused;
the remaining nodes and all edges stay visible. A prepared or available node can
be selected before new work, so a step can adopt a result without calling a provider.
To inspect a run from its first node, pause AI globally before asking the coach,
pause that individual run, then remove global pause before stepping it.

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

## Findings before the coach conversion

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

These findings describe the pre-conversion paths and the requirements they supplied.
Paths above are relative to `native/src/` except viewer files, which live under
`ui/src/features/activity/`. Findings are source inspection, not running-app tests.
The current workspace schema is **60**, as declared in
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
ownership in format 58; accepted-effect/publication records are installed in format
59 and producer wire identities in format 60. The audit also identified
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

### Streaming transport bridge checkpoint — 2026-10-09

Implemented `ai/transport/graph_request.rs`: an already-authorized graph producer
can now execute through the existing grouped HTTP/NDJSON transport, including
provider-frame reconstruction. It consumes the caller's captured TextRequest and
wire identities; it neither creates identities nor selects settings or retries.
Provisional text goes to the native invocation capture and cannot satisfy an
output port. Item metadata is classified and observed when the item arrives,
before the enclosing stream reaches EOF.

The returned transport outcome retains the original item result, enclosing stream
result and capture failure separately. A valid item followed by a missing final
stream marker retains both its completion and the later transport diagnostic.
An interrupted response retains its accepted provisional text and failure facts.
Capture limits cannot silently turn missing evidence into a successful graph
result, and the original provider completion remains available to the host.

Loopback HTTP tests execute the actual typed coach graph with this transport,
covering success, malformed provider output, interruption, missing final marker
and evidence-budget exhaustion. They verify supplied wire identities, protected
stream text, retained metadata and diagnostic redaction. These are not command,
live-provider or UI acceptance tests.

The production command still uses legacy admission and scheduling. The command
coordinator must stage the action receipt and hand its owned transaction to native
graph admission for one commit. The application host must own provider permits,
secret/protocol awaits, post-await native/domain authority checks, observation
commits and terminal publication. This bridge performs no independent commit and
does not replace those obligations. Command/scheduler conversion and viewer
wiring remain the next delivery work; no application flow is declared converted.

The command trace also confirms that `AskGuideCoach` augments the captured coach
system message after `ask_coach` returns. Graph admission must therefore capture
the finalized inputs after the complete command handler, before the receipt's
single commit. Compiling the run inside `accept_coach` would omit the guide
attachment. Both plain and guide-backed coach commands need admission/replay and
rollback regressions when this boundary is connected.

Verification on this checkpoint:

- Loopback transport and dependency-boundary regressions: **4 passed**.
- Final fast gate and Clippy (`--lib --tests -- -D warnings`) passed. Native binary
  and generated-contract checks passed; the subsequent correction moved only the
  integration test file into its owning `tests/` directory.
- Full native suite: **1,063 passed, 6 failed, 6 ignored** (1,075 total,
  345.39 seconds). The same five reading-activation failures and baseline migration
  reading-default mismatch remain. An initial run caught the test-file placement
  error and was stopped; the corrected full run passes the boundary check without
  weakening it. The overall suite remains non-green.
- Documentation entry-point links and tracked/new-file whitespace checks passed.
- No live-provider or running-app/viewer acceptance is claimed. Changes remain
  uncommitted; no commit, push, release or deployment was performed.

### Structured response evidence checkpoint — 2026-10-09

Implemented the generic structured-evidence extension specified in the
[core profile](ai-graph-core-semantics.md#structured-response-evidence-extension--2026-10-09).
`ClassifiedJson` preserves the classified JSON tree without changing graph port
types, topology, operation identity or execution semantics. Adapter responsibility
for sensitivity is explicit; the core's existing byte budgets still apply.

`ai/transport/graph_evidence.rs` captures partial diagnostics, provider completions
and AppError details through the existing bounded response-redaction policy.
Nested metadata and explicit redaction/truncation markers survive, including
fractional costs, null counts, arrays and validation causes. Completion text is
always included in exact redaction; the host must supply other source and secret
strings. Successful completion exposes validated token counts with their provenance.
No total or billing charge is inferred. Failure retains the entire classified
diagnostic structure, including partial provider metadata and refusal information;
the original AppError remains the host's domain error, not a core Fault string.

New structured observations atomically select checkpoint format 7 and execution
record format 4. Older representations keep their exact encodings; replay rejects
structured values disguised as older checkpoint versions, including after
compaction. Existing independently versioned readers remain supported. There is
no SQL schema change or rewrite of existing workspace records in this checkpoint.
The new format is selected only when new evidence is committed.

This closes the representation/adapter gap identified below. Host invocation,
observation commits, stream ordering, command admission, scheduler conversion and
viewer integration remain pending. No application provider call is claimed.
Production admission must budget the complete serialized report, including
structured metadata, provisional text and outcome. Fixture settlement limits are
not production defaults. Rejected oversized evidence remains the caller's
responsibility; the core neither truncates it nor commits a substitute success.
Verification on this checkpoint:

- Focused graph/transport suite: **164 passed**. The subsequent final-state full
  run also covers the extended previous-format continuation and capture-budget tests.
- Final fast gate, Clippy (`--lib --tests -- -D warnings`), native binary and
  generated-contract checks passed.
- Full native suite: **1,060 passed, 6 failed, 6 ignored** (1,072 total,
  401.31 seconds). Failures remain the same five reading-activation cases and
  baseline migration reading-default mismatch. The full suite remains non-green;
  no defaults or assertions were weakened.
- Documentation entry-point links and 34 local links across the changed graph
  notes passed. Tracked/new-file whitespace checks passed.
- No live-provider, running-app or rendered-viewer verification is claimed.
  Changes remain uncommitted; no commit, push, release or deployment was performed.

### Current authority checkpoint (preceding)

Implemented `conversations/execution/graph_authority.rs`. Native provider Dispatch
checks the actual work's operation/artifact, exact engine/run/artifact/scope owner,
coach effect, live conversation/contact, active turn, current source ownership,
pause/hold state and current AI destination/credential before the transaction can
expose an invocation. Rejected claims retain the prepared native state and create
neither wire IDs nor publications. Domain AppError details remain available to the
host alongside the core's bounded rejection signal.

The same owner check has a separate adoption phase. Pause prevents new dispatch;
it does not revoke an available result. Adoption still rejects changed credentials,
missing sources and mismatched owner scope/artifact/engine, while message and award
publication remain atomic. The API requires the original native producer inputs,
not inputs rebuilt from today's settings. It requires an owner transaction.

Two existing rules now have single shared implementations: destination/credential
comparison in `ai/connections/access.rs::check_captured`, used by the production
legacy scheduler and graph authority; and source membership in
`execution/source_authority.rs`, used by legacy dispatch and graph authority.
Captured model selection is unchanged. `access.rs` remains the existing 691-line
capability/settings owner including its tests; this small extraction stays with
that owner rather than starting an unrelated large-file reorganization.

This is the domain half of the host boundary. Native state still governs
cancellation, readiness and current consumer/attempt identity. The eventual host
must recheck those native facts and domain authority after asynchronous credential
or protocol waits. The existing scheduler's delayed-probe regression exercises its
shared access check; the graph scheduler itself is not connected yet.

Response metadata mapping remains unfinished. Existing transport diagnostics carry
nested information beyond the core's scalar additional-evidence values. The
production adapter must preserve the useful structured information and explicit
redaction/omission markers rather than treating a bounded Fault as the entire error.
No metadata adapter, live provider integration, schema change or UI change is claimed
in this checkpoint.

Verification on this checkpoint:

- Focused publication, source-authority and scheduler regressions: **15 passed**.
- Final fast gate, Clippy (`--lib --tests -- -D warnings`), native binary checks
  and generated-contract checks passed.
- Full native suite: **1,054 passed, 6 failed, 6 ignored** (1,066 total,
  364.03 seconds). The same five reading-activation failures and baseline migration
  reading-default mismatch remain; the full suite is not green. No assertions or
  defaults were changed to conceal these failures.
- Documentation entry-point links and 23 local links across the changed graph and
  migration notes passed. Tracked and new-file whitespace checks passed.
- No running-app, live-provider or viewer verification is claimed. Changes remain
  uncommitted; no commit, push, release or deployment was performed.

### Producer wire identity checkpoint

Implemented `ai/transport/graph_identity.rs` and additive workspace migration
**59 -> 60**. A native producer's `(engine, execution)` key binds exactly one pair
of hosted-compatible wire attempt/operation IDs, its artifact and versioned
operation contract. This is transport provenance, not a second execution model.
The API stages the binding in the native Dispatch owner transaction, only for
provider work. Repeated binding returns the existing pair. The host may expose
the invocation only after the complete graph/domain transaction commits.

The read adapter verifies the full invocation identity. It does not create missing
bindings, choose a destination, resolve a secret, authorize a request or resend it.
Recovery retains the original IDs; explicit retry creates a fresh producer and
fresh wire IDs. Native IDs remain canonical decimal text without floating-point
conversion. SQL rejects invalid IDs and updates; wire IDs are unique across native
producer bindings. Bindings are owned by the engine and removed only with its
conversation lifecycle; no source text, credentials or learner awards live here.
Compaction/eviction must not erase these bindings. Migration adds an empty table
and preserves existing native bytes and domain history without inferred requests.

The coach SQL integration fixture now binds IDs in real native Dispatch commits.
Tests cover record-write rollback after binding, repeated binding, exact lookup,
foreign artifact/operation rejection, immutable and canonical SQL values,
conversation deletion, recovery without resend and distinct explicit-retry IDs.
Migration tests cover rollback, byte preservation, fresh-schema equivalence and
all supported starting versions through the existing graph-storage upgrade suite.

This still does not connect the application scheduler. Current access/source
authorization, metadata classification and retention, batching/streaming, admission
and native turn status/control routing remain host integration work. The binding
is not evidence that an external request was actually sent or billed.

Verification on this checkpoint:

- Final focused publication/identity/migration regressions: **13 passed**, including
  the graph-storage upgrade/reopen test for every supported starting format.
- Full native suite: **1,051 passed, 6 failed, 6 ignored** (1,063 total,
  342.19 seconds). The same five reading-activation failures and baseline migration
  reading-default mismatch remain; no additional failures. The full suite remains
  non-green. No assertions or product defaults were weakened.
- Final fast gate, Clippy (`--lib --tests -- -D warnings`), native binary checks,
  generated-contract verification, documentation entry-point links and tracked/new
  source whitespace checks passed. A transient Windows file-mapping lock interrupted
  the initial formatter invocation; the retry and final formatting gate passed.
- No live provider, application scheduler or UI acceptance is claimed. Changes
  remain uncommitted; no release version change, push or deployment was performed.

### Coach executable and typed provider boundary checkpoint

Implemented `conversations/execution/coach_graph.rs`: the versioned executable
composes the shared context validator and `conversation.generate-prose`. Its
`context -> reply` dependency is an actual typed output binding, not an additional
control edge or viewer declaration. The same artifact is inspected before runs,
while blocked, after failure and after adoption. Local validation proceeds with
zero provider capacity; provider work requires adopted context and provider capacity.

`conversations/execution/prose.rs` supplies the typed host boundary. Captured ports
contain context, target, optional credential reference, install identity and
temperature. Credentials themselves are resolved by the host. Temperature uses a
canonical round-trip decimal spelling under an explicit semantic contract because
the graph value algebra has no floating-point primitive. Range validation is shared
with the existing transport payload builder. No opaque JSON port or new core value
type was introduced. The generated-text output is a computation result; existing
conversation validation still governs whether it can be published.

The provider callback receives native invocation identity and bounded response
evidence/provisional sinks. It must retain full domain diagnostics before returning
a bounded graph fault. The callback is **not yet bound to the application scheduler**:
production metadata classification, streaming and current-authority handling remain
outstanding. Wire attempt/operation IDs must be durably associated with the producer
by that host, not synthesized from a consumer ID or regenerated after restart. The
request adapter accepts those IDs and projects to the existing `TextRequest`, keeping
the transport/batching implementation reusable.

The SQL publication tests now use this executable with a fixture provider rather
than their former single local echo node. They cover local adoption, provider claim
and settlement, atomic publication/credit, publication rejection, record rollback,
cancelled-result rejection and recovery of an interrupted producer as unknown. They
create no legacy operation rows. This is deterministic native integration evidence,
not a running coach workflow or live provider verification.

Production admission, provider host binding, native turn status/recovery/control
routing, statistics and viewer delivery remain required. No workspace format change
or new user-facing surface in this checkpoint.

At this checkpoint the next host boundary needed a producer-to-wire identity association
(implemented in the subsequent checkpoint above).
The existing hosted transport accepts timestamp/UUID attempt IDs and UUID operation
IDs (`ai/identity.rs`); native engine-local IDs are not interchangeable with them.
The host must create and retain wire identities in the same owner transaction as
native Dispatch, before exposing the invocation, and preserve them on recovery.
The later format-60 migration supplies that association; this earlier executable
checkpoint itself introduced no durable SQL association.

Verification on this checkpoint:

- Focused executable, context, SQL publication and transport-payload regressions:
  **21 passed**. The first compile exposed two test-only BTreeMap mutation errors;
  these were corrected before the passing focused and full runs.
- Full native suite: **1,047 passed, 6 failed, 6 ignored** (1,059 total,
  571.62 seconds). The same five reading-activation failures and baseline migration
  reading-default mismatch remain. There are no additional failures; the full
  suite remains non-green and no assertions/defaults were weakened.
- Final fast gate, Clippy (`--lib --tests -- -D warnings`), native binary checks,
  generated-contract verification, documentation entry-point links and tracked/new
  source whitespace checks passed. No UI source changed, so no UI build was run.
- No running application, live provider or rendered-edge acceptance is claimed.
  Changes remain uncommitted; no push or deployment was performed.

### Shared context operation checkpoint

Implemented in `conversations/execution/context.rs`: one context-refinement
function now serves the production legacy dispatcher and a registered native graph
operation. Coach and persona contexts do not have separate validators. Reply,
opening and seeded-opening are explicit input variants, preserving existing prompt
roles, opening-source restrictions, the 43-message limit and 96,000 UTF-8 byte limit.
Text, ordering and source identities are returned unchanged.

The operation has distinct versioned captured-context and validated-context port
contracts with a closed record/list shape. Equal structural shapes do not permit
bypassing the refinement through a direct wire. It declares local admission and
exact reuse; it has no database, provider or viewer dependency. Source authorization
is deliberately not a property of its reusable output: the owner must check source
availability in the admission/dispatch transaction, including when reusing a result.
The existing production SQL authorization check is retained and tested separately.
Graph rejection details contain closed reasons and structural paths, never prompt
content or rejected role/kind text.

This is a production validation seam plus native operation registration, **not a
converted coach workflow**. The small executable in its tests is only a test fixture.
The production coach executable, provider binding, command enlistment, host lifecycle
and viewer integration remain required for the delivery milestone. No runtime route,
workspace format or user interface changes in this checkpoint.

Verification on this checkpoint:

- Affected native regressions: **25 passed, 1 intentionally ignored**, covering
  the shared operation, transactional source rejection, history initialization,
  openings, phrase starts, guide actions and channel ownership.
- Full native suite: **1,041 passed, 6 failed, 6 ignored** (1,053 total,
  463.07 seconds). The same five reading-activation failures and baseline migration
  reading-default mismatch remain; there are no additional failures. The full suite
  is still non-green. No assertions or product defaults were weakened.
- Final fast gate, Clippy (`--lib --tests -- -D warnings`), native binary checks,
  generated-contract check and documentation entry-point links passed. Tracked
  whitespace and the three new source files' whitespace/conflict checks passed.
- No live provider, production coach-graph execution or running viewer check is
  claimed. Changes remain uncommitted; no push or deployment was performed.

### Channel consumer checkpoint

Conversation prompt history, partner context, coach evidence sources, message
snapshot channels/pagination and version-history entry now use declared turn
ownership. Revision eligibility/counts and suffix preservation use that same source.
A graph coach exchange no longer depends on fabricated legacy operation rows to
remain visible in its channel or survive a persona revision. Unknown historical
channels remain unclassified; source records and the turn-history entry remain.

Persona admission conversion remains unfinished. The previous graph-suffix
revision guard has been removed under the user's revised retention policy.

New regression fixtures create a real native empty artifact/run and independently
seed retained domain messages. They exercise the actual command/history/revision
readers without legacy operations, including guide continuity, persona-prompt
exclusion, receipts, native checkpoint preservation and reopening. They do not
claim to run the production coach workflow; graph publication has its separate
native-adoption tests at the preceding checkpoint.

Verification: the affected history, revision, guide and snapshot selection
passed **31 tests, with 1 intentionally ignored export test**. Clippy (`--lib
--tests -- -D warnings`), final fast checks, native binary checks and generated
contracts passed. Documentation entry-point links, 15 local note links and
tracked/new-file whitespace passed. The full native suite finished with **1,035
passed, 6 failed, 6 ignored** (1,047 total, 523.86 seconds). The same five existing
reading-activation failures and baseline migration reading-default mismatch remain;
no new failures appeared. The overall suite is still non-green. The four new
channel-owner regressions and existing revision/guide/pagination tests passed.
No product defaults or assertions were weakened to hide existing failures.
Changes remain uncommitted; no commit, push or deployment was performed.

No schema/version change is required for these reader and revision changes.
Next are production coach host/access/provider wiring,
native turn-state projection, executor-aware recovery and usage accounting. The
existing legacy activity builder has not been converted by changing message-channel
queries, and no new running UI is claimed.

### Accepted publication checkpoint

Format **58 -> 59** adds immutable domain effects and accepted-publication
provenance. A coach-reply effect captures its turn/node/output binding, scope,
language/variety and stable award source at Begin. The migration creates no
historical effects, messages or awards. Its SQL is frozen separately from the
current schema; old migration steps remain unchanged.

The conversation publication adapter consumes native Adopt authority and values,
checks engine/run/artifact/node/scope against the effect, rejects unavailable
conversation/contact/turn ownership, and requires the host's current-access
callback. It uses the existing reply validator and learning exploration policy.
Message, publication, award and revisions are staged in the graph adapter's single
transaction. No legacy operations or second scheduling/status model are created.
Turn summaries still need their native projection during actual workflow wiring.

The native integration fixture exercises Begin, dispatch, invocation, settlement,
adoption and recovery through the real SQL adapter. It retains full domain errors
alongside the core's bounded rejection signal; production error delivery must do
the same. Failure injection covers revoked access, archived/invalidated sources,
award insertion and native record writes after domain staging. Tests also cover
first-admission rollback, immutable attribution, rejected reply diagnostics,
canonical lossless u64 identities, duplicate credit and conversation deletion.

Verification: **15 focused tests passed**, including six new publication
and migration cases plus existing ownership/coach cases. Clippy (`--lib --tests
-- -D warnings`), native binary checks, generated contracts and the final fast
gate passed. Documentation entry-point links, 22 local note links, tracked/new-file
whitespace and current/frozen SQL equality passed.

The full native suite completed with **1,031 passed, 6 failed, 6 ignored** (1,043
total, 532.06 seconds). All new publication tests and supported-version graph
storage upgrade/reopen tests passed. The failures are the same five existing
reading-activation cases and baseline migration reading-default mismatch recorded
at the preceding checkpoint. The full suite remains non-green; no assertions or
product defaults were changed to hide those failures. No running-app or live-provider
verification was performed. Changes remain uncommitted; no commit, push, deployment
or application release-version change was made.

These are executable adapter tests, not the actual production coach handler or a
running app. Next are channel/history/revision
consumers and production coach host, authority and provider wiring. The viewer
remains a later direct native projection; no UI artifact is ready to inspect.

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
cannot erase source from the present immutable archive chain. The user now explicitly permits retaining that superseded history; it is not a conversion prerequisite.

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
