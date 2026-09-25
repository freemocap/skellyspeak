# Evaluation and XP refactor: current checkpoint and sequence

Status: **baseline B adopted; prompt-strategy experiments closed**, 2026-09-24.
The user accepts the observed roughly 85–87% reference agreement as sufficient to
proceed with development. This is a product decision, not proof that strategies
are equivalent or that all skills have been validated. See the
[adoption decision](baseline-assessment-decision.md) and
[completed multilingual report](jev-multilingual-2026-09-24/README.md).

Rich explanations, examples and optional meaning notation stay in human-readable
language guides. Jev receives compact baseline content. The twelve-skill pilot
content and presence → experience/effort → displayed XP flow are now implemented
and tested. See [the integrated checkpoint](live-presence-xp-checkpoint.md).
Coach-led conversation selection is now implemented; see [its checkpoint](coach-selection-checkpoint.md). The live profile and guide inspectors are implemented. The next gate is the interactive Spanish pilot.
Bulk teaching-guide generation and further prompt sweeps remain deferred.
Implemented source slice: [the live experience profile](saved-experience-assessment.md):
deterministic counts from current records, updated when viewed and when evidence
changes. No AI call, saved write-up or explicit refresh. The live Skills count table is
implemented; optional skill-targeted drill generation is now connected. Content-availability display remains a follow-up.

Spanish integrated pilot: [automated results and interactive trial](spanish-integrated-pilot.md).
Native accounting/guides/recommendation integration passes. The user reports the
local loop is working. Coach-intent visibility and one-action analysis are now
implemented; see [the polish checkpoint and proposed PR gates](analysis-and-coach-intent-checkpoint.md).
Interactive verification of that latest polish in a matching build remains open.

Source attribution now follows thresholded presence through a dependent fast
request; see [implementation and verification](skill-attribution-checkpoint.md).
Missing supporting spans retain whole-message evidence and do not remove credit.

## Where we are

The authoring workbench and YAML schema conversion have prior implementation and
verification notes. They support inspection; they do not validate the new learning
model. Twelve terse shared definitions are accepted as a first pass. Composition
replaces the strict tree, and progression is separate. Language/variety additions
are supported by the native content contract and tested resolver. Live conversation assessment now captures them explicitly.

The current conversation supersedes old tree counts, progression-inside-skill
requirements and old-system preservation work in earlier notes. Existing coaching
restoration documentation describes prior behavior, not a requirement to retain
obsolete skill or reward contracts. Conversation assistance and unrelated product
behavior are outside this refactor unless an explicit dependency requires review.

## Sequence and review artifacts

| Stage | Status and work | Concrete review artifact |
| --- | --- | --- |
| 1. Shared skills and content structure | Twelve accepted cores now authored in `content/shared/skills.yaml`. Native loading, language extensions, explicit variety coverage and Markdown/compact composition implemented. Compact pilot guides cover all twelve skills in Spanish/Mexico, Spanish/Spain, Arabic/Levantine and Mandarin/Mainland China. | [Current content checkpoint](catalog-content-checkpoint.md); compact guidance is ready for linguistic review |
| 2. Prompt strategy | **Complete: baseline B adopted.** Preserve the experimental alternatives, frozen requests, receipts and reusable tooling. | Completed multilingual dashboard and adoption decision |
| 3. Attempt and observation model | **Implemented and tested:** count experience from skill use and effort from changed retries. Success is not an input to XP or recommendations. Record attempt/revision ownership; changed retries credit every retained skill. | Worked attempt histories and proposed saved observations; no XP numbers disguised as model probabilities |
| 4. XP policy | **Implemented: XP = experience + effort**, each weighted 1 per skill. No success bonus, multipliers, assistance discount or diminishing-return curve in the first version. | Counting example below; durable awards and displayed totals now use this rule |
| 5. Experience profile and recommendations | Coach-led conversation selection implemented: Explore, Continue practicing, and Coach’s choice. Live profile counts and optional skill-targeted drill generation are implemented; see [the drill checkpoint](drill-skill-generation-checkpoint.md). Use recorded XP/use distribution to identify underexplored skills, guide optional practice, and show a live deterministic language-level profile. | One learner history → profile counts and targets → conversation, coach and drill/card recommendations; learner controls and live-update examples |
| 6. Integrated pilot | Presence/XP slice implemented. Automatic-on-open analysis, saved skill evidence and coach-intent previews implemented. Remaining: matching-build interactive verification and final scoped diff review. Optional drill generation now supports manual skill targets and the shared coach modes. Check all twelve skill outputs plus a language-defined extension fixture without reopening the prompt sweep. | One working practice → assessment → XP/profile → recommended practice loop; duplicate/restart/late-result tests and disclosed content coverage |
| 7. Offline authoring | Deferred until content composition and pilot flow are stable. Generate language-skill, shared writing-system and language-reading guides in inspectable batches; preserve human edits. | Coverage inventory, first batch, human-readable Markdown review and validation report |
| 8. Expansion and cleanup | Pending. Expand covered languages/varieties; replace obsolete skill/evaluation/XP behavior directly and reset affected development records. | End-to-end verification, coverage gaps, source cleanup and a scoped commit-ready review |

