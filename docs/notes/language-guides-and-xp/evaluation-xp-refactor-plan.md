# Evaluation and XP refactor: current checkpoint and sequence

Status: **working execution proposal**, 2026-09-24. Decisions are recorded in
[the skill plan](learner-facing-skill-plan.md). New evaluation, XP and app behavior
are not implemented. No new Jev calls or bulk guide generation have been run.

## Where we are

The authoring workbench and YAML schema conversion have prior implementation and
verification notes. They support inspection; they do not validate the new learning
model. Twelve terse shared definitions are accepted as a first pass. Composition
replaces the strict tree, and progression is separate. Language/variety additions
are supported by the intended content model, not yet by a newly verified runtime.

The current conversation supersedes old tree counts, progression-inside-skill
requirements and old-system preservation work in earlier notes. Existing coaching
restoration documentation describes prior behavior, not a requirement to retain
obsolete skill or reward contracts. Conversation assistance and unrelated product
behavior are outside this refactor unless an explicit dependency requires review.

## Sequence and review artifacts

| Stage | Work | Artifact the user reviews before the next dependent step |
| --- | --- | --- |
| 1. Structural content pass — next | Separate core definitions, applicability, language teaching, assessment guidance and progression; resolve the three open skill boundaries | A small readable specimen and a fully composed Markdown prompt in chat, followed by draft YAML after agreement |
| 2. Define the measurement | Decide what a skill score means, what a unit of practice is, and how revisions/context/assistance are represented | Worked input/output cases, including absent skill, unsuccessful attempt, uncertainty, multiple skills and an assisted retry |
| 3. Small Jev experiment | Test definition length and guidance content first, then input grouping/context and output detail; compare viable model routes | Reviewed fixtures, run plan and cost estimate before provider calls; measured accuracy, latency and cost report afterward |
| 4. XP policy experiments | Use fixed assessment/event fixtures to explore repetition, novelty, assistance, retry effort, improvement and leveling | Interactive curves and numeric attempt histories, including repeated resends and unchanged revisions |
| 5. One integrated app slice | Implement the selected content resolution, Jev assessment, saved observations, deterministic award and requested explanation for a limited pilot | Working learner flow, targeted verification and explicit coverage limits; review before broader rollout |
| 6. Bulk authoring and review | Generate skill guides and writing/reading guidance for the agreed language/variety inventory offline | Generation inventory, small batch, human edits/review, then coverage report and further batches |
| 7. Expand and retire obsolete behavior | Apply the verified flow across covered languages; remove replaced code/config, reset affected development data and exercise end-to-end behavior | Complete source/verification checkpoint with remaining linguistic review gaps disclosed |

Stages 3 and 4 need not be entirely sequential: XP can be explored using synthetic
observations once their semantics are defined. Final XP tuning must account for
measured evaluator behavior. A small amount of pilot guide authoring is needed
before stage 3; bulk production is intentionally delayed until the structure and
assessment needs are stable. No new course/progression subsystem is needed to
complete this evaluation/XP slice.

## Structural specimen

Keep a small common identity and applicability model for shared and language-defined
skills. Skill cores remain terse. Keep human teaching sections distinct from
assessment sections while composing both from the same authored source of truth.
Resolve shared language core plus the selected variety explicitly. Do not use MSA
as a silent Arabic default. Include one illustrative language-defined extension
in structural fixtures to test composition without committing to a new real skill.

Show the actual filled prompt as Markdown, with each included section traceable
to its source. Preserve human edits; no regeneration over reviewed prose. Final
storage shape and native contracts follow the content/behavior review.

## Measurement questions to settle before benchmarking

- Distinguish skill presence/use, successful realization, uncertainty and amount
  of practice. Do not call a single uninterpreted number all four things.
- Choose the primary observation unit: message/revision, with optional source-linked
  groups as evidence. Several spans must not silently become several practice events.
- Include conversation context when meaning depends on it. Define what is missing
  or unassessable rather than treating absence of evidence as failure.
- Retain actual attempt/revision ownership and supplied assistance. Do not infer
  independent production solely from text similarity to a suggestion.
- Specify how broad skills retain the meaning actually observed without claiming
  that every component has been demonstrated.
- Keep explanatory prose off the required scoring path. Preserve sufficient input,
  content/model identity and validated result provenance to explain the saved
  assessment later. Requested explanations must not silently rescore it.

These are semantic decisions first. Exact output fields, score scales and provider
contracts are subsequent choices, informed by the experiment.

## Jev experiment design

Use a small reviewed set before scaling. Start with possession and past reference
in both Spanish and Arabic so language and skill are not confounded by using one
skill per language. Include Levantine and MSA cases with explicit applicability;
first specimens do not imply complete Arabic coverage. Add coverage cases for all
twelve definitions before adopting a production evaluator. Mandarin and Hindi
provide later cross-script checks before expanding the language set.

