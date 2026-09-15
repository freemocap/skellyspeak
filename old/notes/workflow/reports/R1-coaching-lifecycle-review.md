# R1 dependency-split coaching lifecycle review

Current user decision: two independent automatic nodes, plus deeper analysis only
on explicit request. This supersedes the earlier consolidated after-reply coaching
payload proposal. AI Operations owns provider/payload planning; Language owns domain
semantics. Reliability's work here is read-only planning: no code, schema, UI,
capacity-policy or runtime changes.

## Node identity and dependencies

| Node | Earliest eligible input | Inputs it must not wait for |
| --- | --- | --- |
| Learner feedback | Durably saved learner text plus the bounded prior context captured at Send | Current partner reply, suggestions, speech or gloss |
| Reply suggestions | Accepted partner TEXT and the captured exchange/prior context required for useful next replies | Learner feedback, speech or gloss |
| Deeper analysis | Explicit native request identifying a source and approved analysis contract | Other analysis completion unless its accepted output is an explicitly chosen input |

Both automatic nodes belong to the original exchange with independent operation and
attempt identities, state, usage, validation and publication. Do not reuse AskCoach/
COACH_PLAN to create a second pending conversation turn. No feedback→suggestions
barrier: slow/invalid feedback cannot delay suggestions once partner text exists.
A provider transport group can batch compatible *already eligible* operations, but
must not become a new dependency or whole-group completion barrier.

Feedback captures learner message ID/text, owning conversation/contact, selected
bounded prior messages and their identity, difficulty, languages, configuration/
prompt provenance and resolved route/credential authority. It must not read a later
partner reply opportunistically at completion. Suggestions additionally bind the
exact accepted partner message ID/text. Capture canonical source when its dependency
becomes ready; validation cannot resolve whichever conversation is currently visible.

Existing UNIQUE(turn_id,kind) can support distinct automatic feedback/suggestions
kinds without duplicate jobs. Proposed deeper identity must distinguish its depth/
contract from the automatic nodes; Integration/Language settle exact variants before
schema edits. Duplicate action receipts/read/reveal/navigation must never enqueue
again. Failed/unknown explicit retry reuses only that node's operation with a fresh
attempt. Saved accepted output remains readable while its retry runs or fails.

## Conversation-state gate exposed by early feedback

Current Send rejects any turn with state=pending. `refresh_turn` sets a turn pending
when it has any ready/running operation and no accepted assistant message. That was
written for the existing reply-dependent helper graph. An immediate feedback node
can remain running after the partner reply has failed; under the current formula,
feedback alone can keep the conversation pending and reject the next Send.

Before activation, primary reply-pending must be determined by the primary reply's
own lifecycle, not arbitrary helper work. Feedback readiness/retry/failure must not
create or extend a primary reply lock. Primary reply failure does not necessarily
invalidate useful source-bound feedback on the already saved learner message.
Dedicated coaching publication must therefore check active attempt + source/owner/
authority, rather than accidentally depending on an aggregate turn state that excludes
otherwise valid feedback. Whole-turn cancellation and source invalidation still win.
No recommendation to relax those authority checks.

UI pendingReply/sending, microphone availability, contact switching and composer
submission must derive from foreground work and accepted input ownership. Analysis
pending is a per-source status only. Test native admission as well as UI controls:
a responsive button alone does not establish that Send will be accepted.

## Shared-capacity proposal remains under evaluation

Existing global native capacity is4. A1 proposes a global helper ceiling3 within it,
with foreground partner replies/transcription prioritized, speech ahead of other
helpers, and an eligibility-aware queue scan. Both automatic coaching nodes and
explicit deeper work would count as helpers, even feedback running while its turn
is still pending. Classification follows operation kind, not turn state.

