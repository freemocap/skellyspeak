# Measurement experiment specimens

Historical design specimens. Subsequent experiments are complete and baseline B
is adopted; see the [current decision](../../baseline-assessment-decision.md). Statements below
about pending runs or strategy selection describe the earlier draft stage.


Draft for review. No provider calls or application changes.

See [the study design](study-design.md) for controlled comparisons, metrics,
proposed acceptance gates, the existing LLM comparator audit and run prerequisites.

- [Candidate measurement questions](measurement.yaml)
- [Nine Spanish possession cases](possession-cases.yaml)

## Two judgments

| Question | Choices |
| --- | --- |
| What evidence is present? | Absent, contextual, direct, unclear |
| Does the expression succeed? | Successful, partial, unsuccessful, unclear, not applicable |

“Direct” describes what is in the reply, not whether it is correct. “Contextual”
allows a meaningful short answer without treating the partner's construction as
something the learner produced. Neither is a numeric level.

| Example | Evidence | Expression |
| --- | --- | --- |
| Es de mi hermana. | Direct | Successful |
| Ana. after “Whose book?” | Contextual | Successful |
| Es de… | Direct | Partial |
| Ana. without context | Absent | Not applicable |

This distinction is a hypothesis to test, not an approved reward hierarchy.
Assistance remains outside these judgments; identical wording can receive the
same expression judgment with different practice-credit treatment later.

## Experiment composition

Use the shared instruction block from [the assessment review](../assessment-review.md),
then the selected skill content, language/variety context, learner input and these
questions. Expected judgments and reviewer notes are evaluation data and must
never be sent to the model. Attempt records are separate from text inputs; do not
let knowing that assistance was used change an expression-success label.

The existing Jev experiment code supports choice questions. This draft describes
candidate question content, not a verified current provider payload. Inspect the
transport and current API contract before implementing the runner. There is no
requirement to restore the old catalog, outcomes, thresholds or missing run files.

## Before a provider run

- Review these distinctions and cases, particularly contextual versus direct.
- Add completed-but-unsuccessful and genuinely ambiguous examples; current cases
  do not exercise every choice. Treat annotator disagreement as visible evidence.
- Add past reference and Arabic with explicitly applicable varieties. Use both
  focal skills in both languages. Broaden to all twelve before production selection.
- Create separate held-out cases. These nine are development examples, not an
  independent test set and not evidence of general accuracy.
- Compare content variants on identical inputs and question wording, including
  matched-information prose versus notation. Then test grouping and context.
- Choose acceptance criteria, run size and cost limits before provider calls.

Do not produce a synthetic model result or claim accuracy from fixture validation.
A choice probability is not an XP amount. No final numeric score or threshold is
selected here. Request interpretation and evidence/expression disagreements remain
things to inspect, not automatically repair into consistent-looking results.
