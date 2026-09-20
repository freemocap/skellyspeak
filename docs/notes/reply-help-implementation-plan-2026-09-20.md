# Reply help: integrated implementation plan

Status: proposed implementation specification, prepared at the user's request on
September 20, 2026. Application changes below are not implemented by this planning
pass. This supersedes the pasted three-layer plan, including its unsafe rollback
instructions. The [audit](reply-help-plan-audit-2026-09-20.md) remains a historical
assessment of the inspected tree. No commit or deployment is authorized.

## 1. Product behavior and ownership

The composer shows one automatic, source-bound explanation of what the partner
means or asks. Below it, **Explain grammar** and **Suggest a reply** are independent
disclosures. The first deliberate opening of either requests that help if absent.
Subsequent openings display its saved result or current operation state. No render,
mount, hover over an action button, or preview initialization requests assistance.

Grammar explains zero to two patterns in the partner's actual message. Suggestions
retain the restored behavior: two full replies, two frames with blanks, and two
starters. Insert appends to the draft using the current page behavior; it never
sends. Word help, translation and sound controls never insert. Suggestions and
grammar are assistance, not observations about learner ability and not XP events.
Existing insertion-source evidence remains intact.

The source is the accepted assistant message and its turn, including an opening
message. Reply help must not bind itself to an array index or the draft. A new
message resets disclosure state. A failed/slow brief must not prevent either
explicit request. Changing the draft does not regenerate help. Editing/resending
the source turn invalidates publication to the old source through existing rules.

The composer targets the latest eligible partner turn. Saved older help remains
inspectable in Analysis. Analysis gets the same explicit grammar action for its
selected message; opening Analysis alone does not request grammar. Historical
unreplaced messages can receive grammar on request. Archived, deleted, cancelled,
invalidated or replaced sources cannot authorize new work. Already saved results
remain readable wherever existing history policy permits.

Ownership stays with conversation support/execution in native code, conversation
views/composer in UI code, and shared reading components for reading interactions.
No new provider client, independent suggestions cache, dictionary, token popover,
audio player, or storage subsystem is introduced.

## 2. Data contracts: preserve the active producer

Current mapping, verified in source:

| Producer | Durable location | Snapshot | UI projection |
| --- | --- | --- | --- |
| reply_assistance | turns.context.reply_assistance | ChatMessage.replyAssistance | assistant.assistance |
| reply_explanations | turns.context.reply_explanations | ChatMessage.replyExplanations | currently copied to mechanics |
| retained coach_suggestions | turns.context.coachReplies | ChatMessage.suggestedReplies | scaffolds.replies |

The last row is a different producer. Do not select it as the replacement for the
first row, merge both arrays, or rerun its retired producer to fill the new tray.
Existing consumers of retained records are outside this bounded change.

### Final native shape

- Add `ReplyBrief { explanation: String }`, serialized as an object, stored at
  `turns.context.reply_brief`.
- Preserve `AssistedReply { text, translation, romanization, pronunciation }`.
  These are whole-passage values, not token annotations.
- Final `ReplyAssistance` contains `replies`, `frames`, `starters`. Move its
  `explanation` into ReplyBrief; do not keep generating a duplicate brief when
  suggestions are requested. Bump this operation's contract/prompt version.
- Preserve `ReplyExplanations { cards: Vec<ReplyExplanation> }`, including valid
  empty cards and the existing exact-source quote validation.
- Add ChatMessage `replyBrief`, `briefState`, `briefError`, following existing
  optional result/state/error conventions. Keep replyAssistance and
  replyExplanations as the canonical results for these operations.
- Export a reusable native reading-scope value with the four existing ReadingInput
  scope fields (`language`, `variety`, `explanation`, `explanationVariety`) and
  expose the saved help's scope in the message projection. Populate it from the
  turn's captured language context/practice settings, never today's global picker.
  Reuse native pair resolution; do not duplicate language defaults. It must be
  structurally compatible with the UI's existing ReadingScope.
