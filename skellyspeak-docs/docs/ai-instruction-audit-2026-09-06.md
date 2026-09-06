---
title: AI instruction and observability audit — September 2026
---

# AI instruction and observability audit

**Historical evidence, 6 September 2026.** This audits the local development
working tree and the recorded Manolo conversation inspected that day. It is not
a deployed-service audit, completed implementation checklist, or model-quality
benchmark. Proposed work is tracked in [Future Work](./future-work).

## Observed failure

The chat displayed **Absolute zero**, the hardware shop owner persona, and the
reply beginning “Buenos días. Soy Manolo.” The native disk log at 22:06:48
recorded chat `1788732408-ec8faf62`, `level: "zero"`, a greeting with no history,
and `google/gemini-2.5-flash` at temperature 0.95. The Reply trace matched the
response and timing. Its captured system message included:

```text
Target: Spanish; level: PRE-A1; native: English.
Use familiar vocabulary and introduce new grammar gently.
TRUE BEGINNER MODE: use 3–5 words per sentence and at most one new phrase per reply.
```

The request also included the character sketch, a requirement to establish name
and home, a generic one-to-three-sentence rule, language-variety guidance,
inferred teaching observations, and explicit lesson choices. Observations
included recycled vocabulary such as `geranios`. The user message was a synthetic
session-start instruction.

The response had five sentences. “Mi tienda está en un pueblo pequeño, con muchos
geranios.” has twelve whitespace-separated words. These directly violate the
recorded length instructions without requiring a subjective CEFR judgment.
The suggestion call from the same interaction had no selected-level instruction.

**Conclusion:** the reply request contained the correct level; the suggestion
request omitted it. The trace cannot prove which competing instruction caused
the reply's noncompliance. This fresh opening demonstrates that accumulated
conversation-history drift is not necessary for the failure.

The inspector captures messages passed to the Rust provider wrapper. Inspected
`ai.rs` uses those same messages in the outbound payload. `server/contracts.py`
and `server/main.py` validate and forward message content without rewriting the
system text, while adding routing limits. That is source evidence about the
proxy, not an inspection of a live upstream request or provider internals.

## Setup and per-turn ownership

| Stage | Source of truth and behavior | Current audit visibility |
|---|---|---|
| Native startup | `lib.rs` loads Rust settings, inferred plan/profile and coach thread; attaches trace/gate buses | Startup logs and faults; no unified setup snapshot |
| UI startup | `useSteering.ts` restores level, topic and future-chat persona preference from localStorage; native settings supply languages/dialect/routing | Current controls, without historical ownership metadata |
| Load/open/new chat | `useConversation.ts` restores history before greeting; `conversation_partner.rs` initializes or reads the saved character | Saved files and partner panel; no initialization/recovery trace event |
| First reply | Empty history plus synthetic greeting; first introduction saved before `ReplyDone` | Prompt/output captured; persistence occurs outside the model-run outcome |
| Later reply | Rust captures settings, lesson, partner and inferred memory under its context lock; UI supplies level/topic and settled history | Final prompt, without structured source/revision metadata |
| Level/topic change | Debounced change requests a steering reply; its analysis generates suggestions | Trigger only discoverable inside message text |
| Persona change | Starts another chat; existing snapshots are unaffected by template changes | Runs have no saved-chat identifiers |
| Edit/resend | Frontend truncates later turns before building replacement history | Old traces remain without an explicit superseded-message relationship |

The system message is rebuilt each request. The saved partner is one fixed input,
not a fixed whole-system message. Selected **practice difficulty** and the
observer's **inferred proficiency** are different facts with different owners.

The reply receives a captured plan. The observer later loads its own lesson and
memory snapshot, then checks context/revision before applying results. Sharing an
execution-turn ID does not imply identical input snapshots across operations.

## Instruction coverage by operation

Sources: `commands/guided/mod.rs` and its analysis/coach/observer passes,
`commands/{coach,scaffolds,stories,insight,tts,stt}.rs`, and `prompts/`.

