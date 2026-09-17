# Conversation-first coaching checkpoint

Status: user-directed priority and source implementation, September 16, 2026.
Running-app and live-model quality remain unverified in this task.

## Latest direction: restore v0 behavior

The user subsequently requested returning coaching and assistance to the v0
experience. The [v0 restoration comparison](v0-conversation-assistance-restoration.md)
now defines the behavioral target and has been implemented in the
[current restoration](v0-conversation-assistance-verification.md). This direct-help patch is a limited earlier
change, not the intended final contract. In particular, its one-advice cap and
skill-bound output do not restore v0's remark, corrections and separate assessment.

## Agreed priority

The main experience is spoken back-and-forth conversation on the user's topic in
their selected target language. Coaching supports that exchange with actionable
assessment of the latest input, direct corrections and brief explanations.
Lessons are secondary and their redesign is frozen. Curriculum, new progression
and XP redesign are deferred until this conversational loop works well.

This corrects the lesson-led sequence in the
[earlier audit/proposal](coaching-learning-refactor-2026-09-16.md). Its source
findings remain useful, but it is not the active implementation plan.

## Implemented first change

- New bundled feedback policy starts with explicit corrected wording for all
  proactivity settings. No guessing ladder or required retry before seeing it.
- Useful corrections are no longer suppressed merely because they fall outside
  the selected practice focus or have a speculative slip/developmental label.
- The automatic prompt prioritizes meaning-changing errors, then useful grammar
  or word-choice corrections. It preserves intent, topic and register; correct
  language need not produce a comment. Ambiguity calls for clarification.
- Explicit corrections require an explanation and must change the quoted wording.
  The correction is a replacement for the source span, not an unrelated rewrite.
- Speech transcript guidance explicitly says the coach has not heard the audio.
  It must not claim pronunciation/listening assessment, treat transcript punctuation
  as a speaking error, or assert that a possible transcription mistake is the
  learner's language error. These are prompt requirements, not proven model quality.
- Automatically recommended skills no longer add a topic-steering instruction to
  partner prompts. Learner-selected focus remains subordinate to the current topic.
- Existing UI shows source → correction and explanation on opening/seeing the
  coach. Disclosure still records assistance exposure; no extra Show answer step
  is needed for the new direct corrections. No coach speech is added over partner
  audio. Partner reply and speech scheduling remain independent of coaching.

Prompt version: `coach-observation-7`. There are no additional model calls, no
model/route changes, no increased output allowance, no lesson implementation
changes and no workspace reset. The existing data and command contracts remain.
The changed policy governs new captured turns; stored feedback is not regenerated.

## Scope and remaining work

This is a bounded behavior correction, not completion of the wider architecture
audit. Automatic feedback still carries skill observations and the existing
candidate set; advice still shares validation/publication with evidence. Useful
corrections can still be constrained by that skill-oriented response shape.
Separating conversational feedback from skill assessment remains a follow-up,
with chat quality taking precedence over new educational machinery.

`on_request` still uses the existing collection/disclosure behavior; this change
does not claim it disables background inference. Existing XP/evidence calculation
is retained. Existing lesson features are frozen, not deleted or repaired.

Next inspection should use actual voice conversations: natural short exchanges,
correct language needing silence, an actionable grammar mistake, uncertain
transcription, and a change of topic. Check that the partner responds at the
selected difficulty, speech plays without waiting for coaching, the user can
continue immediately, and direct corrections are helpful. Evaluate false
corrections and topic continuity before expanding features. No paid live run was
performed in this task.

## Verification

Results are appended after the relevant checks finish. Synthetic tests establish
control flow and validation, not linguistic correctness or microphone/speaker QA.

- Native suite: 370 passed, 0 failed, 1 ignored live-provider test. The initial
  sandboxed execution could not bind synthetic localhost HTTP fixtures; the full
  suite passed with localhost permission. No live AI requests were made.
- New regressions cover direct voice feedback outside the active focus, required
  correction/explanation, unchanged-wording rejection, and speech/next-Send
  independence from pending or failed coaching. Empty feedback and valid evidence
  credit remain covered.
- Targeted UI run: 10 files / 91 tests passed across coaching, voice interaction
  and speech. The added direct-correction display test then passed with its two
  existing LiveCoachReview tests (3 total).
- Clippy with warnings denied, generated-contract consistency, TypeScript,
  interface-language checks, formatting and documentation links passed.
- After test-only cleanup, the partner prompt tests and practice-feedback tests
  were rerun. No application deployment, rebuild/install or paid inference was
  performed. Changes are uncommitted.