Stages 1 and 3 can advance together. Design stage 5 alongside the observation and
XP policies so records support recommendations from the start. Content examples remain teaching material;
they do not become mandatory assessment payloads. The integrated pilot checks
coverage and operational correctness, not another contest among prompt styles.
A separate Read surface and reading XP remain deferred. No backwards-compatibility
or migration work is required.

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

## Experience and effort — agreed first version

User-approved simplification: experience and effort drive the initial profile, XP
and recommendations. Success is not required and is not used in these calculations.
This supersedes earlier plans for success-weighted rewards, inferred difficulty
and improvement bonuses. Baseline's compact content strategy remains selected;
only its skill-evidence judgment is required for this first product version.
Historical two-judgment experiments and their reported results remain unchanged.

| Signal | Agreed counting rule |
| --- | --- |
| Experience | One count per skill used or attempted when first present in an attempt/revision chain, including meaningful participation that relies on conversation context; a new message begins a new attempt |
| Effort | A changed resubmission counts as effort for an already-present skill when the submitted message changes; no proof of improvement is required |
| Blind spot | Little or no recorded experience; derived from the experience distribution, not an assertion of inability |

Partner text or generated suggestions alone do not count as learner experience.
An unchanged resend does not add editing effort. Repeated mentions/spans within
one initial attempt do not multiply that skill's count. Counts remain separate
from eventual XP weights. An inference error or unclear evidence is not a success
or failure judgment about the learner.

### XP math — adopted

For each skill: **XP = experience count + effort count**. Each increment is worth
1 XP. Keep both counts separately available to recommendations and the learner
profile. A revision introducing a skill earns experience for that skill; a changed revision
retaining an already-encountered skill earns effort for that skill.
Do not award both for the same skill in the same submission. User clarification: editing any part of the message grants effort to all retained
skills that remain present. This broad first-version rule replaces edit/span
attribution; no proof of which construction changed is required.

| Event for past reference | Experience added | Effort added | XP added |
| --- | ---: | ---: | ---: |
| Initial submitted attempt | 1 | 0 | 1 |
| Changed retry involving past reference | 0 | 1 | 1 |
| Another changed retry involving past reference | 0 | 1 | 1 |
| Unchanged resend | 0 | 0 | 0 |
| A new message using past reference | 1 | 0 | 1 |
| Total | 2 | 2 | 4 |

Multiple skills accrue separately. No success or improvement bonus, multipliers,
assistance discounts or diminishing-return curve in this first version. Keep
assistance provenance where available without weighting it yet. Progression and
proficiency estimation remain separate.

### Implemented counting checkpoint

