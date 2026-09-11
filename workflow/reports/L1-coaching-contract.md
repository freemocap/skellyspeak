# Small structured private coaching contract

## Latest decision: two dependency-separated calls

This section supersedes the single-call scheduling/envelope recommendations below.
The user explicitly chose two calls for responsiveness. This is a proposal for their
minimal data contracts; no production changes or scoring defaults are introduced.

| Result | Trigger and immutable primary source | Required context | Output |
| --- | --- | --- | --- |
| Learner feedback | Saved learner message | Captured preceding exchange | Correctness, likely understandability, six-domain skill evidence, compact corrections/expression help |
| Reply suggestions | Saved partner text replying to that learner turn | That partner message, initiating learner message and captured preceding exchange | Up to two target-language reply candidates with short explanations |

There is **no dependency between these two results**. Feedback need not await partner
text, and suggestions neither await nor consume the feedback result. Both remain
private source-owned assistance; neither becomes a private-chat send that blocks the
next learner turn. Partner speech/gloss/translation do not gate either result.

### Contract A: learner feedback

Retain required correctness and understandability objects plus skill_evidence and
help from the automatic envelope below; remove next_responses entirely. Bind all
assessment evidence to the initiating learner message s0. Interpret against captured
preceding exchange only. This prevents a cooperative partner reply from contaminating
the prediction of likely understanding. Both axes support insufficient_evidence;
skill/help arrays may be empty without implying error-free language or zero ability.

Keep the proposed per-field/array limits below for discussion; no numerical scales
or proficiency judgments. Generated correction text is assistance, not source evidence.
An automatic result is due for every saved learner message even if partner generation
later fails. Failed feedback does not prevent suggestions when partner text exists.

### Contract B: next-reply suggestions

Minimal candidate:

```json
{
  "status": "available",
  "suggestions": [
    {"target_text": "Compré pan y fruta.", "explanation": "Say what you bought."}
  ]
}
```

Allowed status is available or insufficient_context. Available requires 1–2 items;
insufficient_context requires an empty list plus a short explanation-language reason
(a strict separate tagged variant). Each candidate is <=160 target-language scalars
with <=160 explanation scalars; reason <=240; raw response <=8 KiB. These are proposed
acceptance limits, not claims about measured output cost. Candidates have no skill
judgments, correctness scores, source replacement spans or claimed learner intent.
Optionality matters: selecting one is an intentional draft insertion, never auto-send.

Native ownership binds the result to the exact partner-message ID, initiating learner
message ID, conversation and captured settings/languages/variety, plus operation/attempt
and schema/prompt/model provenance. Candidates address that partner message. The model
does not return ownership IDs. No selected current bubble or latest draft is used as
an implicit source. Shared target/explanation writing guidance applies independently.

Because proposed replies are newly generated text, they do not need invented source
spans. Their contextual source references are the native-captured message IDs. The
private explanation and feedback are never injected into partner context. Explicitly
inserted wording retains suggestion-result/item attribution through subsequent edits.

### Independent validity, persistence and hydration

Each contract has its own strict raw decoder, limits, completion check, operation
identity and atomic publication. Invalid feedback fails feedback only; invalid
suggestions fail suggestions only. Do not require both candidates for a successful
transaction or hydration. Keep separate saved-result slots/status/errors keyed to
their own immutable primary source. Reopening renders whichever accepted result
exists, in any completion order, and issues zero calls. Pending/error indicators
identify the missing result rather than making the whole turn look failed.

Each explicit retry targets one original operation with its captured context/settings;
it neither reruns the sibling nor regenerates the partner. A failed retry preserves
that operation's prior accepted result. Deleting either a primary source or required
captured context revokes affected publication authority. Ordinary later messages do
not retarget already-running work. Suggestions saved on an older turn must remain
visibly associated with that older partner message; insertion into a changed draft
requires the reviewed draft action, never stale asynchronous replacement.