| Operation | Main context received | Selected practice difficulty |
|---|---|---|
| Partner reply | Saved character, languages/dialect, topic, choices, advisory plan/recent mechanics, history, message or trigger | Yes; concrete extra limits only for PRE-A1 |
| Reply suggestions | Languages, dialect/topic/choices, learner message and generated reply | **Absent**, including the observed request |
| Standalone suggestions | Recent transcript, dialect/topic/choices, plan directives | Accepted by IPC but `_cefr` is unused; absent from prompt |
| Grammar explanation | Languages, CEFR, dialect/topic/choices, message and reply | Yes |
| Word meanings | Exact text, language, gloss language, romanization/segmentation rules | Absent; faithful analysis may not need it |
| Translation | Exact reply and target/native language | Absent; fidelity should not be confused with simplification |
| Message feedback | Preceding transcript, latest learner message, languages, topic, inferred level notes | **Absent**; inferred level is a different input |
| Interactive coach | Saved transcript, coach thread, plan/profile, lesson choices, languages | No dedicated selected-level/topic input |
| Teaching observer | Transcript, plan/profile, mechanics, lesson choices | No explicit practice level; risks conflating ability and requested challenge |
| Stories | Separate story difficulty instructions and CEFR | Yes; separate policy from guided replies |
| Word insight | Word, sentence, languages and inflection capability | Absent; specialized reference operation |
| Cloud speech / transcription | Engine instructions and text / language and vocabulary hint | Separate request paths outside the common run recorder |

History windows differ intentionally: reply uses up to 30 **messages**, feedback
12 preceding messages, standalone suggestions eight. The observer receives the
history supplied to the turn plus the latest exchange. Interactive coaching reads
saved conversation context and its private thread. Trace metadata should expose
these windows and identify omitted messages rather than imply all calls share
“the conversation.”

## Findings and priorities

| Priority | Finding | Evidence and implication |
|---|---|---|
| High | Difficulty coverage is inconsistent | Missing in the observed suggestion request and both suggestion code paths. Coach/observer inputs also omit the explicit setting; define their intended consumption policy. |
| High | Model success is not behavioral compliance | The recorded successful reply breaks both length rules. Streaming reply handling does not enforce difficulty. |
| High | Practice difficulty and inferred proficiency are not separate request fields | A coach's inferred assessment cannot be assumed to reflect the selector. |
| Medium | Missing/unknown reply levels become A2 | `guided_turn` defaults absent level; `resolve_cefr` maps unknown values to A2. Not the cause of this PRE-A1 failure, but can mask future wiring errors. |
| Medium | Opening requirements compete for output space | Identity, character detail, topic and a possible question share a tiny budget. The introduction also becomes a persistent reference. |
| Medium | Historical context provenance is implicit | Current Lesson UI cannot prove the revision consumed by an earlier request. |
| Medium | Suggestion entry points differ | Standalone regeneration includes plan directives; turn-analysis suggestions do not include that plan block. This is not labeled as a composition decision. |

## Observability assessment

Retain the existing graph, call strip, operation registry and central Rust
recorder. They successfully exposed the failure. Extend their contracts rather
than building a second tracing system or a manually maintained execution graph.

| Area | Current limitation | Useful extension |
|---|---|---|
| Lineage | Process-local turn IDs; no saved chat/message, trigger, language pairing or process-session identity | Carry those identifiers through foreground, background and standalone work |
| State | Final text does not identify captured settings, lesson revision, partner reference or history selection | Immutable request-context snapshot; distinguish configured and inferred values |
| Prompt composition | One rendered, size-limited string; UI reparses role delimiters | Structured messages rendered from ordered Rust prompt blocks with IDs, sources, revisions and explicit omissions |
| Attempts | Outcome/error/timing/usage retained, but prompt/output overwritten per attempt | Independent request/response records for each attempt, including final failure |
| Effective parameters | Profile recorded before provider adaptation; `apply_dialect` can remove temperature while the trace still displays it | Record effective non-secret payload fields after adaptation, including schema and route |
| Completion | Model run ends before sanitization, persistence and some stale-context checks | Separate model result, application acceptance/rejection, persistence, and behavior checks |
| Retention | Bounded in-memory ring; restart loses full traces. Disk logs are not a complete prompt archive | Versioned, bounded local archive and scoped export with visible retention/deletion rules |
| Coverage | Speech/transcription bypass the recorder; preparation failures, skips and discarded results lack unified lifecycle events | Explicit records at those boundaries; never invent successful model calls for skipped work |
| Live activity | Start events only observed while subscribed; completed snapshot cannot reconstruct an in-flight call | Snapshot of active and completed operations |
| Inspection | Nested scrolling and abbreviated accessibility text make prompt reading slow | Searchable full-height reader and export; retain compact graph-first entry |

