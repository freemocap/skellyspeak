# Prompt screening: 19 September 2026

Status: implemented experiment tooling and completed live screening. Recommendations
below are proposals, not application changes. All changes remain uncommitted.

Follow-up: the [broader recommendation](../recommendation-2026-09-20/README.md)
compares against the complete conversation-23 reference across three languages and
linked conversations. It supersedes this screen's tentative next-candidate advice.

160/160 calls completed on Gemini 2.5 Flash through the pinned Google AI Studio
OpenRouter endpoint. Provider-reported total cost: **$0.0235292**. All calls supplied
cost metadata and finished with `stop`. The three conservative batch reservations
totaled $1.021952; no individual batch exceeded $1. No retries were made.

## What was tested

1. [Initial screen](samples.md): four prompt styles × five difficulty levels ×
   opening/fixed continuation = 40 calls ($0.0102669).
2. [Focused follow-up](follow-up/samples.md): full/compact/no persona with stronger
   final instructions × two low levels × opening/continuation = 12 ($0.0011799).
3. [Factor screen](factors/samples.md): six alternatives × Absolute Zero/Beginner/
   Intermediate × opening/confusion/topic switch × two identical repeats = 108
   ($0.0120824). Each alternative changes one block relative to the control.

All use synthetic Spanish (Spain) and Lucía's source persona. No real conversations
were uploaded. Frozen input hashes and complete request payloads are in each
`plan.json`; results include response IDs, provider/model, usage, latency and finish
reasons. The baseline is the **current edited working-tree prompt**, whose opening
is `..` and ceiling is `.`. It is not a measurement of approved conversation-23.
No production prompt, persona, routing or application behavior was changed.

## Findings

The initial screen reproduced greeting-only and teacher-role failures. The current
Absolute Zero opening was “¡Hola! Me llamo Lucía. Soy de Valencia. ¿Y tú? ¿Cómo te
llamas?” The compact alternative still produced “Hola. Soy Lucía.” At Fluent, the
current prompt offered to help practise Spanish rather than acting as a partner.
Verbose prompts gave more concrete content but did not reliably obey low-level
sentence limits. Prompt length alone is not a useful optimization target.

Stricter final constraints improved the focused follow-up to 12/12 single-sentence
outputs, but two persona variants answered “No entiendo” with “¿Te gusta la playa?”
rather than clarifying. This is why the expanded screen separately tests
responsiveness, rather than treating sentence count as success.

The following are descriptive results, not statistical confidence estimates.
Single-sentence counts use `Intl.Segmenter`; the two intent columns are an
unblinded manual review of the saved outputs. Each has six samples (three levels,
two repeats). A clarification passes if it states the preceding meaning more
plainly; asking a new question or explaining *why* the beach is empty fails. A
topic switch passes if it contributes something about music and drops the beach.
Extra wording is evaluated separately; a clarification can pass while length fails.

| Alternative | Low-level single sentence | Clarifies confusion | Clean topic switch | Mean prompt tokens |
| --- | ---: | ---: | ---: | ---: |
| Compact-persona control | 11/12 | 5/6 | 4/6 | 220 |
| Full persona | 11/12 | 5/6 | 3/6 | 466 |
| No persona | 11/12 | 6/6 | 6/6 | 185 |
| Source difficulty block | 9/12 | 3/6 | 4/6 | 317 |
| No interaction guidance | 12/12 | 0/6 | 4/6 | 168 |
| Two behavioral examples | 12/12 | 6/6 | 5/6 | 283 |

Manual-review failure audit (IDs in `factors/results.jsonl`):

- Control clarification: `intermediate-control-confusion-r1` reverses who said what.
- Full-persona clarification: `beginner-full-persona-confusion-r2` asks “¿No hay gente?”
- Source-difficulty clarification: `absolute_zero-detailed-level-confusion-r1`,
  `beginner-detailed-level-confusion-r1`, `intermediate-detailed-level-confusion-r1`.
- No-interaction clarification: all six confusion samples.
- Control, source-difficulty and no-interaction topic switches: both Intermediate repeats.
- Full-persona topic switches: both Intermediate repeats and
  `beginner-full-persona-topic-switch-r2` (“Me parece genial.” adds no music content).
- Examples topic switch: `intermediate-examples-topic-switch-r2` returns to the beach.

Specific observations:

- The full persona costs roughly twice the input tokens of the compact control in
  this fixture, without an observed steering advantage. Its Intermediate opening
  on repeat 2 invents a learner interest: “Qué bien que te guste cocinar.”
- Removing all interaction guidance makes outputs short but loses clarification
  behavior entirely in this sample. Keep rules that specify what to do when the
  learner is confused or changes subject.
- Behavioral examples transfer well here: all six confusion outputs simplify the
  beach sentence, mostly to “No hay gente.” Examples used a closed shop, so this
  was not copying the example answer verbatim. Topic-switch guidance still leaks
  the old subject once; examples do not guarantee obedience.
- No persona follows topic changes cleanly here, but loses distinctive personal
  substance. Short generic replies such as “Me gusta la música” remain possible.
- The source Absolute Zero block explicitly suggests greetings and names. Its two
  factor openings both say “Hola. Yo soy Lucía,” despite the final no-greeting rule.
  This factor is **source wording versus concise wording**, not a pure length test:
  the Absolute Zero source block is shorter and changes semantic emphasis.
- All 12 factor openings at Absolute Zero gravitate to coffee or greetings. This
  screen has not solved variety or repeatability across different people/topics.

## Proposed next production candidate

Keep the rich persona as authored character data, but test sending only a compact
identity plus a few relevant facts to the conversation model. Exclude competing
style directives such as “plenty of questions”; let difficulty and turn rules own
language complexity, response length and questioning.

Keep concise, positive difficulty guidance and explicit clarification/topic-change
behavior. Use a couple of short behavioral examples, then put the applicable turn
constraints last. Remove low-level greeting/name priming from the candidate opening
guidance. Do not permanently remove persona data or relax learner constraints based
on this screen.

The **combination** of compact persona plus examples is tested here, but the proposed
removal of greeting priming, fact selection and broader variety are not yet a
production-validated solution. Two repeats per cell cannot establish reliability.
There is no need to spend more until the concrete samples are reviewed.

## Limits and verification

Independent prompt assembly follows the native builder's relevant ordering; it was
not exported from Rust. Fixed history isolates follow-up comparisons but does not
measure several-turn conversation dynamics. Only one language, persona and model
were sampled. The output cap is 512 rather than the app's 2,048; no result truncated.
Advanced/Fluent have initial samples only, not the repeated factor screen. The
low-level Spanish topic-switch request is a controlled diagnostic input, not a claim
about what an absolute beginner can independently produce.

Order rotates alternatives; repeated outputs are not proof of independent samples
or determinism. A native/fluent reviewer and real learner feedback are still needed
for linguistic accessibility and conversational interest. No LLM judge was used.
Blind review sheets are provided but not scored; the analysis above was unblinded.

Passed four offline tests (price refusal, paired histories/coverage, metadata
retention/redaction, one-factor/repeat isolation), strict TypeScript checking and
all live completion checks. Existing unrelated whitespace in
`ui/src/styles/features/activity/ai-view.css` causes a repository-wide diff check
warning; this experiment does not edit that file. No application build or deployment
was needed. No commit was created.

Reproduction and credentials: [tool README](../../../../tools/benchmarks/conversation-prompts/README.md).