Review one compact content/record specimen: authored core and language guidance
rendered as both learner Markdown and the presence-only assessor prompt; initial
attempt and revision identities; per-skill presence and credited experience/effort.
The user selected broad retry credit: changed text grants effort to all retained
skills. No source-span edit attribution is required. Reintroducing a previously
encountered skill in the same chain earns effort, not a second experience count.

Then implement a narrow vertical slice using the existing classifier transport
and execution lifecycle: submitted attempt → skill-use observation → one-time
experience/effort credit → displayed counts and XP. Cover duplicates, changed and
unchanged retries, newly introduced skills, broad retained-skill credit, late results and
restarts. Verify recommendations and live profile rendering from those records
in the running native pilot; no new prompt sweep or bulk guide run.

### Concurrent AI-workflow changes

The [message-assessment handoff](../message-assessment-replacement.md) reports
classifier-based grammar/conversational-fit ratings and separate partner
understanding, with on-demand explanations. These are separate from skill-use
observations and do not grant XP. The current turn-plan source retains a distinct
skill-assessment path. Reuse shared transport/lifecycle facilities where appropriate
without feeding message-quality scores into experience or effort.

This checkpoint read the handoff and current graph declarations; it did not rerun
the other agent's verification or claim that the installed app has been updated.
Preserve its concurrent changes. The broader scheduling/hydration proposals in
[the workflow audit](../workflow-graph-review-2026-09-24.md) are separate work,
not prerequisites to this XP slice.

## Experience profile and recommendations — required scope

Added by user clarification on 2026-09-24. Using recorded experience to guide
future language practice is a core purpose of the new skills system, not a later
optional project. Baseline B remains selected. This is agreed product scope;
Conversation selection is implemented; live profile and drill/card controls
and runtime integration remain pending. Earlier coaching-plan focus concepts are relevant context,
not an obligation to restore old estimators or skill contracts.

### Agreed behavior

- Build a language-scoped view of the learner's distribution of XP and recorded
  skill use. Respect selected varieties and applicable language-defined skills.
- Identify gaps and underexplored uses, then offer relevant conversations,
  phrases, samples, cards and drill statements that create practice opportunities.
- Make skill recommendations available to the coach, conversation generation and
  drill/card generation through one shared recommendation model. Each surface
  needs a way to use recommendations. Chat starts have two distinct choices,
  agreed by the user: **Let the persona decide** chooses from the persona's
  interests and conversational perspective; **Let the coach decide** chooses
  practice using one of three choices: **Explore** (little or no recorded
  experience; breadth), **Continue practicing** (skills receiving editing/retry
  effort; depth), or **Coach’s choice** (a mix of the two). Depth is not an
  inference that the learner is failing or struggling.
  Do not fold experience-gap targeting into the persona option. With coach
  selection, the persona remains the conversation partner; the coach selects
  the practice focus and a suitable conversational opportunity. Controls for
  other generation surfaces remain to be discussed.
- Provide a live deterministic profile of recorded experience, effort and XP,
  scoped to the selected language/variety. Calculate it whenever viewed and update
  it when eligible records change. No AI generation or explicit refresh.
- This supersedes the earlier saved write-up and periodic-refresh proposals.

### Proposed division of labor to review

Recorded attempts/observations and XP feed a structured experience profile. That
profile supplies recommendation targets and reasons. Generators use those targets
to propose natural practice. The live profile renders the same underlying counts.
Generators should not independently reinterpret the entire history.

Experience and effort counts are the first-version recommendation inputs; XP is
a weighted presentation of practice, not a competence score. Low recorded XP means little recorded
experience, not proven inability. High XP can reflect repeated familiar or assisted
practice. Retain usage counts, variety/context, recency and assistance information
alongside awards so reward tuning does not accidentally dictate all recommendations.
Do not require an equal XP allocation across every skill: relevance, learner intent
and actual opportunities matter. How these factors affect ranking is still open.