If partner generation fails or is cancelled before text exists, feedback still has
a valid trigger. Suggestions have no primary source and are not requested; represent
that distinctly from provider failure or an accepted empty suggestion result. Persisting
partner text once admits at most one automatic suggestion operation for its contract;
UI mount/reveal never creates it. Same policy for all five difficulties.

### Concrete complete turn for user review

Prior partner question: “Where did you go yesterday?” Learner saves
`Ayer yo ir al mercado.` Feedback can start immediately:

- Correctness: issues found, citing `yo ir` [5,10); explain the finite verb form.
- Likely understanding: likely clear; `Ayer` [0,4) and `al mercado` [11,21) support
  the past market-trip interpretation independently of the grammar issue.
- Evidence: past_reference and motion belong to proposed Time, place & movement;
  event_roles belongs to Events & participants. Other domains remain unobserved.
- Correction: `Ayer fui al mercado.` is generated assistance, never cited as evidence.

Partner text later arrives: `¿Qué compraste?` Suggestions start immediately, even if
feedback is still pending: `Compré pan y fruta.` / `Solo miré; no compré nada.` These
are alternative possible replies, not facts the app assumes about the learner. The
learner chooses or ignores them. A failed feedback attempt would not remove these
valid suggestions; a failed suggestion attempt would not remove valid feedback.

The six-domain mapping remains the separate finite review artifact
[L1-six-skill-domains.md](L1-six-skill-domains.md): merge time+space while retaining
all 21 criteria. Two calls and automatic timing are settled user decisions. Numeric
scales, XP aggregation and presentation approval remain separate; no scoring defaults.

AI coordination needs reconciliation with this new two-call decision. Prior outbound
coordination attempts were rejected by automatic approval review; this local report
does not claim a successful handoff or joint sign-off on the split.

AI Operations' latest incoming summary confirms its proposal now uses the same two
stages with no feedback-to-suggestions dependency. Its Reliability coordination adds
an essential lifecycle requirement: primary partner-reply failure must unlock Send
even while learner feedback remains running. Feedback publication must therefore
check its own source/operation authority, not require a successful parent aggregate
turn state. A failed primary reply is not source deletion or feedback cancellation.
The same distinction applies to restoring independent saved feedback after reopen.
Integration/Reliability own these gates and regression coverage.

Current reconciliation status: two schema shapes and qualitative outcomes are proposed
above; six-domain merge/all-21-criteria preservation are in the companion report;
field/byte caps are proposed, not measured or finally accepted output budgets. No
numeric scores, proficiency estimates or XP semantics are settled by this proposal.
AI's shorthand “scores” must not imply a numeric range already exists. Standard is
its proposed initial route role. Field-level budget agreement and implementation
assignment remain pending; no code or paid calls have occurred.

## Current user direction — supersedes review-first sections below

The user now requires an automatic coaching pass for every learner turn, with deeper
analysis on demand. Every pass has separate technical/grammatical correctness and
contextual understandability judgments, plus exact source-linked skill evidence.
The user changed seven domains to six; [L1-six-skill-domains.md](L1-six-skill-domains.md)
proposes the concrete consolidation and primary CEFR grounding. Everything below
this current section is historical proposal material where it conflicts with this
direction. No active contracts, catalogs, code or gamification rules have changed.

### One automatic result, two independent judgments

Propose a private source-owned assistance operation per saved learner message, not
a second private-chat send. It must not block partner response or the learner's next
turn. Deeper analysis is a separate explicit request on the same immutable source;
opening existing feedback reads the saved result. All five difficulties share the
same schema/graph; difficulty affects teaching complexity, not evidence truth.

AI Operations' incoming recommendation is one job after the contact's text publication,
parallel with speech/gloss/translation, without a next-turn dependency. Data semantics
can support that, but every learner message still needs a declared outcome if contact
generation fails/cancels: recommend evaluate its saved source and available preceding
context, marking missing reply-dependent suggestions unavailable. Do not silently
skip the coaching obligation because an optional context message never materialized.
Integration owns the precise dependency/failure policy before implementation.