- Use the existing TurnView.operations and attempts for operation IDs, state,
  attempt diagnostics, pause and hold context. Do not add a second job database or
  persist a UI-specific loading enum.

Rust owns the wire types; run the contract exporter. Add a typed help projection
under `ui/src/domain/conversation/` using generated result types directly. Do not
cast optional `Mechanic.quote` into required `ReplyExplanation.quote`. Keep other
StoredTurn consumers working through explicit projection; decomposing all of
types.ts/model.rs is outside scope.

During the presentation-only checkpoint, read the brief from the existing
replyAssistance.explanation and render its actual replies. Only the later native
contract checkpoint switches to ReplyBrief. This is staging, not a lasting
compatibility fallback.

Development records need no conversion. If changing the strict serialized contract
makes saved development contexts unreadable, use the repository's clean-schema
version/reset mechanism with an explicit ownership-aware error. Do not silently
deserialize the old shape, migrate it, or indiscriminately erase the shared live
workspace. Use disposable test workspaces for verification.

## 3. Reading integration and cache policy

### Rendering contract

| Content | Rendering path |
| --- | --- |
| Brief/body prose and curiosity links | shared Markdown; its MixedText support; source-bound onAsk context |
| Grammar quote/example | existing ReadingPassage/shared reading primitives; exact quote uses saved source glosses |
| Grammar title/contrast | MixedText where inline source-script text occurs; no custom tokenizer |
| Full suggested reply | ReadingPassage extended for complete passage aids; SavedGlossText/TargetText underneath |
| Frames/starters | TargetText with a separate sibling insert button |
| Explicit token annotations, when present | SavedGlossText with validated anchors |

Extend the existing ReadingPassage with a compact, explicit reply-help variant
instead of copying its lookup logic. It currently accepts translation and
romanization but not pronunciation. Add that missing passage field and use the
shared reading-preference policy. Preserve both sound fields in data; compact
help shows romanization when supported/available and pronunciation as fallback,
matching GlossHelpParts. Respect learner translation and sound visibility flags;
provide an explicit way to reveal available passage aids when not shown inline.
Avoid repeating whole-passage aids already represented by the expanded token view.

Do not wrap TargetText in an insertion button. Word actions and insertion are
independent sibling controls with keyboard access. Sending disables insertion,
not reading. Known target passages always get correct language/direction/scale;
their translations and Latin reading aids do not inherit target-script direction
or font scaling. No new parsing heuristics for mixed-language prose: reuse existing
Markdown/MixedText and the existing Analysis example handling.

### Exact reuse path

`ReadingTools` (app injection) → `ReadingHelp` (shared services/cache) →
`ConversationReadingProvider` / `SavedReadingProvider` (saved annotations) →
`ReadingPassage` / `TargetText` / `SavedGlossText` → `WordHoverHelp`, inspector,
`TokenAudio`.

Keep this provider tree stable across snapshot updates; do not mount a private
ReadingHelp for ReplyHelp. Scope the help subtree to its saved source-language
pair and varieties. Correct ConversationReadingProvider's projection where needed
so saved annotations are not relabeled using changed conversation preferences.
Carry scope in snapshot projection rather than guessing from text/script.

The lookup sequence stays:

1. Explicit, validated source anchors win.
2. Reuse exact saved passages and surface forms through savedGlossIndex, preserving
   case, accents, morphological parts, variety and alternate senses.
3. Reuse session reading results through the same ReadingHelp peek/lookup.
4. Only missing help requested through existing deliberate hover/click/keyboard,
   inspector or Word by word uses begin_reading/run_reading. Rendering a new reply
   or expanding suggestions must not prefetch all its words.

