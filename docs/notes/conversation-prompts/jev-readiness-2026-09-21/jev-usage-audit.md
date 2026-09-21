# Jev usage audit and comparison correction

Status: documentation/code audit, September21; no new inference calls. Existing
results and frozen requests remain unchanged. This audit does not claim exhaustive
coverage of every vendor document or empirical proof of an optimal formulation.

## What was actually tested

Study1: current sparse LLM, dense full-list LLM, Jev alone.
Study2: current sparse LLM, Jev alone (called “screening”), Jev+evidence LLM.
Study2 replaced the dense LLM arm with the hybrid; it did not remove Jev alone.
The final response wrongly emphasized only the two quote-producing paths.
The dashboard now labels Jev alone explicitly and orders the three paths current,
Jev alone, hybrid. Hybrid failure is not evidence that Jev alone failed its task.

In Study2 matched valid trials, Jev alone detected all44 positive focal targets
with no false alarms among23 absent focal targets. Full-demonstration scoring
instead gives23 hits and4 false alarms among44 negative targets (partial attempts
included as negatives). Those are67 repeated/related judgments over18 provisional
case-skill labels, not67 independent samples. Jev had70/72 valid responses overall;
two responses failed existing probability-consistency checks. Rejected numerical
distributions were not retained, preventing exact retrospective diagnosis.

## Confirmed against primary documentation

- Correct application family: fast classification/structured judgments, not free
  text or explanations. [@typesafeSystemOne2026]
- Shared JSON state and45 independent Choice questions in one request match the
  documented batching pattern. All criterion meanings are in instructions, not
  only in question IDs (which the model does not see). [@typesafePrimitives2026]
- Choice option descriptions cover demonstrated, partial, attempted failure,
  absence and uncertainty. This is a defensible categorical formulation, not a
  proven best one. We used explicit absence rather than forced positive labels.
- Validation's sum/argmax expectations match Choice documentation. That supports
  the rule, not a diagnosis of the two discarded invalid responses. [@typesafeChoice2026]
- Confidence is distribution concentration, not demonstrated proficiency or a
  proven per-answer correctness probability. We retained it and used outcome
  probabilities in ROC, without claiming task-specific calibration.

## Missed guidance and untested alternatives

1. Fields: instructions named currentLearnerMessage but did not use the explicit
   backticked field-path notation recommended for structured-state references.
2. Atomic tasks: try separate Noul questions for any attempt and full demonstration
   rather than deriving both exclusively from a five-way Choice. These are
   probabilities of well-defined propositions, not continuous learner ability.
3. Label boundaries: compare current Choice to concise structured option definitions
   and development examples, keeping evaluation examples out of instructions.
4. Score: appropriate only for a genuinely ordered, clearly anchored evidence
   scale. Absence, failed attempt and uncertainty are not automatically points on
   one proficiency scale; do not mechanically convert our five categories.
5. Context: vendor recommends relevant context only. We deliberately injected
   partner distractors as a robustness test; that is not a claim that such context
   should always be supplied in production. Test lean state versus relevant context.
6. English primarily: vendor explicitly documents lower non-English accuracy.
   Spanish-only pilot results cannot establish multilingual suitability.
7. Threshold0.5/top4 is OUR hybrid policy, not a Jev requirement. Jev-alone outcomes
   are uncapped. We did not test alternative thresholds with independent labels,
   abstention policies, or calibration on held-out message families.
8. No explanation-generation ability is a known model boundary, not a failed
   capability test. Preserving the old generated-quote/rationale contract was an
   implementation experiment, not the only admissible app architecture.

Next recommended experiment: compare Jev alone under current Choice, structured
Choice, and atomic Noul formulations, using the same reviewed focal tasks and
explicit source paths. Keep45 skills uncapped. Measure separate detection and
full-demonstration SDT, calibration/abstention, speed, cost, and transport validity.
Freeze development/evaluation family splits and retain bounded rejected decision
fields before running. Do not claim one formulation is better until measured.

## Sources reviewed

- https://docs.typesafe.ai/concepts/system-one
- https://docs.typesafe.ai/concepts/state
- https://docs.typesafe.ai/primitives
- https://docs.typesafe.ai/primitives/choice
- https://docs.typesafe.ai/primitives/noul
- https://docs.typesafe.ai/primitives/score
- https://docs.typesafe.ai/confidence
- https://docs.typesafe.ai/concepts/how-to-build-with-system-one
- https://docs.typesafe.ai/models
- https://openrouter.ai/typesafe/jev-1.13
- https://openrouter.ai/labs/jev/compile (documents all three primitive types)

The llms.txt index was inaccessible through the web tool; linked primary docs
were used. No vendor agent skill was installed or executed. The broad earlier
claim that this was a best-use comparison was not established.