For a comprehension prediction, capture the learner message and up to four immediately
preceding contact-channel messages in chronological sequence; no future-turn context.
If the newly produced partner reply is also captured, label it separately for next-response
suggestions and response-consistency discussion. A cooperative model reply is not proof
of human understanding and must not determine the predicted-understanding judgment.
Capture all IDs/roles/settings/source text; retries never substitute later context.

Proposed required assessment objects:

- correctness: outcome `no_issue_identified | issues_found | insufficient_evidence`,
  explanation-language rationale and current-message evidence ranges. Evaluate lexical,
  grammatical and orthographic form relative to selected language/variety; distinguish
  fragment-appropriate answers, uncertainty and ASR-origin uncertainty from errors.
- understandability: outcome `likely_clear | recoverable_with_effort | likely_unclear |
  insufficient_evidence`, intended-meaning hypothesis, rationale, learner evidence and
  optional captured-context references. This is a model estimate under stated context,
  not a calibrated probability or verified listener comprehension. Missing/ambiguous
  intent is insufficient evidence, not automatic poor communication.

The axes may disagree. No_issue_identified is not a certificate of error-free speech.
No numeric score range is proposed until rubric/calibration and product semantics are
discussed; do not reuse legacy 1–5 UI fields as though authorized. A future displayed
ordinal score must explicitly remain a model judgment, not a measured probability.

### Compact automatic envelope and bounds

Native-owned source/provenance surrounds:

```text
correctness { outcome, rationale, evidence[] }
understandability { outcome, intended_meaning?, rationale, evidence[], context_refs[] }
skill_evidence[] { skill_id, outcome, evidence[], rationale }
help[] { explanation|expression, evidence[], explanation, wording? }
next_responses[] { target_text, explanation }
```

Use inclusive first/last grapheme IDs for evidence and native source aliases; the
provider cannot choose private identities or its own domain mapping. Native maps
skill_id to one of the six versioned domains. Skill outcomes and assistance treatment
are specified in the companion report. Multiple skill criteria may reuse a source
range; do not confuse evidence relations with disjoint word-gloss rendering spans.

Proposed automatic limits: source 4,096 scalars; each axis rationale 240 scalars;
intended-meaning hypothesis 240; <=6 observed skill judgments with <=2 source ranges
and 160-scalar rationale each; <=2 help items with 240-scalar explanation and optional
256-scalar wording; <=2 next responses with 160-scalar target wording and 160-scalar
explanation. Raw JSON ceiling 32 KiB. These are local ceilings, not output targets
or proof everything maximal fits current 2,048-token transport. AI Operations owns
preflight/output budgeting; no automatic overflow repair or secondary judge call.
Do not force one skill observation per domain. Omitted skills remain unobserved, not
failed; more detailed coverage belongs to the explicit deeper pass.

Suggestions are generated alternatives, never evidence of the learner's skill. They
reference the captured partner reply when available, remain private until explicit
insertion/send, and carry assistance provenance. No partner reply means no invented
reply-targeted suggestions. Expression help still handles explanation-language fragments
without switching conversation language. Deeper requests may explain more, but retain
the same immutable-source/assistance rules and do not overwrite automatic evidence as
though they were independent observations.

### Status, insufficiency, exclusions and retries

Keep pending/failed/accepted lifecycle separate from semantic outcomes. An accepted
result with an insufficient axis or unavailable optional help is partial usefulness,
not malformed output. Empty skill/help/suggestion lists are legal and must not claim
available help or zero ability. Both axes can be insufficient on a name, unintelligible
transcript or explanation-language-only message. Strict shape/anchor/ownership failures
reject the entire candidate atomically; do not salvage the prose. Native counts and
field validity cannot establish the truth of the judgments.

Known assistance attaches from native records, never from model claims. App-supplied
wording can demonstrate successful assisted communication but not independent mastery.
Assessment-excluded messages still require an automatic processing outcome; do not
publish skill evidence contrary to exclusion. Integration must preserve the exact
scope of the exclusion (credit-only versus assessment prohibition), reporting the
unavailable assessment explicitly rather than erasing or bypassing the flag.

