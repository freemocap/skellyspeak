# Work graph and structured-classification audit

Status: **source audit and local verification complete; changes proposed**,
2026-09-24. No runtime behavior, provider route, credential, or model configuration
changed. No paid inference was run. The existing skill prompt investigation remains
closed; this review concerns other operations and scheduling boundaries.

## Findings in priority order

### 1. Fresh conversation snapshots wait for old history hydration

Confirmed by a new characterization test in
[the snapshot suite](../../ui/src/features/conversation/session/useConversationSnapshot.test.ts).
In [the observation hook](../../ui/src/features/conversation/session/useConversationSnapshot.ts),
a fresh live page is received, then previously revealed history pages are fetched
serially before `setSnapshot` publishes anything. If an older-page read is slow,
new durable messages, annotations and operation states remain behind it. Prose
stream events can still arrive independently, so this does not block all text.

The probe loads history, resolves a new live snapshot, holds one old-page response,
and observes the prior revision staying visible until that response resolves.
This is an unnecessary publication dependency, not a provider throughput problem.

Proposed fix: publish the fresh live region immediately, reconcile older pages
separately, and preserve identity ordering, deletions/revisions, source scope and
history-gap handling. Reverse the characterization expectation when implementing
that fix. Do not simply concatenate cached stale records after a revision.

### 2. Local work waits behind network admission

[Scheduler](../../native/src/application/scheduler.rs) acquires a network permit
before calling dispatch. [Dispatch](../../native/src/conversations/execution/dispatch.rs)
also checks the running-operation cap before choosing work. Local context
validation and local completion of an empty evidence operation are behind both
checks, despite requiring no provider capacity. Under saturation, local readiness
and local result publication can wait for unrelated network work.

Source-confirmed gating; no saturation latency benchmark was performed. Proposed
fix: separate bounded local-ready work from network admission, preserving the
transaction, pause/step semantics and authorization checks. A test should occupy
all network slots and confirm eligible local work completes without sending HTTP.

### 3. Scheduling and durable UI updates use polling

The scheduler sleeps 100 ms between passes. The
[conversation watcher](../../native/src/application/commands/workspace.rs) checks
revision every 150 ms, up to a 20-second long-poll deadline. These are async sleeps,
not blocked executor threads, but add avoidable observation/scheduling latency.
They are configured intervals, not measured end-to-end latency percentiles.

Proposed improvement: notify on ready-work transitions and committed revision
changes, with bounded fallback polling. Subscribe/recheck around waits so a wakeup
cannot be lost. Preserve one-time publication and cancellation. Do not remove
admission, revision validation or actual source dependencies in the name of speed.

### 4. Learner feedback waits for the partner reply

The declaration places `conversation_feedback` after `persona_reply`.
[Its prompt builder](../../native/src/learning/coaching/conversation_support.rs)
unconditionally queries the actual partner reply and shares its exchange builder
with reply explanations/assistance. The feedback instruction primarily assesses
the latest learner input; partner-dependent help genuinely needs the reply.

This is an existing contract dependency, not safe to remove by editing one graph
edge. Review whether learner corrections need the new partner response. If not,
split the feedback input projection and release it after local context, alongside
the reply. Test early corrections, absent partner output and partner failure.
Do not change correction quality or learner-visible content as incidental cleanup.

### 5. Cold capability probes can delay dispatch and duplicate work

[Capability lookup](../../native/src/application/streams.rs) caches completed
results by target and revision but has no in-flight coalescing. Concurrent groups
on a cold target can probe the same endpoint separately. The scheduler waits for
the probe before submitting inference. Header/body reads in the
[group transport](../../native/src/ai/transport/grouped.rs) each have a five-second
timeout; these are bounds, not observed waits. Probe errors are reported and leave
no cache entry, so subsequent groups can probe again.

Proposed experiment: a delayed local capability endpoint, concurrent ready groups,
and counted probes. Evaluate one shared in-flight probe with explicit invalidation
and error handling. Do not silently assume streaming support on an unknown server.

## What the audit verified as healthy

- [Operation declarations](../../native/src/conversations/turn_plan.rs) drive both
  dependency release and inspection; a ready flag cannot bypass prerequisites.
- Partner replies do not depend on skill assessment, user gloss or translation.
  Reply-dependent gloss, speech, translation and brief are siblings, not a chain.
  Explicit explanations and suggestions are not automatically created.
