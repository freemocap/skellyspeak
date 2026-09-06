---
sidebar_position: 6
title: Skill Map & Progression — Proposed Design
---

# Skill map and progression

**Status: proposed implementation, not shipped.** Direction agreed in discussion;
this document makes the remaining design decisions reviewable. Research reviewed
6 September 2026. Implementation remains authoritative for current behavior.

## Product direction

SkellySpeak should help learners accomplish things they care about through
conversation, recognize their progress, and explore what they could do next.
The skill map makes that growth tangible without taking control of the conversation.

Maintain **one language-independent capability graph and one progression engine**.
Store evidence separately for each learner and target language. Do not maintain
separate grammatical curricula or language-specific XP rules. The selected
language determines examples, explanations and interpretation of evidence, not
which capability IDs or progression rules exist.

Keep three concepts separate:

- **Practice difficulty:** the learner's choice of how demanding partner replies
  should be. Progress never silently changes it.
- **Demonstrated capability:** evidence of what the learner accomplished, under
  recorded conditions. A reward is not a proficiency certification.
- **Lesson focus:** a few recommended next activities, shaped by the learner's
  interests and explicit choices. Recommendations can be skipped or changed.

## Research basis and limits

### Describe communicative abilities across languages

The CEFR Companion Volume (2020) extends the framework with Pre-A1, mediation,
online interaction and plurilingual competence. It supplies proficiency
reference descriptions, not proof of one optimal acquisition sequence.
[Council of Europe, Companion Volume](https://book.coe.int/en/education-and-modern-languages/8152-common-european-framework-of-reference-for-languages-learning-teaching-assessment-companion-volume.html).

The Council distinguishes general capability descriptors from particular
languages' vocabulary and grammatical realizations. Our shared graph uses the
former; generated teaching material supplies the latter. This reduces curriculum
authoring duplication, but does not eliminate language-specific quality checks.
[Council of Europe, Reference Level Descriptions](https://www.coe.int/en/web/common-european-framework-reference-languages/reference-level-descriptions).

ACTFL's 2024 proficiency revision and 2026 Can-Do framework describe functional
communication and allow different proficiency profiles across modes. The Can-Do
guidance explicitly rejects one-time checklists and requires evidence across
situations and time. These are professional frameworks, distinct from controlled
studies of teaching effectiveness.
[ACTFL, 2024 revision](https://www.actfl.org/news/revised-actfl-proficiency-guidelines-released),
[NCSSFL–ACTFL, 2026 Can-Do Statements](https://www.actfl.org/educator-resources/ncssfl-actfl-can-do-statements).

### Practice meaning, revisit it, and make feedback usable

A 2024 synthesis of technology-mediated task-based instruction reviewed 254
studies. It describes meaningful interaction opportunities while identifying
narrow coverage of contexts and learner groups and insufficient evaluation of
task outcomes. Our implication: evaluate whether a communicative purpose was
achieved, not merely whether a target form appeared. Do not claim universal
validation of our generated tasks.
[Kim & Namkung, 2024](https://doi.org/10.1017/S0267190524000096).

A second-language spacing meta-analysis found a medium-to-large spacing benefit;
longer spacing outperformed shorter spacing on delayed tests, though not immediate
tests. Our implication: distinguish immediate repetition from later retention.
It does not establish a universal three-success mastery threshold or an optimal
review interval for every skill.
[Kim & Webb, 2022](https://doi.org/10.1111/lang.12479).

A 2024 synthesis of classroom written feedback describes substantial variation
in learners' engagement and uptake. Our implication: make corrections usable,
permit revision, and later look for independent use. Delivering feedback alone
is not evidence of learning; findings about classroom writing should not be
presented as direct validation of this app's voice interaction.
[2024 classroom-feedback synthesis](https://www.cambridge.org/core/journals/language-teaching/article/written-corrective-feedback-in-second-language-writing-a-synthesis-of-naturalistic-classroom-studies/928D49660B199C493E3ED93B2EC043C6).

A 2025 study of generative AI in university language assessment found promising
results for overall writing scores with a specifically trained model, alongside
limitations in detailed feedback and subskill targeting. Our implication: retain
inspectable evidence, permit uncertainty and validate the actual evaluator. This
study does not validate our provider models across languages.
[2025 study, Potentials and pitfalls](https://www.cambridge.org/core/journals/annual-review-of-applied-linguistics/article/exploring-the-dual-impact-of-ai-in-postentry-language-assessment-potentials-and-pitfalls/8CBD1F6489BFB0716FAA4E6BB1C9ABD0).

Use original product descriptors with source references. Before embedding any
source descriptor collection, review its reuse terms; the ACTFL page specifies
educational/non-profit use and attribution. Referencing a framework does not
make the app an official CEFR/ACTFL assessment.

## Proposed shared graph

These branches are product proposals, not an official proficiency mapping:

| Branch | Increasing scope |
|---|---|
| Exchange information | Identify → describe → explain precisely |
| Express needs and preferences | State a need → explain a preference → negotiate alternatives |
| Describe events | Describe an event → sequence events → explain causes and consequences |
| Express viewpoints | State an opinion → support it → qualify it and address objections |
| Manage conversation | Respond → ask follow-ups → clarify and repair misunderstandings |
| Understand and relay meaning | Identify information → summarize → explain for another audience |

A skill's rubric describes function, context, independence and quality. For
example, **express a preference** might require conveying a clear like or dislike
relevant to the exchange, with an identifiable referent. A later challenge asks
for a reason or a negotiated alternative. It does not require a particular verb
or conjugation across languages.

Grammatical accuracy remains a quality dimension and a source of concrete
feedback. Topics such as adjective agreement can appear beneath a shared skill
as generated teaching guidance; they are not separate mandatory language trees.

Use recommended connections rather than pervasive hard locks. Higher-demand
activities can be explored with support before independent performance is
established. Internal references may span Pre-A1 through C2; the app's four
practice settings must not be treated as four certified proficiency levels.

## Evidence and rewards

The AI proposes a judgment with supporting spans; **Rust validates and awards**.
The model never directly changes XP, completion counts or profile ownership.

Proposed evidence outcomes: demonstrated, partial, not demonstrated, not observed,
and uncertain. A skill absent from a message is not automatically a failure.
Each evaluation records the skill/rubric version, learner and language, chat,
message and attempt identity, modality, assistance, time, relevant text spans,
rationale, and the model/prompt version. Rust verifies source references and
ownership; it cannot establish linguistic truth just by validating JSON.

Proposed progression dimensions: supported, independent, repeated, retained,
and transferable. Preserve them as evidence dimensions, not a compulsory linear
sequence. Someone may transfer a skill before a delayed review has occurred.

**Fast/strict** controls when to recommend the next focus: tentatively one or
three qualifying independent attempts. A first check celebrates a demonstration;
a star recognizes repeated evidence. Exact XP amounts, qualifying intervals,
context diversity and thresholds remain calibration decisions. Neither mode
changes the underlying evidence or constitutes a research-backed mastery test.

Assisted and revised attempts can earn practice recognition. A copied suggestion
must not be credited as independent production. Three submissions of one attempt
are not three independent demonstrations. Editing supersedes that attempt's
evidence; retries are idempotent. Truncating or deleting a conversation must have
an explicit evidence-retention policy before implementation ships.

Keep accumulated participation rewards separate from estimates of current
readiness. A review becoming due should invite practice rather than erase earned
achievements. Learners can inspect and challenge an award or a missed success.

## Ownership and implementation boundaries

Proposed entities, **not current Rust/IPC contracts**:

| Entity | Responsibility |
|---|---|
| Skill definition | Stable ID, branch, rubric, references, recommended connections, catalog version |
| Learner identity | Local profile identity; distinct from provider login and fictional partner persona |
| Language progress | Learner + target-language ownership; native language is recorded learning context |
| Evidence event | Auditable attempt evaluation and supersession history |
| Progress projection | Deterministic counts, rewards, readiness and next-focus candidates derived from evidence |

Rust owns catalog validation, evaluation requests, persistence, reward rules and
IPC. React owns map navigation, selection and transient celebration. Hosted
services retain their existing routing/metering responsibilities; cloud profile
sync is outside the first release.

Do not reinterpret the existing inferred `Profile` as a user account or convert
old grammar scores into XP. Existing memory is stored per target/native pairing;
introducing learner ownership requires an explicit migration and deletion design.
Start with one local learner identity but key progress correctly from the outset.
Profile switching follows after isolation is tested. Changing native-language
support should not silently erase progress in the same target language.

The existing AI execution graph describes model operations. The learner skill map
is a separate graph describing abilities; do not conflate their nodes or state.
Evaluation traces should link both a source message and a skill judgment. Schema
success, application acceptance and progress awards remain separate outcomes.

Text chat cannot establish every capability. A speech transcript alone does not
prove pronunciation, listening ability or unassisted speech. Mark unsupported
modalities unobserved until the app collects suitable evidence.

## Interface direction

Keep the conversation and useful lesson content central. Add small progress
markers beside current targets and a brief, motion-sensitive celebration when
an award arrives. Lead with the accomplishment and the learner's own example;
XP is secondary. Avoid compulsory streaks, punitive resets and public comparison
as defaults. These are product choices to support autonomy, not proven universal
motivation effects.

The map should be visually inviting: distinct branch colors with text/icon
redundancy, visible connections, selected-node emphasis and understandable paths.
Selecting a skill opens its useful explanation, next challenge and evidence.
A deeper disclosure exposes the rubric and evaluator rationale. Provide keyboard
navigation, reduced motion and a compact list equivalent on small screens; no
essential information should require hover or color recognition.

The first review artifact should show the same learner state in desktop map,
mobile list, active lesson target and evidence detail. Fixtures must be labeled
as demonstrations until backed by real progress.

## Proposed delivery sequence

1. **Contract and interface prototype.** Define a small shared catalog and
   evidence contract. Build the map/list, target progress and evidence detail
   using clearly labeled fixtures. Review the visual experience before adding
   automatic progression to real conversations.
2. **Evaluate without awards.** Integrate a read-only evaluator with the existing
   feedback pipeline and tracing. Compare judgments with reviewed examples in
   Spanish, Arabic and Mandarin using the same skill IDs and rubrics. These are
   validation samples, not separate curricula. Inspect false positives,
   uncertainty, assisted answers, edits and provider variability.
3. **Persistent progress pilot.** Add deterministic awards, retained evidence,
   fast/strict focus recommendations and a single local learner identity.
   Ship only after ownership, idempotency, supersession and deletion tests pass.
4. **Broaden and personalize.** Add profile switching, more skills, delayed
   review and cross-context challenges after evaluation and UI findings are addressed.

Before stage 3, agree on the exact reward/qualification rules, evidence deletion
policy, legacy-data migration and per-language evaluation acceptance criteria.
A generic architecture reduces authoring costs; it does not remove the obligation
to check generated content and assessment quality in each supported language.

## Current implementation boundary

Today the app has free-text lesson focus, generated topic explanations,
per-message feedback, editable lesson choices, inferred memory, saved partner
identity and local request traces. It has no stable skill catalog, learner-profile
switcher, evidence ledger, XP, skill-map UI or automatic skill completion.
See [Status](./status), [Architecture](./architecture) and [Future Work](./future-work).