Whole-sentence translation/romanization/pronunciation cannot be turned into a
GlossSegment spanning the entire reply to simulate token coverage. Do not invent
anchors, split transliterations by spaces, or copy a source message's offsets onto
a different sentence. Novel words remain eligible for shared on-demand lookup.
If token generation is later desired with the suggestion itself, that is a distinct
validated contract change, not part of this plan.

### What is cached, and what needs tightening

- Generated help is durable per turn/operation. Reopening or restarting uses saved
  results without generation. Successful empty grammar is also durable success.
- ReadingHelp currently has a bounded 64-entry in-memory result cache, keyed by
  exact text and the four-field scope. SavedReadingProvider is a derived index,
  not another source of truth. Native ephemeral reading persists redacted receipts,
  not its source text or a durable glossary. State this accurately in docs/tests.
- Add shared in-flight coalescing for identical reading requests if concurrent
  surfaces currently duplicate them. Place it in ReadingHelp or a cohesive shared
  reading owner, not in ReplyHelp. Each consumer can cancel independently; abort
  the underlying request only when no consumers remain. Remove failed/aborted
  entries; do not negative-cache failure as success. Retain the bounded cache.
- Tie cached/in-flight reading work to workspace/session lifetime and the existing
  language/configuration identity. A workspace reset/switch clears cached sources
  and cancels old consumers; a late response cannot seed the new workspace cache.
  A display-preference or model change alone does not invalidate valid saved words.
  Verify the app provider boundary; it is not currently keyed to session explicitly.
- Reuse shared coverage and anchor validation. Partial coverage remains marked
  partial; explicit Word by word can fill gaps through the normal reading service.
  A cached known-word lookup must not start inference solely because another word
  in its surrounding sentence is unknown.
- Token speech uses TokenAudio → ReadingActions → speakSelection and the existing
  exclusive playback authority, rate/volume and cancellation. The current token
  speech path does not cache audio like durable message speech. Do not claim it
  does or add a tray-only audio cache.

These shared changes must retain existing reading tests and get cross-surface
tests; they are prerequisites for reuse guarantees, not license for a reading
system rewrite.

## 4. Durable AI workflow

### Scheduling and commands

Automatic PLAN and OPENING_PLAN include reply_brief after persona_reply or
persona_opening respectively. Remove reply_assistance and reply_explanations from
automatic creation; keep them discoverable as explicit operations in RETAINED
with no scheduler dependency (source eligibility is checked before insertion).
Add reply_brief to the partner-publication dependency release. Declarations,
executor ownership, graph definitions and snapshot descriptions must agree.

Keep RequestSuggestions; add RequestExplanations. Both go through Action → the
single store command transaction → assistance handler → execution. Share their
source eligibility/operation reuse logic in a cohesive execution assistance module
rather than duplicating turns.rs. Reuse its established public export seams.

Within one command transaction:

1. Resolve the assistant message and owning turn/conversation/contact. Validate
   published partner source, absence of replacement, and current archive/cancel/
   invalidation constraints. Never accept a learner or coach message here.
2. Return an existing operation without starting another attempt, whether pending,
   successful, failed or unknown. An ordinary disclosure is never a retry.
3. For a missing operation, enforce queue admission, resolve current chat access
   and scoped refusal holds, and insert exactly one ready operation. Existing
   UNIQUE(turn_id,kind), transactional command replay and receipts remain authority.
4. Bind this new operation to current endpoint/credential/model using the existing
   per-operation target mechanism in execution/connections.rs. Retain captured
   source text, language, difficulty and prompt context. The original turn target
   and running siblings must not be rewritten. Do not blindly copy the current
   request_suggestions implementation, which lacks this delayed-request binding.
5. Refresh the owning turn as assisting, publish normal revision/snapshot changes,
   and return the operation ID in the receipt. Commit only at the store coordinator.

### Explicit retry

