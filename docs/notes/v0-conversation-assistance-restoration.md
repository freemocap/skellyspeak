# Restore the v0 conversation assistance experience

Status: approved restoration implemented in source, September 16, 2026.
See the [implementation and verification report](v0-conversation-assistance-verification.md).
Source implementation, automated checks and live transcript samples are distinct
from microphone/playback verification and broader model-quality evaluation.

## Baseline and scope

Use tag `v0.13.8` (`c1670ec`) as the initial behavioral reference, the latest v0
tag in this repository. The user has not identified a more specific preferred
release. Inspect the tagged source; do not roll back the repository, run the
archived application, replace the current runtime, or copy its implementation
wholesale. The present workspace contains the preceding audit and direct-help
patch; preserve those changes while revising the design.

The product is a conversation, particularly a spoken conversation, with a private
coach and immediately useful assistance beside it. The user's subject and intent
lead. Lessons, curriculum, learner-model expansion and XP redesign remain frozen.
The objective is behavioral restoration, not a new theory of instruction.

This supersedes the lesson-first sequence in
[the broader proposal](coaching-learning-refactor-2026-09-16.md) and the assumption
in [the first chat-focused patch](chat-first-coaching-2026-09-16.md) that reducing
the existing skill-observation response to one direct correction is sufficient.

## What the tagged v0 actually did

The following findings are from source, not a live comparison or proof that every
v0 model response followed its instructions.

| Capability | v0.13.8 behavior | Current v1 difference |
| --- | --- | --- |
| Message feedback | A short 1–3 sentence remark addressed to the user, plus 0–3 corrections with original wording, replacement, explanation and kind | Skill-ID observations, meaning classification, rationale and error/cue metadata; at most one advice-bearing item |
| Mixed-language assistance | A native-language word or clause inside target-language speech is an implicit request for its target-language equivalent | No equally explicit standing rule in the automatic feedback prompt |
| Useful correct-message feedback | No invented error; an empty correction list is valid. A brief remark can identify something concrete or state that the wording is correct | Evidence-only success can be completely silent; no separate conversational remark |
| Message assessment | Separate grammar and conversational-fit scores, each 1–5, with evidence in the remark. UI labels them model judgments, not validated measurements | Outcomes refer to individual skills; no equivalent message-level summary |
| Separation of concerns | Coach feedback and skill assessment are separate passes with distinct output types | Learner-facing advice and evidence are coupled in one observation response |
| Context | Latest learner message clearly marked once, recent preceding exchange and separately labeled actual partner reply | Latest source also appears in recent captured history; automatic coaching can precede the actual partner reply |
| Side coach | Explain the current reply, supply a tiny usable answer and meaning, answer language or subject questions, follow user curiosity | Private thread exists, but the rescue and curiosity behavior is less specifically instructed |
| Curiosity links | `[[term]]` opens a concrete follow-up question; marker-only messages request explanation, not literal translation | Markdown support remains, but automatic feedback renders plain prose and does not offer this interaction |
| Reply assistance | Two complete replies, two sentence frames, two starters; a short explanation of the partner message plus translation/romanization/pronunciation support | Two requested replies with word glosses; frames and starters are set to empty arrays |
| Reply explanations | Separate cards explain 1–2 useful constructions in the partner's actual reply, with examples and language comparison | `conversation-view.ts` explicitly sets `mechanics: []` |
| Turn experience | Partner text streamed first; analysis sections arrived separately. Coach and slower observation were distinct from the main reply | Current durable operations preserve independent work, but streaming and perceived timing need a separate parity check |

Do not reduce this difference to prompt tone. Some capabilities have no active
producer or no visible consumer in the current flow.

## Source provenance

Reference source paths below are relative to the `v0.13.8` Git tree; inspect with
`git show v0.13.8:<path>`. They are not current implementation paths.

- `src-tauri/src/prompts/coach.rs`: automatic remark/correction, code-switching,
  private-thread rescue and curiosity instructions.
- `src-tauri/src/commands/coach.rs`: `CoachFeedback` / `CoachCorrection`, separate
  message scores and private-thread context.
- `src-tauri/src/commands/guided/coach_pass.rs`: bounded context and separate latest
  message/actual partner reply; feedback publication.
- `src-tauri/src/commands/guided/skill_pass.rs`: separate skill pass.
- `src-tauri/src/prompts/analysis.rs`: reply explanations, suggestions, sentence
  frames, starters, rescue packet, translations and reading aids.
- `src-tauri/src/commands/guided/mod.rs`, `src-tauri/src/turn_plan.rs`: streamed
  conversation and later independent assistance/observer work.
- `src/components/panes/CoachEntry.tsx`, `src/components/chat/MessageFeedback.tsx`:
  remark, corrections, language fragments and message-level assessment display.
- `src-tauri/src/prompts/observer.rs`: small advisory teaching/profile documents;
  these are secondary and should not be the prerequisite for restoration.

Current owners inspected:

- [Coaching builder/types](../../native/src/learning/coaching/mod.rs)
- [Observation validation/publication](../../native/src/learning/coaching/coach_observation.rs)
- [Disclosure and repair policy](../../native/src/learning/coaching/coach_policy.rs)
- [Durable snapshot projection](../../native/src/conversations/execution/snapshots.rs)
- [UI projection](../../ui/src/domain/conversation/conversation-view.ts)
- [Reply-help UI](../../ui/src/features/conversation/composer/ComposerHelp.tsx)
- [Coach rendering](../../ui/src/features/conversation/coaching/CoachEntry.tsx)
- [Reply analysis](../../ui/src/features/conversation/reading/AnalysisContent.tsx)
- [Markdown/curiosity renderer](../../ui/src/components/reading/Markdown.tsx)

## Restoration contract

### 1. The conversational coach is its own output

Reintroduce a dedicated message-feedback contract, independent of skill IDs,
prerequisites, support ladders, evidence selection and XP. It contains a short
remark, source-bound language fragments, 0–3 direct corrections with explanations,
and separate message-level grammar/conversation judgments. Restore the distinction
between these model judgments and validated measurements or proficiency levels.
Do not quietly omit scores while calling this a v0 restoration.

The correction need not fit an unrelated catalog entry. Its source is the actual
learner message, including a speech transcript or mixed-language phrase. Quotes
must match that source. A correction addresses wording, not the user's opinions
or choice of topic. The partner's response is context, never learner evidence.

Restore a useful remark, rather than requiring every successful response to be
silent or every remark to contain an error. No manufactured corrections or padded
praise. Explanations mostly use the user's explanation language; target-language
text is for quoted wording and examples. Transcript-only feedback must not claim
acoustic pronunciation assessment.

Keep skill assessment outside this contract. Freeze expansion of that system;
its eventual scheduling and XP policy cannot be a prerequisite for conversational
feedback. Do not launch a new mandatory skill observer merely to replace the
current coupling. The implementation must explicitly account for existing
records/UI before removing its automatic producer.

### 2. Understand and answer the partner

Restore the assistance packet for the actual latest partner reply: what they mean
or ask, two plausible replies and their meanings, and reading aids where useful.
Restore frames and starters as alternative amounts of support. Inserting one
fills a draft; it does not send or speak for the user without their action.
Suggestions follow the current topic and selected difficulty, not a hidden lesson.

Show ready assistance when available and distinguish pending, failed and absent
results. Reopening a saved result must not generate more work. Keep every packet
bound to its source reply so it cannot silently drift to a newer question.

### 3. Explain the language in the exchange

Restore short grammar/usage cards grounded in the partner's actual wording,
with a worked example and useful contrast where supported. Restore curiosity
links from explanations to the private coach. The private coach must see the
feedback/term the user is asking about, not only the raw conversation.

Review v0's forced minimum of one explanation card rather than copying that rule
uncritically. It conflicts with its own no-padding rule and may produce repetitive
cards. The product capability to explain useful language is the restoration
requirement; fabricating a lesson for every reply is not.

### 4. Preserve the voice conversation

The user can speak, hear the partner, and continue while coaching and reading
assistance arrive. Neither message scores, correction disclosure, grammar cards
nor XP can gate the next turn or audio playback. Feedback should remain attached
to the turn it evaluates while a new recording/message begins.

Assess v0 streaming/first-audio timing separately from assistance quality. Do not
claim timing parity merely because current scheduling tests pass. Keep current
ownership, cancellation, bounded requests and explicit failures; v0's technical
implementation is reference material, not the replacement runtime.

## Concrete example for review

Partner: “¿Qué hiciste ayer?”
User transcript: “Ayer yo go al parque con mi hermana.”

The coach should immediately supply the missing target-language wording: “For
‘I went,’ use fui: Ayer fui al parque con mi hermana.” A correction card binds
`go` to `fui` and briefly explains the past form. It must not require an existing
past-tense skill ID, classify the error's psychological cause, hide the answer
behind a hint, or redirect the conversation into a lesson.

The partner continues the park conversation. Assistance for that next reply
explains what the partner asks and offers usable ways to respond. Clicking a
relevant term such as `[[past tense]]` opens a contextual explanation in the
private coach. Message ratings, if displayed, describe that contribution only;
they do not establish language proficiency. This is an illustrative walkthrough,
not a linguistically reviewed fixture or observed model output.

## Implementation order and acceptance

1. Replace the automatic coaching contract and UI end to end. Restore the remark,
   direct corrections, code-switch help and message-level assessment. Verify
   correct text, mixed language, ambiguity and actual partner context.
2. Restore reply assistance end to end: explanations, reply meanings, frames,
   starters and source-bound reading aids. Verify inserting/editing/recording
   preserves the user's control and marks actual in-app support.
3. Restore useful exchange explanations and curiosity follow-ups. Verify that the
   private coach receives the relevant saved feedback and quoted exchange.
4. Run representative voice conversations in Spanish, Arabic and Mandarin using
   the configured economical models. Compare usefulness, false corrections,
   duplication, first reply/audio latency and total requests/tokens per exchange.
   Do not declare restoration complete from schema tests alone.

For each step, use small purpose-specific inference tasks and native composition.
The baseline already separated assistance tasks; there is no need to invent a
large autonomous teaching pipeline. Cost and latency must be measured against
the actual restored call set, not assumed to improve because each prompt is short.

The comparison pass copied no archived implementation and changed no Git history.
The subsequently authorized implementation restores these capabilities through
the current runtime; running-app equivalence and streaming parity remain unverified.