A green node currently establishes model-call success, not “displayed,” “saved,”
or “appropriate for Absolute zero.” Graph reconciliation checks declared execution
and dependencies, not instruction coverage or pedagogical quality.

## Proposed sequence

1. **Trace one example end to end.** Extend `RunContext`/`Run` with ownership and
   trigger information. Capture selected practice level, inferred level, lesson
   revision, partner reference, history selection and application/build revision.
   Build ordered prompt blocks where Rust composes them, render the actual messages
   from those blocks, and record that result. Do not infer provenance later from
   regex or current settings. Record effective parameters and messages per attempt.
2. **Fix difficulty against those records.** Define one Rust-owned policy for
   length, clauses, vocabulary and grammatical complexity; use it for replies and
   suggestions on every request. Give coach/observer the practice setting as a
   distinct fact with explicit grading/advice semantics. Keep translation and
   token-analysis fidelity intact. Test composition separately from model behavior.
3. **Retain and compare.** Add bounded durable traces, scoped export, lifecycle
   outcomes and changed-block comparison inside the existing inspector. Link
   observer/lesson revisions to producing calls and later consumers. Keep prompt
   editing and overrides as later work.

Cheap length checks can expose objective violations, but whitespace word counts
are not universal difficulty measures. Label language-aware diagnostics separately
from semantic judgments. Do not add an automatic rewriting/model-judge pass until
clearer instructions have been evaluated: it changes streaming latency and costs.

Any archive/export must document size limits, retention and deletion behavior,
including its relationship to chat deletion. Prompt/profile content is private
local diagnostic data. Exclude credentials, headers and raw audio; automatic remote
upload is unnecessary. Mark incomplete captures explicitly.

## Acceptance scenarios

- Zero-level opening and later reply show the same policy; a level change modifies
  that block while preserving partner identity. Suggestions cannot omit the policy.
- Inferred high proficiency cannot silently replace a low practice setting;
  both values and their roles are visible.
- Long-history, steering and edit/resend requests identify included/dropped messages
  and their actual triggers. Reopening a chat locates retained original traces.
- A retry reveals each attempt's effective request, response and rejection reason.
- A successful model result rejected after a context change is distinguishable
  from an applied result; skipped work is distinct from missing trace data.
- The captured Manolo reply is flagged as a length violation despite model success.
  Behavioral evaluation also includes longer exchanges and supported language
  structures; composition tests alone do not prove CEFR adherence.
- Restart, retention eviction and clearing have explicit, testable effects.

The original audit above was read-only. The following implementation check is
later evidence, not a claim that every acceptance scenario has been completed.

## Implementation check — 6 September 2026, 22:55 UTC

The rebuilt native app produced local traces for QA chat
`1788735282-83ee7cc9`. Reply #1 captured `zero`, greeting, no history, the shared
PRE-A1 policy, and its exact named system blocks. It returned “Hola, soy Mateo.
El pan es bueno.” (two sentences, seven words). Reply #6 captured the same
policy, the established partner introduction, one assistant history message and
the new user message “El pan es rico.” Both replies reached
`conversation_saved`. Suggestion calls #2 and #9 included the difficulty block;
all their items were within measured length limits. The feedback request
explicitly distinguished selected PRE-A1 practice from inferred proficiency.

This check also exposed a semantic issue: reply #6 said “Hola Mateo. El pan es
rico.”, apparently addressing the learner by the partner's own name. The actual
request had correct assistant/user roles and the saved identity. Passing length
checks therefore does not establish conversational coherence, identity fidelity,
or CEFR suitability. That behavior needs broader evaluation; the new trace
makes its inputs inspectable rather than hiding it behind a successful call.

Automated checks cover per-attempt preservation, prompt-block agreement,
unsupported difficulty rejection, archive reload/clear/eviction, and request
reader search/comparison. The native reader displayed changed character and observation blocks between
the greeting and follow-up. Exporting that exchange produced nine calls with
matching chat/difficulty and captured requests. The original Manolo chat was
restored after QA. Native restart retention and full mobile inspection were not
verified in this check.