Keep recommendations explainable and controllable. The learner can choose their
own focus or decline suggested practice. A requested topic or correction should
remain useful on its own; recommendation-driven opportunities should fit the
conversation, not force every exchange into an exercise. Track what was offered
separately from what the learner actually practiced. Generated partner text, cards
or suggestions do not by themselves earn learner XP or fill an evidence gap.

The profile is a mechanical view of recorded experience, not a generated
assessment or an explanation of one attempt's score. Recompute after exclusions
and catalog changes as well as new awards. No saved assessment or refresh history
is needed; underlying observations and awards remain durable.

### Review and verification artifacts

Before implementation, work through a profile with extensive present-reference
practice, limited past-reference practice and assisted possession attempts. Show:

1. What the profile can and cannot infer, and the resulting gap recommendations.
2. How “Let the persona decide” differs from “Let the coach decide” at chat start,
   and how coaching and card/drill generation use shared recommendation targets.
3. What counts, coverage and practice targets the live profile displays.
4. What happens after new conversations, excluded evidence, an ignored suggestion
   and a learner-selected topic. Include a language with little or no history.

Integration checks should cover selected-language/variety isolation, unsupported
content, learner override, load errors and updates to the open profile. Verify that suggestions do not count as demonstrated use and repeated
recommendations can be explained. These are product checks, not a new prompt-style
benchmark or a claimed proficiency estimator.

## Jev strategy — selected, experiments closed

Use baseline B: shared instructions, terse skill name/overview/boundary, compact
selected language/variety guidance, and the evidence Choice
question with its existing criteria. The historical baseline also asked an
expression-success question; that is not required by the simplified product policy. General instructions and criteria are
shared; language guidance comes from the same authored source as the learner
view. Full examples and notation are omitted from this assessment projection.

Success means communicated meaning, not error-free grammar. Only evidence is required for the first version; expression success is optional
and excluded from XP and recommendations. The chosen labels
are not XP amounts, proficiency levels or calibrated probabilities. Source spans,
amount of practice and grammar-correctness judgments are not established by this
experiment. Do not silently add them to the meaning of the saved observations.

The latest accepted evidence covers possession/relationships and past reference
in Spanish, Levantine Arabic only and Mandarin Chinese. Earlier runs and their
historical defaults remain documented below; they are not current run instructions.
Any future experiment is a separately scoped question with new frozen inputs and
receipts. The [tooling guide](../../../tools/benchmarks/conversation-prompts/assessment/README.md)
explains offline report rebuilding and future harness reuse. No new run is queued.

## XP policy and implementation checks

The evaluator supplies observations. Deterministic code calculates credit using
those observations and attempt history. Start with experience and changed-retry
effort counts and simple weights. Success and improvement do not affect awards.
More elaborate novelty, diminishing-return and assistance policies are deferred;
unchanged resends must not add effort.
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

## Source and verification checkpoint

The shared checkout is on branch `skillz`; the user already created and pushed a
branch checkpoint. Subsequent experiment files and notes remain uncommitted with
other work. No new commit, branch, runtime change or data reset is made by this
adoption decision. Inspect the current diff and preserve unrelated work before
any later commit; commits require an explicit instruction.

This checkpoint reconciles documentation and logs the user's selection. Experiment
verification belongs in each study report. Documentation checks do not constitute
new runtime verification or linguistic review.

## Historical experiment record

The following entries describe the sequence of completed investigations. Their
suggested next experiments are superseded by baseline adoption above.

## Spanish sensitivity follow-up — completed 2026-09-24

The [Spanish-only study](jev-sensitivity-2026-09-24/README.md) adds 900
concurrent-baseline responses across minimal, rule-based, example-based and
intentionally misleading descriptions. Misleading definitions sharply reduce
agreement, establishing content sensitivity. Neither richer candidate has a
clearly positive paired interval against baseline. Next proposed evaluation work
is a compact absence-versus-unsuccessful-use distinction tested on fresh cases,
after reviewing the current disagreements. No new inference or production
implementation is implied by this proposed next step.