Automatic job creation is once per source/contract via existing durable admission.
Reopen is zero calls; failed/unknown attempts require explicit retry. Because this is
source-owned assistance, new learner turns must not invalidate an otherwise eligible
retry solely by existing later-turn chat rules; Integration must design that distinction
rather than reusing private-chat gates. Cancellation/deletion/authority revocation still
defeat late publication. Failure preserves source, sibling outcomes, usage and prior
accepted help. No auto-repair, XP, proficiency inference or partner-memory writes.

### Concrete example and remaining decisions

For partner “Where did you go yesterday?” and learner `Ayer yo ir al mercado.`:
correctness=issues_found (`yo ir`); understandability=likely_clear (past market trip
recoverable from `Ayer` and `al mercado`). Suggest `Ayer fui al mercado.` as assistance.
Evidence for past_reference and motion maps to Time, place & movement; actor/action
evidence maps to Events & participants. No invented evidence for the other domains.
See the companion report for exact ranges and technical-vs-semantic rationale.

Automatic every-turn and six domains are user decisions, not questions to reopen.
Still review the concrete six-domain consolidation, qualitative display versus any
later scored rubric, suggestion insertion/provenance UI, and gamification aggregation.
Trigger scheduling when a partner reply is unavailable and bounded context/provenance
are implementation decisions for Integration/AI, not grounds to stop the proposal.
No paid research/model calls occurred; authoritative web research is cited separately.

Proposal only at checkpoint b68c64a. No production code, inference, deployment,
restart, Git writes, assessment or XP rules are part of this work.

## Current behavior and missing contract

DESIGN.md permits explanation-language fragments in target-language conversation,
private reflection and draft suggestions that never send automatically. DATA-MODEL.md
requires exact learner source references and known-assistance attribution. EXECUTION.md
requires complete validation before publication and fresh source authority at commit.

Implemented AskCoach accepts conversation_id, text and expected_revision. Its graph
is local coach_context then one Standard coach_reply. execution.rs captures private
coach history plus a bounded partner exchange, settings and language context; output
is prose. The embedded partner exchange currently contains role/text but no source
message IDs. Captured sourceIds derive from selected coach history, not that embedded
exchange. Thus it is not yet a reliable source-reference catalog for structured
feedback. Private coach messages are excluded from partner context by existing tests.

## Smallest useful next slice

One explicit private coach request discusses **one immutable saved learner message**.
Keep a short conversational answer and, optionally, up to three source-bound help
items. Two item kinds suffice: explanation of an occurrence and target-language
expression wording. No grammar taxonomy, lesson plan, proficiency estimate, scores,
automatic assessment, settings actions, phrase-analysis layer or new learning mode.

This first slice operates on saved text, not a mutable composer draft. Draft help
needs a distinct draft revision/acceptance contract before it can claim source safety.
Existing general coach questions should remain usable; they need not invent a source
anchor just to fit this contract. Integration must decide the invocation split below.

Explicit review is a recommended implementation sequence, not a narrowing of the
approved assistance/proactive-coaching product plan. Existing proactivity preferences
and agreed future supporting analyses remain requirements; this proposal neither
implements automatic triggers nor removes them. Activation policy and source-owned
background review need their own bounded execution/UI assignment.

## Native request envelope, never model-authored identity

Capture conversation/coach-thread ownership, initiating coach-message ID, operation
identity, one primary learner-message ID and exact text, optional selected safe range,
target/explanation languages, selected target variety, difficulty/settings revision,
contract/prompt versions and a bounded list of context message IDs. Retain known input
assistance if already available; absence is unknown, not unaided production.

Expose opaque request-local source alias s0 and its safe grapheme IDs to the model;
use the existing first/last inclusive grapheme selection semantics. Native mapping
produces the same exact half-open scalar/UTF-16 references. The provider cannot assert
message IDs, revisions, speaker roles, language identity, provenance or operation IDs.
Optional contextual partner messages are read-only context, not eligible learner
evidence. Every included private/public source must remain in this conversation.