Add a bounded-purpose Action `RetryReplyHelp { messageId, kind }`, where kind is a
Rust-generated enum for brief, grammar and replies. It targets only the matching
operation; it must not call whole-turn Retry and rerun failed siblings. Revalidate
the source, require failed/unknown operation state, enforce current admission and
holds, bind current access for this operation, then queue one new attempt under
the same operation. Preserve old attempts. Active duplicate retries coalesce;
successful results cannot be regenerated through Retry. No automatic retry or
lifetime retry cap is introduced. Preserve the concurrent connection-retry fixes.

Hold recovery remains the existing explicit Recover access action, including
provider retry-time enforcement. Closing the tray never clears holds, cancels a
durable generation, or retries. Normal turn cancellation/revision/archive handling
continues to stop or invalidate work and reject late publication. Window closure
can cancel ephemeral word lookups without cancelling durable reply assistance.

### Executors and prompts

Extend conversation_support ownership/schema/prompt/validation/publication for
reply_brief. Its result is one nonempty explanation, at most the existing 900-char
brief bound, in the explanation language, normally one or two sentences. Explain
the actual message/request without inventing learner facts or prescribing a reply.
Its failure is independent of grammar/suggestions.

Reply assistance keeps the v6 field-specific language guidance, exact two replies/
frames/starters, script/romanization checks and size bounds. Remove only the brief
field and its prompt requirement in the final contract. Grammar retains zero-to-two
cards and exact-source quotes. Preserve source/explanation language boundaries;
do not feed unrelated assessment/segmentation instructions into these prompts.

All three use the existing bounded exchange projection, structured-output
transport, validation, atomic publication, recovery and diagnostics. Keep standard
model routing and the current 2,048-token structured-output cap initially; do not
introduce a new role, pretend a declaration sets routing, or call the brief “cheap”
without measured usage. Check maximum-shape fixtures for truncation. A smaller
per-operation cap is optional future work requiring consistent direct/grouped
transport and diagnostics changes, not a reason to delay correct lazy scheduling.

No retry is made merely because decoding/validation fails. Capture partial useful
metadata first, then reject invalid content. No malformed/partial assistance becomes
visible as a successful result. Unknown network outcomes remain explicitly unknown.

### Cross-layer integration checklist

Review and update the concrete owners, not just string searches:

- turn_plan.rs: declarations/versions; turns or new execution assistance module:
  creation/retry; publication.rs: dependency release and source-bound publication.
- conversation_support.rs and types.rs: complete brief executor and split contract;
  dispatch.rs: routing/preparation; connections.rs: current target binding.
- model.rs/exporter, store/commands and execution/mod.rs: Actions and wire exports.
- snapshots.rs: nullable result/state/error and captured reading scope, both regular
  message and coach-message initializers; generated contracts and UI projection.
- diagnostics/inference.rs and ai_graphs.rs: operation classification, actual
  prompt/schema definitions, source/operation/attempt links and graph visibility.
- scheduler/grouped preparation and direct transport: same per-operation target,
  output schema, bounds, redaction and refusal handling on every access route.
- queue admission, refresh_turn, recovery and operation lookup: dynamic operations
  must work after a turn had already succeeded, without resurrecting invalid sources.
- schema: operations.kind is currently unconstrained text and turn/kind is unique;
  no new table is needed. Use the clean-schema policy if stored payload shape changes.
- server: verify the existing generic structured inference route accepts the new
  native schema and preserves accounting; no new endpoint or deployment is planned.

Use existing attempts/receipts for requested/actual models, request/provider IDs,
usage and actual billing provenance, timing, finish reasons, refusal/retry metadata,
validation path/expected shape, redaction/omission/truncation markers. Keep these
available through ConversationErrorScope/ResponseDetails and AI activity. Never
reduce retained errors to a string or echo response content into error summaries.

## 5. UI state and interaction contract

Create a pure help-state selector from the canonical message results plus its
TurnView operations/attempts. Proposed presentation states are derived only:

| Evidence | Presentation and action |
| --- | --- |
| No eligible source | No request action; existing saved view follows history policy |
| Eligible source, operation absent | Closed request action; first click queues it |
| Local command in flight | Disable duplicate submission immediately, disclosure open |
| ready / waiting_dependencies | Queued status; reopening does not submit |
| running | Generating status, independent of command promise |
| Paused / held | Actual pause/hold status and existing recovery controls; not a spinner forever |
| succeeded, result present | Saved result; empty grammar has an explicit no-patterns message |
| succeeded, required result absent | Contract/storage error, not “not requested” |
| failed / unknown | Structured error + explicit scoped retry; unknown retains possible usage warning |
| cancelled / invalidated / replaced | Stopped/unavailable; no automatic resubmission |

Local submitting ends on an observed operation or command failure, not successful
promise resolution alone. Refresh/reconcile through existing snapshot watching
after a receipt; do not introduce polling in the component. On command transport
uncertainty, reconcile state before offering a new submission. Native uniqueness
is the final protection across windows/remounts. Never reuse a stale callback's
results for a new source.

Keep disclosure open/closed state separate from operation state. Auto-reveal the
brief area once per message when it becomes pending/available unless the learner
already folded it. Both request sections start closed. A later snapshot must not
undo manual folding. Opening one section does not open or request the other.
`initiallyOpened` for fixtures controls visibility only and must never request work.
Use useId-based aria-controls so multiple previews do not share duplicate IDs.

Show the brief, grammar and suggestions errors beside their respective results;
one failed lane does not hide another. Keep reading failures in shared reading
controls. Use the same grammar result/action in Analysis without a second request
or result cache. Source-bound coach questions include the selected message/card,
not whichever conversation happens to be active later.

The brief is visually primary; peer actions have equal weight. Use existing text,
surface, border, spacing and depth tokens. Sentence case, no uppercase starter
label, no clipped/truncated target text, 44px coarse-pointer targets, visible focus,
reduced-motion behavior and RTL layout. The compact ReadingPassage variant owns
only its differences; shared reading rules stay in component styles.

## 6. Implementation checkpoints and ownership coordination

Re-read current files and diff before each checkpoint: the tree is shared with
active reading, retry, UI and server work. Do not restore whole files from HEAD.
Implement one bounded checkpoint at a time. Leave work uncommitted unless a fresh
explicit commit instruction is given. Stop at the existing queue's visual-review
gate after checkpoint B before starting native behavior changes.

**A — Repair integration without changing AI behavior.** Fix the typed ReplyHelp
API, use the active AssistedReply array, repair deleted ComposerHelp imports,
preserve all passage aids, correct pending/empty/error states and fixtures. Establish
a buildable presentation baseline. Update misleading on-demand comments. Do not
delete unrelated reading changes or the field-scoping prompt correction.

**B — Complete shared reading and presentation.** Extend ReadingPassage narrowly,
separate word and insertion actions, verify captured scopes, shared cache ownership,
coalescing and lifetime. Register ReplyHelp previews with traceable production-shaped
fixtures and a component README, regenerate design-system outputs. Verify existing
Analysis and conversation reading surfaces, then review actual wide/narrow light/
dark/RTL fixtures. AI assistance is still precomputed at this checkpoint; say so.

**C — Implement complete native lazy workflow.** Add the brief, remove automatic
suggestion/grammar creation, add requests/scoped retries/current target binding,
contract versions, snapshots and diagnostics together. Regenerate contracts and
switch the UI adapter to the new result fields in this same checkpoint. Use local
provider fixtures and disposable databases. No half-wired brief declaration.

**D — Integrate durable UI states and Analysis parity.** Wire real actions and
operation selectors, independent status/errors/retry, snapshot reconciliation,
turn changes and retained results. Complete UI and native regression checks.

**E — Verify the finished workflow.** Browser fixtures prove layout and interaction;
native operation records prove scheduling and persistence. Report each separately.
Do not label live behavior verified if only mocks ran. Update queue, component docs,
and relevant current coaching contract notes only to reflect completed changes.
Do not rewrite historical verification reports as if they tested the new behavior.

