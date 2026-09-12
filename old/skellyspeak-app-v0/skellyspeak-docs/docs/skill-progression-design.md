---
sidebar_position: 6
title: Meaning Domains & Skill Progression
---

# Meaning domains and skill progression

The app organizes practice around the relationships a learner expresses and the
language's strategies for expressing them. Guided conversation and Skill tree
are the two product surfaces. The language profile is available above the
conversation. Stories and its dedicated generation machinery are retired.

## Intellectual basis

Functional–typological grammar distinguishes a meaning/function from the
morphosyntactic construction a particular language uses to express it. Croft's
*Morphosyntax: Constructions of the World's Languages* (2022) provides a broad
functional framework for these constructions. His treatment of reference,
modification and predication distinguishes these operations from objects,
properties and actions: a property can be referred to, used to modify something,
or predicated of it. These dimensions help define concrete practice targets.
[Croft, Morphosyntax](https://www.cambridge.org/highereducation/books/morphosyntax/1AAB4F5F9C553F675170DCA3F03F82E2),
[Croft, constructions in cross-linguistic context](https://www.unm.edu/~wcroft/Papers/CHCxG-Ch21-draft.pdf).

Haspelmath distinguishes comparative concepts from the descriptive grammatical
categories of particular languages. We use shared meaning-based targets while
allowing different realizations. Past-time reference does not require a past-tense
suffix; property attribution does not universally require an adjective plus a
copula. Correctness still concerns the construction used in the target language.
[Haspelmath, comparative concepts](https://zenodo.org/records/1158392),
[WALS, tense and aspect](https://wals.info/chapter/s7),
[WALS, predicative adjectives](https://wals.info/chapter/118).

Semantic-map research studies connections and cross-language variation in domains
such as time/aspect, modality, spatial relations and predication. It informs our
choice of meaning distinctions, but supplies neither a universal acquisition
sequence nor a validated game progression engine.
[Max Planck Institute, semantic maps](https://www.eva.mpg.de/lingua/conference/07-SemanticMaps/files/theme.html).

Universal Dependencies offers a computational annotation vocabulary for
morphological features and syntactic relations. It is a potential analysis aid,
not an installed parser or the learning curriculum.
[Universal Dependencies, features](https://universaldependencies.org/u/feat/index.html).

CEFR and ACTFL remain useful references for task demands and evidence quality,
but reception/production/interaction/mediation are not this app's top-level skill
branches. ACTFL's Can-Do guidance emphasizes consistent performance across
situations and time rather than a one-time checklist. Our checks and stars are
practice milestones, not official proficiency ratings.
[ACTFL, Can-Do Statements](https://www.actfl.org/educator-resources/ncssfl-actfl-can-do-statements).

## Shared catalog

The authoritative catalog is `src-tauri/src/skills/catalog.json`. Rust and React
consume it. One experience root records participation; meaning domains contain
concrete skills and more demanding extensions. Branch sizes are not constrained
to a fixed arity. Domain nodes summarize their descendants; they are not assessed
rubrics. Extension links express suggested practice paths, not proven universal
prerequisites. Each rubric is assessed directly: success at one node does not
automatically establish its ancestors or descendants.

| Domain | Foundation examples | Extension examples |
|---|---|---|
| Entities & reference | Identify a referent, quantity, possession | Track multiple referents, quantify sets, nested reference |
| Properties & comparison | Attribute properties, compare, express degree | Qualify scope, specify comparison standards, degree and consequence |
| Events & participants | Who does what, transfer, causation | Participant perspective, constrained transfers, causation versus agency |
| Time & event structure | Past/future reference, event phase/repetition | Order past events, future conditions, aspect contrasts |
| Space & movement | Location, movement, spatial reference | Coordinate viewpoints, multi-stage paths, shifted reference |
| Negation, questions & possibility | Negate, ask, express modal force | Negation scope, embedded questions, modal distinctions |
| Connecting ideas | Reasons, conditions, reported content | Concession, counterfactuals, perspective in reports |

This grouping and its rubric wording are product definitions informed by
linguistics, not a published seven-domain standard. The catalog's English meaning
examples explain intent; they are not required learner wording or mandatory
English grammatical forms. Target-language examples are generated in practice.
Grammar instruction can therefore be concrete without separate per-language trees.

## Evaluation and progress

A background `assess_skills` call follows each successful reply to a real learner
message. The model returns sparse judgments: demonstrated, partial,
not_demonstrated, not_observed or uncertain. Omitted skills mean unobserved, not
failure. A demonstrated relationship must be expressed appropriately in the
target language. Recoverable intent with a relevant grammatical error can be
partial; unrelated errors do not invalidate every skill.

Rust checks rubric IDs, duplicate judgments and exact quotes from the current
learner source. Structured validation does not prove linguistic truth. Input,
preceding conversation, partner reply and assistance flags remain inspectable in
the request trace. Text/speech transcripts do not establish pronunciation,
listening, retention or transfer.

The deterministic progression rules are:

- No qualifying success: empty marks. One: a check. Two: two checks. Three: a star.
  Counts continue beyond the star; there is no fast/strict setting.
- A distinct successful response per skill earns 10 XP without recorded in-app
  assistance. Suggested wording, scaffolds and revisions earn 2 practice XP and
  do not advance the success marks. External assistance is always unknown.
- Identical source wording, ignoring case and whitespace, counts once per skill
  across chats/native-language contexts. Later success without recorded assistance
  replaces assisted credit for that wording, rather than adding both.
- A starred parent makes its extension available in the recommendation path.
  Every skill remains inspectable and can be selected immediately.
- Recommendations choose an available unstarred foundation before deeper
  extensions, in catalog order. When all are starred, the least-repeated skill is
  suggested. A pinned focus remains pinned until the learner changes it or selects
  **Follow recommendations**.

XP weights and the three-success milestone are transparent product rules, not
research-backed proficiency thresholds. There are no punitive streaks or global
proficiency promotions. Evidence-derived totals can decrease when the underlying
source is removed, revised or excluded; no separate permanent reward balance is
claimed.

## Profile ownership and instruction flow

One explicit local learner has separate progress per target language. Native
language remains learning context, so changing it does not reset the same target's
progress. Profile switching and cloud sync are future work. Login and partner
persona are not learner identities.

`learners/local/<target>.json` stores versioned, revision-checked focus and evidence
exclusion choices. Per-chat `skill-evidence.json` stores the assessments. XP,
marks and recommendations are derived by Rust from live source-matched evidence.
Saving a focus takes effect in subsequent guided requests. The `skill_practice`
block carries the selected/recommended skill and criterion into the partner
prompt; suggestions, coach feedback, coach chat and observation receive that
practice context too. The observer still has its existing cadence, so generated
lesson observations can lag. Current subject, explicit lesson choices and selected
practice difficulty take precedence. Profile progress never silently changes
response difficulty or overwrites a lesson goal.

Only evidence from the current catalog contributes to its skills. Previous
catalog judgments remain inspectable under **Previous rubric evidence** and are
validated against their original catalog. They are not remapped into new grammar
skills. There is no automatic replay of old conversations or conversion of legacy
coach grades into XP.

Edited/truncated source versions and soft-deleted chats do not contribute. Raw
ledgers remain with their chats. **Exclude attempt from progress** reversibly
excludes the entire assessment attempt, not just its currently displayed skill;
it does not edit the AI's judgment. Retained diagnostics have their own lifecycle.

## Interface

The conversation's compact **My language profile** entry shows target language,
XP, stars and current focus, and opens Skill tree. The map shows three levels: experience, meaning domains, and core skills.
Extension skills remain accessible through parent details and saved focus, with
their parent highlighted on the map. Nodes shrink with depth; selecting
a branch moves the camera while preserving every node and its position. Back
restores the previous viewport; Whole tree, breadcrumbs and a minimap provide
orientation. Closing details or pressing Escape does not move the camera.
Camera transitions respect reduced-motion preferences.
The inspector shows useful criteria, marks, source quotes and provenance, plus
**Practise this in conversation**. An inspection click alone does not change focus.

Horizontal layout is the default and mirrors with application RTL direction.
Columns leave clear lateral space between cards and their connecting branches.
Connecting lines retain their screen thickness when zoomed out so the full map
keeps its visible tree structure. Connection measurements refresh when the
canvas becomes visible, resizes, or changes layout.
Radial and top-down layouts remain available. Small screens use the same graph with an optional list; the inspector collapses
independently.
Browser-only mode is explicitly labeled demonstration data. Native errors never
silently substitute that fixture. Focus persists; graph navigation is transient.

## Remaining validation and extensions

Continue reviewed multilingual evaluation of these actual rubrics, including
false positives, grammatical partials, code-switching, assistance, revisions and
provider variability. Automated lifecycle and geometry checks are not semantic
calibration. Profile switching, delayed review, richer audio evidence and
alternative analysis views remain future work. No fixed node count or balanced
branching factor should drive future catalog decisions.