- Network awaits are outside the store lock in the inspected scheduler. Groups
  are spawned independently; there is no deliberate batch-fill wait.
- [Grouped server execution](../../server/app/inference/grouped.py) starts items
  concurrently and delivers results per item. Streaming orders each item's own
  deltas before its terminal result, not all items behind the slowest sibling.
- Native publication commits each completed item and releases its permit in the
  completion callback. A broken stream does not overwrite committed siblings.
- [Stream reconciliation](../../ui/src/state/session/attempt-streams.ts) subscribes
  before reading, rejects stale generations/sequences and preserves text until
  the durable snapshot takes over.
- Durable snapshots avoid full hydration on unchanged revisions. Read-only
  inspection does not schedule inference. Source/revision checks reject late
  publication and preserve successful siblings on failure.

These conclusions cover inspected seams and local fixtures, not every live route,
device, account load or running application. No universal no-blocking claim is made.

## Work outside the conversation graph

Persona and drill proposals use a separate shared request registry and
[proposal executor](../../native/src/application/commands/proposal_execution.rs).
They share admission and durable receipts but are whole structured generations,
not independently hydrated conversation graph nodes. The generation activity UI
polls approximately once per second after each completed read; it is not the same
live stream path as conversation prose. This separation is explicit, not itself a
bug. A unified graph inspector should disclose both lifecycles rather than imply
that one conversation DAG describes the whole workspace.

The dispatcher contains repeated kind-specific branches and retained explicit
operations. These are review targets, not proof of dead code: retained operations
still have validators and tests. Do not delete them based on naming or size alone.
The repository also contains older no-retry descriptions while current source
implements bounded retries for explicit rate-limit responses. Reconcile those
policy descriptions in a separate focused pass; do not alter retry behavior during
this audit. Ambiguous grouped outcomes are not automatically replayed.

## Conversion candidates

| Operation or proposed function | Recommendation | Reason |
| --- | --- | --- |
| Skill presence | Selected strategy already; integrate under the existing refactor | Fixed skill catalog and bounded evidence labels |
| Which skills a revision affects | Best new experiment | Before/after text plus candidate skills can produce introduced/revisited/removed/unchanged/unclear classifications; this is evidence attribution, not success |
| Coach Explore / Continue practicing / mixed selection | Deterministic baseline first; classifier challenger only for contextual fit | Experience and effort counts already determine breadth/depth; do not add inference just to sort numbers |
| Rank a small supplied set of practice opportunities against the user's topic | Useful second experiment | Bounded candidates and criteria; output an ID or no suitable candidate, followed by separate content generation |
| Conversation grammar/fit scores | Technically classification-shaped, low priority | Current output also contains corrections and prose; splitting adds a call unless the prose requirement changes. Scores are outside the new XP policy |
| Partner reaction category | Technically bounded, defer | Existing output also needs interpretation/explanation and is only a tentative reading; not central to the current experience/effort scope |
| Retry success / repaired judgment | Do not expand for the new rewards system | The agreed first version does not reward success; classify affected skills only if needed |
| Quotes, glosses, translations, corrections, reply examples | Keep generation/extraction | Arbitrary source text and prose cannot be replaced by selecting a small label set |
| Persona replies/openings, drill phrase generation, saved profile write-up | Keep generation | A classifier can select focus beforehand; it does not write the content |
| XP arithmetic, source validity, duplicate detection, refresh eligibility | Deterministic code | Explicit record rules; no semantic model needed |

## Proposed bounded experiments

Not started. These are new questions, not a reopening of prompt verbosity.
Reuse the existing frozen-plan/receipt/dashboard machinery, with neutral study
names and fresh directories. Keep source data, expected labels and human review
separate from request payloads.

### A. Revision-to-skill attribution

- 24 before/after pairs: eight intended scenarios expressed in Spanish, Levantine
  Arabic and Mandarin Chinese. Keep translations in eight shared clusters.
- Cases: unchanged resend, punctuation-only edit, edit unrelated to target,
  target-bearing edit, introduced skill, removed skill, multi-skill edit and
  genuinely ambiguous attribution. Review expected affected skills before inference.