## Criteria and question-structure study — completed 2026-09-24

The [eight-strategy study](jev-strategies-2026-09-24/README.md) completed
3,360 requests. Primary fresh/unflagged agreement was 95.25% for baseline and
96.25% for the highest candidate, without a positive multiplicity-adjusted
contrast. The exact-body repeat audit found focal choice variation in 36 of
669 fully valid five-repeat groups. Repeats measure instability, not additional
independent cases. The next proposed emphasis is adjudicated, independent cases
with a smaller repeatability subset; no further sweep is started automatically.

## Matched multilingual study — completed 2026-09-24

The [multilingual round](jev-multilingual-2026-09-24/README.md) completed 2,304
requests across Spanish, Levantine Arabic only, and Mandarin Chinese. It uses
48 matched cases per language, two repetitions, and 24 shared semantic clusters.
The default includes all preflagged cases. Misleading control E is separate from
all candidate performance summaries. Cost: $0.189583968, three billed invalid
distributions, no transport failures or retries.

Baseline agreement is 86.98%, 85.94%, and 86.46% respectively. No pooled candidate
contrast excludes zero; exploratory Arabic D and G contrasts are negative.
Matched Spanish baseline changes only +0.73 points from the preceding run on
identical cases and request bodies. The dashboard includes this historical panel
without pooling past responses. References/translations remain provisional.

The next checkpoint is the architecture and content recommendation discussion:
shared terse skill definitions, language/variety-owned guidance, evaluator output
structure, and evidence retained for XP. These results do not settle all skills,
XP conversion, or reference correctness. Bulk guide generation and app runtime
integration remain deferred. No commit or runtime change was made in this round.

## Content and counting checkpoint — implemented, not integrated

[Generated review artifact](drafts/composition-and-counts.md): Spanish possession
and Arabic/Levantine past reference, each rendered from authored YAML as a learner
guide and a presence-only question. Shared language material and selected variety
material compose explicitly; uncovered varieties fail instead of silently falling
back. These are draft examples, not full language coverage or native-reviewed text.
The presence-only projection adapts the baseline strategy; historical study
payloads and measurements remain unchanged.

`tools/content-workbench/composition/skill.ts` provides the pure composition;
`preview.ts` rebuilds the artifact without provider calls. The practice replay
calculator is `ui/src/domain/learning/practice/counts.ts`. It calculates experience
and effort from validated, chronological submission fixtures. It is not called
by the running app and does not persist or award credit. Durable native publication
still requires implementation; the calculator does not replace that transaction.

Verification: five counter tests, two composition tests and focused strict
TypeScript checks passed. The worked presence observations are synthetic fixtures,
not newly generated Jev results. No runtime AI pipeline, database or other-agent
source was changed. Next is the native integration and shared persisted-contract
pass; do not claim the user flow is complete from these pure tests.

## Native practice components — historical checkpoint

Superseded by [integrated presence and XP](live-presence-xp-checkpoint.md).

The [native implementation and verification record](native-practice-checkpoint.md)
now covers presence-only question composition/validation and transactional
experience/effort publication over the existing revision chain. The full native
suite passed: 599 tests, five ignored. A real-store fixture verifies revised
practice credit survives reopening. These new components are not yet invoked by
the live graph or rendered in XP totals. The old catalog and award path remain
active pending the coordinated cutover; do not treat component tests as a completed
learner flow. Other-agent message-assessment changes were preserved.

## 2026-09-25 source completion checkpoint

Replaced the legacy estimate view with live experience/effort/XP, preserved partner
filtering and language-wide native exports, connected guide access in all reviewed
skill-evidence entry points, and verified exclusion/restore and scope-change updates.
See [profile completion and remaining limits](saved-experience-assessment.md).
603 native tests passed (one ignored), 54 focused UI tests and 26 architecture
checks passed. Interactive Mac/Spanish verification remains pending, not completed.