Initial bounds proposed: primary source <=4,096 scalars, <=3 assistance items,
answer <=1,200 scalars, item explanation <=600 scalars, expression wording <=256
scalars, raw candidate <=32 KiB. Existing route/prompt/token limits also apply.
These bounds require AI Operations review; they are not measured cost guarantees.

## Candidate and worked example

Exact saved Spanish learner message: `Quiero buy bread`. The learner asks privately,
“How do I say the English part?” Explanation language is English. Grapheme IDs g0007
through g0015 select `buy bread`; generated wording does not overwrite that source.

```json
{
  "answer": "Use comprar pan after Quiero to express what you want to do.",
  "status": "answered",
  "items": [
    {
      "kind": "expression",
      "source": "s0",
      "first": "g0007",
      "last": "g0015",
      "explanation": "This expresses buy bread in this sentence.",
      "wording": "comprar pan"
    }
  ]
}
```

An explanation item has kind/source/first/last/explanation and **no wording field**.
An expression item requires wording in the target language. The conversational
answer and explanations use the captured explanation language; shared writing guidance
applies to generated text for each destination. Quoted original text remains exact.
Do not infer a fragment's language by script alone: names, quotations and mixed text
can be ambiguous. Status `needs_clarification` permits a useful question without
fabricating an expression item. No correction or wording is automatically inserted.

An expression can cover several words because ExpressionHelp relates a learner
fragment to proposed wording. It is **not** a partner word-gloss span: it neither
replaces word targets nor bypasses PhraseRequiresSeparateLayer in that separate layer.
For this initial item list, require ordered disjoint source ranges and no duplicate
kind/range entries. One item combines explanation and wording when both are relevant;
do not emit overlapping explanation/expression items for the same fragment.

## Native validation versus linguistic quality

Decode raw JSON strictly, rejecting extra/duplicate/missing fields, wrong variants,
null required strings, trailing/fenced text, excessive bounds and invalid termination.
Use existing prose validation for generated text only. Resolve source aliases and
first/last IDs against captured immutable source; reject unknown/reversed/unsafe or
out-of-focus ranges, non-learner source targets and conflicting items. Never sort,
snap, silently drop items, normalize source or accept model-supplied identity.

At publication, recheck current source/conversation authority and cancellation using
existing execution machinery. Persist accepted answer and items atomically under one
logical result with attempt/model/usage provenance. Do not publish the answer while
discarding invalid structured items. Invalid output retains usage and any previous
accepted result. Source deletion cannot be undone by a late completion.

These checks establish structure and references, not correctness of wording, language
identification or completeness of advice. Native code cannot prove the model answered
the user's question. `answered` is explicitly a model-reported semantic status, not
verified proficiency or full source coverage.

## Pending, partial and failed results

Pending means no new accepted result. Failed means no newly accepted candidate;
an earlier accepted result remains visible. A structurally valid needs_clarification
answer is terminal and may retain valid items as partial help. It never auto-retries.
Answered may contain zero items for a conceptual answer; zero items must not create
an expression-help availability indicator. Unlike word glosses, unannotated text is
not a coverage gap: coaching is selective, not an exhaustive partition of a message.
Do not calculate percent coached or a universal word denominator.

An explicit retry retains captured source and languages/settings, creates a new
attempt and replaces the logical result only on accepted success. It does not
regenerate the partner reply, append duplicate help or award evidence. Difficulty
changes apply to later accepted requests, using one schema and machinery for Absolute
zero, Beginner, Intermediate, Advanced and Fluent; no extra calls or special surfaces.

Generated wording is assistance, not learner-produced evidence. If a later explicit
insert action is implemented, attribute the inserted wording to this item and its
source, preserve that origin through edits, and never auto-send. Private coach text
and discussion stay out of partner prompts/memory; intentional insertion of target
wording into the learner's draft is the only proposed outward action, not disclosure
of the private explanation or history.