- Two approaches: evidence presence on both versions plus deterministic set
  difference, versus one paired revision classification. The paired approach can
  distinguish revisiting a retained skill where set difference cannot.
- Two identical-input repetitions: 96 planned analysis requests if each approach
  evaluates the pair in one request. Question counts and token costs differ and
  must be reported, not hidden behind request count.
- Report per-label confusion, affected-skill agreement, false effort credit,
  missed effort, ambiguity, invalid outputs, repeatability, latency and actual
  cost. Use clustered intervals and raw case inspection; eight clusters only
  support a small exploratory screening, not strong statistical claims.
- No success score, quality-improvement label or automatic award in this study.

### B. Contextual practice selection

- 12 synthetic profiles spanning no history, narrow experience, repeated effort,
  mixed coverage, tied counts, unsupported candidates and explicit topic limits.
- Test all three coach modes: 36 cases, two repetitions = 72 classifier requests.
  Compute the deterministic baseline locally with zero provider cost.
- Both receive the same applicable candidate IDs, experience/effort data and user
  intent. The classifier only selects an ID or none; prose generation stays outside
  the comparison. Persona-choice mode is not silently converted into coach mode.
- Hard checks: valid candidate, selected variety, explicit exclusions and user topic.
  Preference review can accept multiple useful choices; do not score against one
  arbitrarily chosen ID as if it were unique truth.
- Compare depth/breadth behavior, human preference, repetition and end-to-end
  delay/cost. Adopt a model selector only if it supplies useful contextual judgment
  beyond the simple rules. No replacement is presumed.

Before either live round, freeze the exact fixture set, current price verification,
call count and dollar reservation. No paid requests or live experiments are claimed
by this report. A small initial ceiling of $1 per round is proposed, not an estimate
of actual cost or a permission to exceed a validated reservation.

## Recommended sequence

1. Review this audit; prioritize the reproduced live-history publication gate.
2. Fix and verify hydration independently from classifier integration.
3. Separate local work from network admission; evaluate event-driven wakeups and
   probe coalescing with delayed local fixtures.
4. Review revision-attribution fixtures, then run experiment A if that attribution
   is necessary for the agreed simple effort policy.
5. Implement the simple coach-selection baseline; run B only for the contextual
   selection question. Preserve learner controls and the separate persona choice.
6. Feed adopted results into the skills/experience/effort plan. Keep bulk language
   authoring and broader runtime conversion separate from this audit.

## Verification performed

- Conversation execution suite: 139 passed initially, four local-server tests
  blocked by sandbox binding, two deliberately ignored. All four blocked tests
  passed when rerun with local-server permission: **143 passing execution tests**.
- Scheduler authority-after-delayed-probe test: **1 passed**.
- Hosted grouped and grouped-delta fixture suites: **30 passed**.
- Frontend stream reconciliation and streamed reply presentation: **13 passed**.
- Conversation snapshot suite, including new delayed-history characterization:
  **8 passed**. The new test confirms the current gate; it does not fix it.
- No live provider benchmark, full app smoke test, deployment, commit or source
  cleanup was performed. Runtime source is unchanged; only the characterization
  test and this audit record were added in this pass.

## Follow-up: scoring experiment completed

The later requested grammar, conversational-fit and partner-understanding study
supersedes the earlier deferral of these candidates. See the
[completed scoring study](score-scale-2026-09-24/README.md). It ran 216 requests
across Spanish, Levantine Arabic and Mandarin Chinese, costing $0.008081472.
Both rating scales had 94.4% agreement with provisional ranges; no superiority
of 0–10 was established. Understanding matched all authored cases, with limited
coverage of ambiguous replies. These are screening results, not validated accuracy.

The standalone dashboard includes intervals, language filters, repeated outputs,
exact prompts, distributions and receipts. Three study/report tests and strict
TypeScript checking passed. Runtime scoring and scheduling remain unchanged.
The audit's revision-attribution and coach-selection experiments remain proposed.

## Adopted message assessment replacement

The approved replacement is now implemented in source. See
[implementation and verification](message-assessment-replacement.md). This
supersedes the scoring study's runtime-unchanged status above. Grammar and
conversational-fit scores run after context capture, alongside reply generation.
Understanding runs after reply publication, independently of those scores. The
separate history hydration, local-admission and wakeup findings remain unresolved;
this replacement does not claim to fix them.