## 7. Acceptance tests and evidence

### Native tests

- Normal and opening turns automatically create/run brief, never suggestions or
  explanations. Other configured automatic tasks remain unchanged.
- Request each kind independently after source publication, including after the
  turn completed. Duplicate commands/windows create one operation and one active
  attempt; receipt replay retains existing semantics.
- New request/retry after connection changes uses current route/model/credential;
  stored language/source and running sibling targets stay fixed. Refusal holds,
  pause/step, capacity and retry-time rules still apply.
- Saved result and zero-card grammar survive store reopen with no inference.
- Failed/unknown retries affect only the chosen operation; no automatic retry.
  Cancellation, source edit/replacement, archiving, workspace ownership and late
  publication are checked at the same boundaries as other conversation work.
- Each executor validates bounds, exact quotes, script fields and strict shape.
  Invalid output retains useful safe metadata and cannot publish a partial result.
- Direct/grouped hosted/custom/own-key paths carry identical schema/target intent;
  use local HTTP fixtures, with no external provider calls in automated tests.

### UI and reading integration tests

- Fixtures originate from the active native result shapes and use the real
  conversation-view adapter; no legacy SuggestedReply stand-in for new replies.
- No request on mount/auto-open; one deliberate request per lane; delayed command
  receipt versus delayed snapshot; reopen/remount; data arrival after initial render;
  manual fold preserved; independent failures; empty grammar; late old-source results.
- Insert full reply/frame/starter appends once with correct evidence source;
  word help/translation/audio never insert or send; busy disables insertion only.
- Render actual Arabic, Mandarin and Latin-language cases under ReadingTools plus
  ConversationReadingProvider. Use a rejecting mock service to prove exact saved
  words work across message, grammar quote, reply, frame and starter with zero calls.
- Unknown-word deliberate lookup uses the shared service; reopening/reusing it on
  another surface hits the same cache. Different languages/varieties/explanation
  languages and accent/case differences do not incorrectly hit. Partial anchors,
  surrogate pairs and combining marks use existing UTF-16/linguistics conventions.
- Concurrent identical requests coalesce; one consumer closing does not abort
  another; last-consumer cancellation, errors, eviction, reset and stale completion
  behave correctly. No results cross workspace identity.
- Translation and both sound fields are retained, with current preference and
  fallback behavior; no fabricated token gloss. Speech uses exclusive shared audio.
- Analysis can request grammar for its selected source and immediately reuses help
  already requested from ReplyHelp. Neither view creates extra operations.

### Checks and visual/runtime evidence

Run relevant focused tests per checkpoint, then final UI tests/build,
previews:check, contracts:check, styles:check, styles:dead, design-system:check and
git diff --check. Run README native test/format/clippy checks appropriate to the
changed owners. Record unrelated baseline failures separately; do not report a
whole-suite pass based on targeted results. Existing retry/reading notes describe
known concurrent failures and are context, not substitutes for current checks.

Review production-component fixtures at 1280px and 380px in light/dark, plus Arabic
RTL, increased reading/script scale, keyboard and coarse-pointer controls. Check
popover anchoring and composer visibility when both disclosures are open. Capture
screenshots using traceable fixture states, clearly labeled offline.

In a disposable native workspace, record operation/attempt IDs for: partner reply
→ brief only among these three help jobs → first grammar click → first suggestions
click → repeated open/close → application restart. Verify no extra attempts on
reopen/restart. Exercise one held/failed request and scoped retry. Provider-backed
quality/usage samples, if run, are a separate explicitly reported verification;
mocked scheduling cannot establish model quality or cost savings.

Done means all three data paths are wired and independently observable, all shared
reading/cache invariants are proven, and outstanding failures/visual or runtime
gaps are stated. A green stylesheet check or attractive static preview is not the
completion criterion.