Include correct, incorrect and ambiguous uses; short replies; multiple simultaneous
skills; negation; implicit time; questions versus requests; assisted attempts and
revisions. Record reviewer disagreement. Split development examples from held-out
assessment cases so prompt tuning is not evaluated on its own examples.

First compare, on the same inputs and output semantics:

1. Concise skill definitions and boundaries only.
2. Definitions plus selected compact language/variety assessment guidance.
3. Definitions plus fuller teaching guidance as a comparison condition.

Then compare whole-message versus source-linked grouping, necessary conversation
context, and whether span outputs help enough to justify their latency/cost. Do not
run every combination of every variable by default. Compare model routes after
establishing a useful content/input format; repeat a bounded subset to measure
stability. Any candidate prefilter must be measured for missed skills, against an
all-twelve reference condition, before it becomes a speed optimization.

Measure per-skill and per-variety false positives/negatives, agreement with reviewed
judgments, uncertainty/abstention, structured-output failures, repeatability,
end-to-end latency (including grouping), input/output tokens and actual billed
cost when available. Report estimated cost separately. Use latency distributions
when sample size supports them, not just averages. If scores represent probabilities,
measure calibration before treating them as confidence.

Set acceptance thresholds and a bounded call/token/spend plan before the run.
Choose the lowest-cost, fastest configuration that meets those thresholds; no
numerical thresholds or winning model are asserted yet. User review of the concrete
run plan is the provider-spend checkpoint. No provider/model prices are assumed.
Existing harness code can be reused after inspection; missing old result artifacts
are not a restoration prerequisite. New fixtures/results must be clearly labeled.

## XP policy and implementation checks

The evaluator supplies observations. Deterministic code calculates credit using
those observations and attempt history. Explore diminishing repetition rewards,
meaningful novelty, assistance, substantive retries and improvement. Reward retry
work without allowing unchanged resends or cycling edits to farm full awards.
Keep XP separate from proficiency and from model uncertainty.

Review worked histories for a first attempt, assisted attempt, correction, failed
retry, unchanged resend, combined skills and repeated familiar use. Choose how to
allocate credit across composed skills explicitly. No automatic ancestor awards.

For the pilot implementation, test duplicate deliveries, concurrent completion,
app restart, late results for superseded revisions, evaluation failure and requested
explanations. An inference failure is not evidence of poor language performance.
Verify one-time credit, saved assistance/revision provenance and UI totals against
the same deterministic calculations. Reading annotations are not automatically
pronunciation/spelling evidence; account for transcript uncertainty in speech flows.
Preserve required reward presentation while changing its underlying award inputs.

Replace obsolete feature code and contracts directly. No migration or compatibility
layer. Inspect ownership before resetting affected development records; unrelated
work and unrelated data are not part of a learning reset by default.

## Bulk generation gate

Do not generate all guides merely because twelve names have been chosen. Begin
when skill boundaries, composition, evaluator guidance needs and the pilot flow
have survived review. Plan the language/variety coverage inventory explicitly.

Generate offline in small inspectable batches. Track authorship, source review,
human edits and content identity; validate links, required sections and readable
composition. Linguistic review is distinct from schema validation. Shared script
material and language reading guidance have their own coverage inventory and do
not create a Read app surface or reading XP by implication.

## Git checkpoint

Inspection on 2026-09-24 found branch `main` with a substantially mixed uncommitted
checkout: workbench, YAML schema conversion, language-guide contracts, speech
routing and redaction relocation. This is not one ready-to-commit feature change.

A focused documentation checkpoint can include exactly:

- `docs/notes/language-guides-and-xp/README.md`
- `docs/notes/language-guides-and-xp/learner-facing-skill-plan.md`
- `docs/notes/language-guides-and-xp/evaluation-xp-refactor-plan.md`

These files are currently untracked as part of the notes directory. The README
links other existing local notes that are also untracked; include those referenced
notes if publishing this documentation as a standalone commit, or narrow the commit
to the latter two files, which link only each other. Do not stage the whole checkout.
Suggested branch name: `codex/skills-evaluation-xp`. The user said they will create
the branch and commit; neither operation has been performed by this task.

This checkpoint documents direction, not completed implementation. Prior workbench
and schema changes need a separate scoped diff and relevant checks before committing.

## Verification for this checkpoint

Documentation reconciliation only. Read back the updated plan and check whitespace
and local links. No runtime tests rerun, provider calls, data reset, branch creation,
staging or commit performed. Earlier test results in the README are historical,
not fresh verification of the current mixed checkout.
