# Conversation prompt recommendation

**Superseded for conversational quality:** user testing rejected the question-only pilot. See the [meaning-based comparison](../engagement-2026-09-20/README.md). Historical results below are not current acceptance.

Status: completed live evaluation and implementation recommendation. **Production
prompts remain unchanged.** This supersedes the initial screen's tentative candidate
recommendation, while retaining its observations as historical evidence.

## Recommendation

Build the next **internal pilot** around `compact-grounded`: a small persona
projection, explicit conversational behavior, a few localized examples and the
selected difficulty placed last. Keep Gemini 2.5 Flash for this pass. The evidence
supports changing prompt construction before adding models, retries or more rules.

The pilot is justified by better constraint following and lower input size. It is
**not yet a proven general quality improvement**: generic replies remain, one
Mandarin probe copied the example's topic, and the revision did not consistently
improve advanced discussion. Do not replace every supported language's production
prompt on this evidence alone.

The key recommendation is to give each part of the prompt a clear job:

| Part | Recommended responsibility | Remove from that part |
| --- | --- | --- |
| Language | Requested variety and writing system | Learner assessment and conversation steering |
| Persona projection | Name, location, two interests, two opinions | Manner directives, lists of media, vibe symbols, repeated biography |
| Conversation behavior | Respond to meaning, clarify confusion, follow topic changes, contribute one useful detail | Generic demands to be engaging or entertaining |
| Examples | Show clarification, topic change and preservation of who said what | Fixed opening scripts and examples mistaken for current history |
| Difficulty | One selected level; vocabulary, grammar, response demands and low-level sentence limit | Repeating the same constraints throughout the prompt |
| Topic/time | Learner-selected subject and time preference, subordinate to difficulty | Forcing the persona's interests or a tense into every response |

Keep the full authored persona in its existing profile. The tested projection is
deterministic and needs no additional AI call: `name`, `location`, first two
`interests`, first two `opinions`. This is a small initial policy, not evidence that
these are always the best facts. Do not delete biography data or simplify the
persona-generation model merely to reduce conversation input. Rich profiles and
small conversation requests can coexist.

The exact tested renderer is
[candidateSystem](../../../../tools/benchmarks/conversation-prompts/validation.ts),
with variant `compact-grounded`. [A complete compiled candidate](candidate.md)
shows the wording. Reuse the tested candidate as a starting point; do not describe
untested combinations of its parts as validated.

## What the experiments establish

This round completed **255/255 calls for $0.0568119** in provider-reported cost.
Together with the earlier screen: **415 calls, $0.0803411**. All calls finished
normally; no automatic retries or truncated samples. Cost records were present for
every call. The four new conservative reservations totaled $1.628736, which is not
the billed cost.

All calls used Gemini 2.5 Flash through OpenRouter's pinned Google AI Studio endpoint,
temperature 0.7, reasoning disabled, 512 maximum output tokens. These are direct
provider experiments, not app integration tests or measurements of the hosted
service, speech, gloss generation or end-to-end conversation latency.

### Cross-language fixed-context comparison

135 calls cover Spanish/Spain, Levantine Arabic and Mainland Mandarin; all five
levels; openings, confusion and topic changes. Advanced/Fluent openings additionally
exercise a selected topic and future/past reference. Advanced learner inputs include
a reasoned opinion about music recommendation algorithms. The baseline is the full
**conversation-23** reference, not the incomplete current edited opening.

| Variant | Calls | Mean input tokens | Low-level single-sentence turns | Median request time | Reported cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full conversation-23 | 45 | 977 | 9/18 | 599 ms | $0.016115 |
| Compact, no examples | 45 | 338 | 18/18 | 583 ms | $0.006741 |
| Compact + two examples | 45 | 410 | 18/18 | 547 ms | $0.007023 |

The two-example candidate used **58% fewer input tokens** than the full reference
in this matched set. This is a prompt-size result, not a claim that prompt length
alone caused better behavior. The compact candidate changes both wording and data.
Latency differences are descriptive and not a reliable speedup estimate.

Concrete quality evidence:

- Full-reference Spanish Absolute Zero: “Hola. Soy Lucía.” Compact with examples:
  “Me gusta la paella.” The latter supplies a specific preference to react to.
- After “La tienda está cerrada” / “No entiendo,” the reference Intermediate reply
  asked whether the learner needed something and speculated about midday closing.
  The examples candidate said “No está abierta.”
- The no-example Mandarin Beginner reply to confusion was “你为什么不懂？”
  (“Why don't you understand?”). The examples candidate re-expressed the shop closure.
- The examples candidate stayed on the same shop meaning in all 15 fixed confusion
  cases. This does not mean all 15 were easier: Mandarin `打烊` and `营业` may be less
  accessible than the original `关门`. Vocabulary suitability still needs review.
- Compact no-example Arabic Fluent ignored the offered algorithm argument and
  announced a mood for Umm Kulthum. The examples version addressed the algorithm
  tradeoff. At Fluent in other cases, even the examples version mostly paraphrased
  the learner instead of extending the thought.

See [all fixed-context responses](validation/samples.md) and
[mechanical metrics](validation/metrics.json).

### Linked conversations reveal failures the isolated cases miss

Each chain has four partner turns: opening, response to confusion, response to a
topic change, and response to a learner preference. Each request includes that
candidate's actual preceding outputs. Learner interventions are scripted, not an
AI learner or real user study.

| Variant | Calls / chains | Mean input tokens | Low-level single-sentence turns | Clarification preserves speaker and main meaning |
| --- | ---: | ---: | ---: | ---: |
| Full conversation-23 | 24 / 6 | 1,004 | 0/12 | 0/6 |
| Compact + two examples | 24 / 6 | 415 | 12/12 | 5/6 |
| Compact-grounded revision | 24 / 6 | 583 | 12/12 | 6/6 |

The last column is an **unblinded assistant review**, with per-case reasons in
[reviewed-cases.json](reviewed-cases.json). It measures preservation of meaning and
speaker, not guaranteed simplification or overall conversation quality. The revision
was run in a later batch, not a simultaneous controlled trial.

The full reference frequently treated its own preceding partner message as learner
content. One Arabic reply welcomed the learner as Nūr and claimed the same age and
job. One Mandarin reply attributed the partner's delivery job to the learner.

The two-example candidate also failed once: after the partner said it liked cycling,
its clarification became “你喜欢晚上骑车” (“You like cycling at night”). The revision
adds explicit ownership of assistant-role messages and a first-person example.
All six revised chains preserved ownership, though one Arabic clarification merely
repeated the original sentence rather than making it easier.

There is some improvement in follow-up substance: revised Spanish adds “Yo escucho
música antes de nadar” rather than the earlier “Yo escucho música.” However, Mandarin
still ends one chain with “我也喜欢在家听音乐” (“I also like listening to music at home”).
It is relevant but offers little new material. **Short and compliant is not the same
as conversationally useful.**

Read [original linked outputs](dialogues/samples.md) and
[revised linked outputs](revision-dialogues/samples.md), which show the immediate
prior partner and learner text alongside each response.

### Targeted revision: improvement with a real tradeoff

48 additional paired calls compared the two-example candidate with the revision,
using two repetitions in each of three languages. The probes covered novice
openings, ownership-preserving clarification, preference responses and a new Fluent
argument about shorter working weeks. These are development probes chosen after
seeing failures, not an untouched statistical holdout.

The revision produced relevant, ownership-preserving clarification in **5/6** probes,
versus **1/6** for the earlier candidate, under the recorded review criterion. Both
preserved one sentence in all 18 low-level turns per variant. But the revision's
remaining failure matters: when the actual history was “I like tea,” it answered
“I like cycling,” apparently copying the added example. More examples are not
automatically safer.

The revision also added more personal detail to advanced arguments, but sometimes
weakened responsiveness. One Spanish response dragged music back into a work-hours
discussion. One Arabic response justified free time by returning to productivity,
the very framing the learner had challenged. Keep these failures visible; the
revision has not won on advanced reasoning.

See [paired revision outputs](revision/samples.md). The revision used about 40%
more input tokens than the two-example candidate in this matched probe set. In
linked runs it still used about 42% fewer tokens than the full reference. Choose
the extra instruction only for its measured behavior, not because more text feels
safer.

## Implementation recommendation and ownership

1. **Keep persona storage and authored profiles unchanged.** Add the small pure
   projection at the conversation prompt boundary in
   `native/src/conversations/conversation_prompt.rs`. Preserve speaker roles and the
   existing history transaction/dispatch ownership. No additional inference or
   persistent derived persona is needed.
2. **Give difficulty final priority once.** Retain the five existing learner settings
   and their approved low-level one-sentence constraint. Prompt assembly should
   place the selected constraint after persona, task and examples. No global word
   limit, automatic difficulty increase or new learner setting.
3. **Keep behavior explicit.** Clarify the partner's own preceding meaning; follow a
   new topic; contribute a specific detail when appropriate; ask at most one useful
   question. Persona `manner` must not independently control questions, length or
   topic redirection. Keep examples localized and clearly distinct from history.
4. **Preserve observability.** Capture the exact assembled prompt/version, compact
   projection and selected settings with the existing turn capture. Retain provider
   metadata and generated outputs. Do not hide poor replies through paid retries.
5. **Pilot the tested structure before broad adoption.** Editable wording remains
   under `content/prompts/conversation/`; native code owns assembly. A language/
   variety-keyed example block will need an explicit content schema and validator
   extension—the current prompt schema has no example field. Use that owner rather
   than baking multilingual examples into Rust or a new UI preference. Maintain
   full data for partner generation, profiles and reactions.

This is an implementation proposal, not an instruction to ship an unreviewed
schema or a promise that all persona-related tasks should use the compact view.
The exact local experiment code is TypeScript; production contracts remain Rust
generated as required by the repository.

## Finite gates before switching the app

- Export the proposed **real native assembled prompts** and compare them with the
  experiment snapshots. Verify target variety, selected level/topic/time, persona
  projection and unchanged role-ordered history. The current experiment's renderer
  independently follows the relevant native ordering; it is not the native builder.
- Treat speaker reversal, example-topic copying and continued confusion without
  clarification as blockers in the pilot cases. Add the tea→cycling and full-role
  confusion failures to the permanent regression set. Do not “fix” them by silently
  changing model, appending an extra sentence or reissuing a paid request.
- Have a fluent reviewer inspect the small Arabic/Mandarin sample and beginner
  vocabulary; then review several actual app conversations for reply opportunities
  and reading/speech fit. The saved blind sheets are available but have not been
  independently scored. Fix or scope unsupported examples before broad rollout.
- Check Advanced/Fluent separately: a response should add a reason, implication,
  distinction or grounded counterpoint when the learner supplies an argument. It
  need not be longer, debate every point or end with a question.

Stop prompt expansion if another added instruction fixes one case while breaking
another. The next useful evidence is these specific regression/app checks, not a
larger undirected batch of prompts. Scenario-specific example selection is a
possible follow-up to investigate; it has **not** been tested here and is not part
of the measured recommendation.

## Verification and limits

Six offline tests pass, including paired/repeated inputs and linked-history isolation;
strict TypeScript checking passes. All new live trials completed and retained costs,
IDs, timing, model and finish metadata. Source fixture hashes, full plans and actual
linked request histories are retained. No app build, production deployment or commit
was performed; unrelated working-tree edits were preserved.

The results cover only three synthetic personas/languages and one provider/model.
Short scripted chains cannot establish learning outcomes, long-run variety or true
CEFR accessibility. Advanced/Fluent time/topic settings vary by level, so differences
between levels cannot be attributed to level alone. The shorter 512-token cap differs
from the app's 2,048; no completion hit the cap. No independent statistical claim or
human preference win is made. Exact terminal punctuation is not a complexity score.

[Pre-run protocol and revision protocol](protocol.md) ·
[Reproduction instructions](../../../../tools/benchmarks/conversation-prompts/README.md)
