# Conversation assistance restoration: implementation and verification

Status: source implementation; September 16, 2026. User approved the
[v0 restoration contract](v0-conversation-assistance-restoration.md). This is not
a deployment, a streaming restoration, or proof of parity with the old app.

## Implemented behavior

Voice conversation remains the main interaction. The partner replies about the
learner's topic. Three separate durable tasks support that exchange:

| Task | Saved output | Limits |
| --- | --- | --- |
| `conversation_feedback` | Remark, direct corrections, source language fragments, grammar and conversation-fit judgments | 0–3 corrections; judgments 1–5; no skill IDs or XP |
| `reply_assistance` | Explanation of the actual partner reply, two translated replies with reading aids, frames, starters | Two replies, two frames, two starters |
| `reply_explanations` | Useful constructions quoted from the actual partner reply, explanations, examples, optional language contrasts | 0–2 cards; no forced filler |

The source owner is
[conversation_support.rs](../../native/src/learning/coaching/conversation_support.rs),
with [small serialized types](../../native/src/learning/coaching/conversation_support/types.rs).
Each task validates output before saving it on its originating turn. Feedback
quotes and language fragments must occur in the learner's source; explanation
quotes must occur in the partner's reply. Oversized, malformed and truncated
outputs fail explicitly. The bounded preceding exchange excludes duplicate source
text; the current input and actual reply are separate. Input is limited to 12 KB
per support request, dropping only whole old context messages; an oversized
current exchange fails that support task without blocking chat.

The [scheduler declarations](../../native/src/conversations/turn_plan.rs) wait for
the actual partner reply. Speech has the same dispatch priority as primary
conversation work. The next learner turn can begin with support still running.
Revisions/cancellation invalidate late publication through the existing runtime.
No automatic retry or mandatory skill-observer call was added.

The UI renders a saved remark and direct corrections without hint disclosure.
Message ratings are labeled model judgments, separately from proficiency and XP.
Reply support inserts into the draft only, records suggestion/scaffold use, and
never sends automatically. Translation is visible; pronunciation/romanization
follow reading preferences and remain available in a collapsed reading section.
Reopening saved support does not request another inference. Curiosity links open
private coach drafts containing the selected feedback/explanation. The private
coach also receives the last four saved support packets, apart from persona
context, and is instructed to explain the reply and offer a small usable answer.

The partner prompt was shortened and the contradictory instruction to translate
mixed-language fragments removed. The partner continues the conversation; the
private coach supplies missing expressions.

## Existing learning data and frozen scope

New chat feedback no longer produces skill observations, automatic partner
reaction reports, skill XP or stars. Previously saved observations, decisions,
rewards and skill histories remain readable; tests create retained evidence
explicitly instead of pretending it comes from the new coach. Skills and XP rules
now state this separation. No conversion, schema migration, new observer,
lesson redesign or progression redesign was introduced. Existing lesson behavior
and reward presentation remain in place.

## Verification

- Native regression suite: 364 passed, one paid evaluation ignored by default.
- UI suite: 720 passed across 115 files, including new direct-feedback,
  contextual-curiosity, draft-insertion and saved-packet projection tests.
- TypeScript, seven locale catalogs (939 messages each), style ownership check
  and strict Clippy passed.
- Real OpenRouter `google/gemini-2.5-flash` requests exercised Spanish, Arabic and
  Mandarin synthetic speech transcripts. All three tasks published validated
  results in each language. Details of the final sample are below.
- Device voice preflight failed because `adb` is unavailable. No microphone
  recognition, actual speaker playback, device interaction or first-audio latency
  was verified. The current transport still publishes completed prose; this work
  does not restore v0 streaming.

The live test is explicitly ignored by default and reads a locally supplied key
file without logging its contents. Its fixtures contain authored text only.
Schema correctness is not linguistic correctness; these samples are small and
are not a broad benchmark or independent linguistic review.

## Live sample findings and cost boundaries

The first two Spanish samples exposed partner echoing, despite the old prompt's
repeated prohibitions. The shorter partner prompt produced a genuine follow-up
in the subsequent three-language sample. The coach supplied `go → fui`,
`my sister → أختي`, and a Mandarin sister expression. An early Mandarin output
assumed an older sister without evidence; the final instruction asks for
alternatives when the source leaves a required distinction unspecified.

The live assertion checks that a correction supplies the missing expression;
it does not insist that the model calls that correction `missing_expression`
rather than `grammar` or `wording`. Those category labels and numeric judgments
remain model judgments. They have no skill-credit consequences.

This restoration adds one automatic support call per normal exchange relative
to the previous automatic feedback+reaction pair. With existing word-gloss and
translation tasks, a normal exchange has eight text requests, plus optional
speech synthesis and transcription. Opening turns have no learner-feedback
request. Optional private coaching adds its own request. Do not describe the
restoration as cheaper overall: prompts are smaller and responsibilities clearer,
but actual total cost depends on this call count and output tokens.

Live task timings below are individual request durations from a sequential
synthetic harness, not UI critical-path timings. They exclude transcription,
playback, word glosses and standalone translations. No dollar cost was inferred
from token counts.