This is a proposal, not approved/implemented policy. Do not increase global capacity,
serialize speech behind coaching, or admit a fourth helper just because foreground
work has not arrived yet. Skip ineligible helper queue heads to avoid starving a
ready foreground operation. Priority is not preemption; account for permits already
held and cancellation/finish release. The native durable scheduler and shared network
semaphore must agree so one layer cannot defeat the intended bound.

Current speech/gloss/translation overlap must remain. The existing three-helpers+
next-reply regression is the baseline. Two new helpers make a naive oldest-first
extension unsafe for that property, including overlap across older turns/contacts.
Do not promise unlimited immediate dispatch under finite capacity; distinguish
accepting a new Send from its eventual HTTP start and actual microphone capture.

## Publication and latest-suggestion relevance

Each node needs a dedicated pure validator and source-owned publication path.
`Store::finish` currently inserts an assistant message for an otherwise unrecognized
operation kind; neither node may take that branch. Reply completion also releases a
hardcoded helper list, so suggestions eligibility must be added deliberately while
feedback is independently eligible from the saved learner source.

A late result from exchange N can remain valid historical data for N after N+1 is
saved. It must not replace suggestions for the current composer, overwrite a newer
draft or switch the current contact. Presentation selects suggestions only for the
currently relevant accepted source and no superseding Send; reopening historical
help remains read-only. Whether to cancel obsolete suggestion work for cost or retain
its historical result is a separate explicit policy, not implicit source mutation.

Language decides accepted partial-domain semantics for each node's payload. Valid
partial analysis is distinct from failed transport/validation; actual usage is retained
even if no result publishes. Feedback, suggestions, speech, gloss and translation
must hydrate independently. A broken transport group's accepted sibling results
remain accepted; do not gate whole-group publication on every node's completion.

## Cancel, retry, restart and duplicate protection

- Explicit feedback/suggestions/deeper retry acts on exactly its operation and checks
  source identity/text, archived/deleted owners, credentials, pause/refusal and current
  attempt budget before admission. No partner reply or sibling regeneration.
- Analysis-only Cancel must not call whole-turn Cancel. Whole-turn Cancel currently
  cancels all unfinished work and remains a distinct operation. Cancelled/invalidated
  late results cannot publish; paid outcome/accounting stays truthful.
- Restart marks interrupted attempts unknown and removes automatic replay permits.
  Queued/running node recovery must be explicit under the existing no-hidden-replay
  policy. Retried paused work gets only that operation's permit, not sibling resume.
- Completion must match active operation AND attempt plus source authority. Replayed
  commands or callbacks must not duplicate publication or downstream domain records.
- No automatic follow-on inference because a component mounted or a snapshot refreshed.

## Focused implementation gates/tests

Prefer extensions of existing lifecycle, grouped-partial and voice tests:

1. Feedback dispatches on saved learner text while partner reply is running; it
   publishes either before or after partner completion. Suggestions dispatch as soon
   as accepted partner text exists even if feedback and speech/gloss remain running.
2. Partner reply fails while feedback is pending/running: feedback alone does not
   keep native Send or microphone/contact UI locked; late valid feedback still targets
   its learner source. Feedback failure does not prevent partner/suggestions success.
3. Under the eventually approved capacity policy, overlapping older-turn feedback,
   suggestions, speech/gloss/translation and explicit depth never consume more than
   allowed helper slots; ready next-reply/STT work is not hidden behind an ineligible
   helper. Preserve the existing voice concurrency scenario.
4. Turn N+1/contact B becomes current before N's results finish: durable publication
   stays on N, current composer/draft never receives N's stale suggestions, no new
   work from viewing historical feedback.
5. Duplicate triggers/deeper clicks/retry receipts create one corresponding operation
   and expected attempt only; scoped retry/cancel, restart, source edit/delete/archive
   and credential revocation preserve siblings/usage and block stale publication.

No new suite or runtime checks executed for this design update. Synthetic gates prove
lifecycle, not linguistic quality/device latency. Provider evaluation, six-domain
content decisions and device QA remain separately owned/authorized.
