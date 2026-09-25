# Jev exploratory pilot — 2026-09-24

**Completed:** 180 calls, all valid, actual reported cost **$0.012875268**.
Jev only. No LLM comparator, pass/fail gate, automatic winner or XP decision.
The user explicitly requested exploration of quality, time and cost together.

## Scope

18 Spanish/Mexico development cases × five content variants × two repetitions.
Every call evaluates possession and past reference, with separate evidence and
expression questions: four judgments per call. Cases and expected labels were
frozen before inference; expectations are AI-authored provisional references,
not independent gold labels. No held-out set was used in this exploratory pilot.

The small pilot replaces the proposed 720-call first run for this checkpoint.
Arabic and the full twelve-skill workload have not been evaluated. The unsuccessful
reference class is not covered; linguistic accuracy and generalization remain open.
The language guidance is a small experimental specimen, not a full reviewed guide.

## Observed tradeoffs

| Variant | Focal agreement | All judgments | Median / p95 latency | USD per 1,000 calls |
| --- | --- | --- | --- | --- |
| A: core | 64/72 (88.9%) | 136/144 | 166 / 265 ms | 0.0588 |
| B: language guidance | 66/72 (91.7%) | 138/144 | 169 / 248 ms | 0.0667 |
| C: language + meaning prose | 67/72 (93.1%) | 139/144 | 181 / 295 ms | 0.0760 |
| D: language + notation | 66/72 (91.7%) | 138/144 | 178 / 314 ms | 0.0750 |
| E: fuller guide specimen | 62/72 (86.1%) | 134/144 | 171 / 342 ms | 0.0811 |

Focal agreement includes the two judgments for each case's intended focal skill,
including absence controls. All-judgment agreement additionally includes the
other skill, generally absent. The latter therefore looks better. Repetitions
are dependent; 72 judgments are not 72 independent examples. A few changed labels
explain the differences; no significance or calibrated-confidence claim is made.
Cost per 1,000 is a linear scaling of this measured two-skill workload, not a
prediction for full-catalog production. Latency is request-to-validation including
network time. Sequential requests used rotated arm order within case/repetition.
Actual returned model: `typesafe/jev-1.13-20260917`.

## Cases worth inspecting

- **Ana. after a whose question:** every arm called expression partial, against
  our successful reference. This exposes the definition of successful contextual
  evidence; do not tune the label or prompt merely to improve a headline score.
- **Vivo aquí. while assessing past reference:** some arms called it unsuccessful
  rather than not applicable, despite absent evidence. Independent questions can
  disagree; results were not repaired or collapsed.
- **El lunes. without context:** every arm called evidence absent rather than
  unclear. Review whether our unclear reference is the right target.
- **Ayer…:** notation and fuller-guide arms called it contextual rather than direct.
  The evidence boundary needs review; it is not settled by the formula.

No partner-only evidence errors appeared in these limited controls. One repeated
judgment changed in arm C; the other repeated choice labels were stable. These
observations do not establish reliability outside the selected cases.

## Artifacts and reproduction

- [Frozen plan and exact requests](plan.yaml)
- [Run metadata and verified prices](run.yaml)
- [Attempt log](attempts.yaml)
- [Validated receipts](receipts.yaml)
- [Summary and individual judgments](summary.yaml)

The plan excludes expected labels, review notes and assistance metadata from
provider payloads. Assistance remains in fixture records for later XP work.
All inputs are authored fixtures, not private learner messages. Metadata retains
billing, model identity and validated decision distributions; raw response content
is not logged. Legacy metadata helper marks token fields as omitted before the
pilot runner restores the supplied numeric input/output token counts; the numeric
fields in receipts are present and used by the analysis.

Tooling: `tools/benchmarks/conversation-prompts/assessment/skill-pilot/`.

```sh
node --test tools/benchmarks/conversation-prompts/assessment/skill-pilot/run.test.ts
node tools/benchmarks/conversation-prompts/assessment/skill-pilot/analyze.ts docs/notes/language-guides-and-xp/jev-pilot-2026-09-24
```

The live runner refuses an existing run, stops on failures, performs no retries,
and verifies the frozen plan and current price ceiling. Conservative reservation
was $0.176862 under a $1 cap. An initial local YAML alias-limit error occurred
before any inference; the unstarted plan was rewritten without aliases. There
were no failed provider calls and no extra smoke calls.

Verification: two focused tests and strict TypeScript checking passed; all 180
receipts validated. No runtime/native/app changes, data reset or commit. The
interactive visualization in chat uses this summary's actual observations.

## Next review

Inspect the disagreements and compare the two judgment dimensions separately.
Choose whether to revise the rubric, references or neither, recording that choice.
Then add Arabic and richer negative/ambiguous cases, with a fresh comparison batch.
No automatic larger run or bulk guide generation follows these exploratory numbers.