## Exact decisions still needed

1. **Invocation/source selection:** recommend explicit saved-message selection plus
   the existing private coach question. Current AskCoach has no source selection.
   Do not silently bind every general question to the latest message. Integration
   and Interaction must choose the existing UI action supplying that reference.
2. **General questions:** recommend keep unanchored prose coaching for general questions;
   opt into this structured contract only for a captured saved-message request.
   Alternatively extending all coach replies needs a reviewed no-primary-source form.
3. **Using wording:** recommend display/copy initially; explicit draft insertion needs
   the composing-assistance provenance seam. Do not pretend current freeform coach
   has already implemented durable insertion attribution.

No decision is needed about a new difficulty mechanism or XP: both are out of scope.

## AI Operations coordination and integration seams

AI Operations has independently stated it owns A1-coaching-execution.md for capture,
graph, routing, cancellation/retry and cost. This report requests review of the one
existing coach_reply operation returning answer+items atomically (no second automatic
call), finite bounds, prompt source aliases, selected-variety/destination guidance,
captured source IDs and no shared partner/coach transport context. Its recommendations
must be reconciled before implementation; no routing/transport approval is inferred.

Direct outbound coordination was rejected by automatic approval review as transfer
of nonpublic project details to another task. No bypass or alternative transmission
was attempted. This local report records the pending coordination questions for
Integration; joint approval is not claimed.

AI Operations subsequently sent its draft summary: explicit saved learner-message
review, one Standard structured call plus native validation, no scores or automatic
trigger. This aligns with the data proposal. Its suggested primary source plus at
most four neighboring context messages is a reasonable finite starting bound, but
all contextual source IDs/roles must be captured explicitly and only the primary
learner source may receive this slice's assistance items. Context should be bounded
by bytes/tokens too, not message count alone. Its term “corrections” should include
expression help and explanations without requiring every source to be wrong.

AI Operations also flags existing conversation-pending and later-turn retry
constraints. Preserve those guards unless Integration explicitly designs a separate
source-owned assistance lifecycle; this proposal's retry semantics describe what an
eligible retry preserves, not authority to bypass current eligibility. Its draft was
reported at its task-local outputs/coaching-execution.md, not yet independently read
here. Outbound review remains blocked, so agreement on field limits/context capture
and the final shared report is still pending Integration review.

### Review of the now-shared A1 report

Read [A1-coaching-execution.md](A1-coaching-execution.md) directly after it was saved.
No conflict with its explicit saved-message trigger, one Standard structured call,
no-score output, private publication, separate general coaching, or retained scheduling
and retry constraints. The following details need resolution before implementation:

- Use explanation/expression assistance items rather than requiring “correction” as
  every item's meaning. A correct sentence can deserve explanation; an English fragment
  can request Spanish wording without being labeled an error. Replacement wording is
  generated assistance, never a mutation of saved source.
- Immutable saved message ID already identifies its sole content revision. Capture
  exact content and identity; do not add a fabricated numeric revision or require a
  second digest mechanism without an actual integrity requirement. If a digest is
  adopted for request provenance, native code computes it; the model cannot assert it.
- A bounded primary source plus four neighbors is compatible with this proposal if
  role/ID/ownership are explicit and only s0 is eligible for attached assistance.
  Review context is separate from private follow-up history. This limits context;
  it does not silently truncate the primary source.
- One structured review should be one logical request, not a mandatory child call
  added to a general coach question. Integration chooses its operation declaration
  and reuse of private surfaces; the data contract does not require changing COACH_PLAN
  for all existing messages.
- The proposed scalar/byte ceilings are validator limits, not a promise all maximal
  fields fit the current 2,048-output-token cap. AI Operations owns a bounded prompt
  output budget. Truncated termination fails atomically; do not display a partial JSON
  stream as the contract's needs_clarification/partial state.

The shared reports are substantively aligned; field-level confirmation from AI
Operations is not claimed because outbound messages remain blocked. No production
changes or additional product decisions were introduced by this comparison.

## Final reconciliation for Integration

**Settled design:** private coaching never becomes partner memory/context; generated
wording remains attributed assistance; insertion never sends; all five difficulties
share machinery; no XP or inferred proficiency. Strict source validation, atomic
publication, explicit retries and source deletion authority are requirements, not
new user questions. Proactive assistance remains planned; no automatic trigger is
implemented or removed by this proposal.

**Recommended first trigger:** explicit review of one selected saved learner message
plus a private question. Keep general coach chat separate. The user-facing selection
action and display/copy versus provenance-aware insertion remain actual product
decisions. Integration can resolve routine schema/budget choices without reopening
settled privacy, difficulty or assessment boundaries.

**Schema and no-help outcome:** one answer, answered/needs_clarification status, at
most three disjoint explanation/expression items as specified above. An empty item
list is valid with a nonblank answer: no attached assistance was offered, not proof
the source is correct. Needs_clarification is terminal partial help, not unfinished
transport or an automatic retry. Malformed/truncated output is failed, never partial
JSON salvage. Proposed 4,096-source/1,200-answer/600-explanation/256-wording scalar and
32-KiB-response caps remain acceptance ceilings; keep the existing 2,048-token provider
ceiling and require prompt/schema preflight. These are proposed implementation limits,
not evidence every maximal response fits; Integration/AI may lower field limits
before source assignment without changing product semantics.

**Deterministic context proposal:** within the same conversation's contact channel,
capture up to two messages immediately preceding and two immediately following the
selected source by immutable sequence at request acceptance. Do not fill missing
positions with more distant messages. Exclude coach-channel messages from this
neighbor selection; include private history only under a separate explicit follow-up
policy. Present neighbors chronologically with native IDs/roles; s0 alone is an
annotation target. Capture these exact IDs/texts once, including absent neighbors;
never add a later-arriving reply during dispatch/retry. Apply existing whole-request
byte preflight including schema overhead; if too large, fail before paid work rather
than trimming source or silently choosing different neighbors. This deterministic
policy is a recommendation requiring Integration acceptance, not current behavior.

**Authority:** immutable message edits/regeneration create a new source identity;
they never retarget accepted or pending feedback. Recheck initiating conversation,
primary source and every captured context source at dispatch and publication. Deleting
any captured source revokes this result's publication authority; do not silently
remove that context and continue under the same request. Conversation/partner deletion
cascades through existing ownership. Known assistance accompanies eligible source
facts, and model output cannot clear it. AssessmentExclusion is an evidence/skill-credit
restriction, not automatically a prohibition on private help. It must not be bypassed
if observations are added later; this slice creates none. If the product intends an
exclusion to also prohibit coaching/context use, that is an explicit unresolved policy,
not a reason to reinterpret current exclusions silently.

**Retry:** deduplicate duplicate commands under one logical request. An eligible
explicit retry retains the primary source, selected context, settings, language and
contract versions and gets a fresh attempt. Retain prior valid help until accepted
replacement; never merge item sets or regenerate the partner. Preserve current
conversation-pending and later-turn retry restrictions for the first slice. An
intentional fresh review can capture newer context as a new request after normal
admission; it is not a disguised retry or authorization for automatic re-review.
Removing those restrictions requires Integration to design source-owned assistance
state and late-result behavior; this proposal does not grant that change.

This final reconciliation is available locally for Integration. Automatic approval
review has blocked outbound summaries to both coordination tasks; no successful
delivery or joint field-level sign-off is claimed. No production implementation,
paid inference or Git changes were performed.

Future ownership, only after explicit assignment: Language pure contract/decoder and
tests; Integration model/context/atomic storage and authority; AI Operations shared
prompt/route budget; Interaction rendering/source selection/insertion behavior.
No files outside this report changed. Synthetic regressions should cover cross-source
alias rejection, Unicode/repeated fragments, expression-vs-explanation strictness,
clarification with partial help, invalid-item atomic failure, deletion/retry/privacy
and identical contract across all five difficulties. No live evaluation performed.
