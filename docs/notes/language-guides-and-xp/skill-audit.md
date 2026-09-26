# Audit of the 45 skills

Status: **review findings and discussion agenda**, 2026-09-24. This is a snapshot
of the current catalog, not an approved redesign. No skill IDs, criteria, bands,
prerequisites or scoring rules were changed by this audit.

## What exists today

- **45 skills in eight navigation groups.** The groups organize the display;
  they are not additional skills or prerequisite stages.
- **24 skills carry A1; 21 carry B1.** There are no A2, B2, C1 or C2 entries.
- **All 45 say needs_review.** All cite the same broad references,
  `cefr2020` and `actfl2024`; none records a descriptor/page-specific
  justification for its particular band assignment.
- **No declared prerequisites:** every `requires` list is empty. Apparent
  basic/complex pairs are conceptual relationships, not enforced unlock chains.
- The catalog primarily describes **communicative functions**, not obligatory
  grammatical forms. Several criteria explicitly reject assumptions such as
  requiring tense inflection, a copula, a passive, or question inversion.
- The separate prompt difficulty settings are Absolute zero, Beginner,
  Intermediate, Advanced and Fluent. They are not these skill-band labels.

Source: [learning-goals.yaml](../../../content/shared/learning-goals.yaml) owns
criteria; [learning-map.yaml](../../../content/shared/learning-map.yaml) owns the
navigation shown below. This inventory follows that navigation order, not YAML
source order. The source file happens to start with social phrases.

## Complete inventory

The wording below is the **current criterion**, not a new proposed definition.
A1 and B1 are existing catalog labels, not audited competency certifications.

### Entities & reference (6)

| Skill | Current band | What the criterion asks for |
| --- | --- | --- |
| Identify a referent — `referent` | A1 | Identify a particular person or thing so the listener can tell which is intended. |
| Track several referents — `track_referents` | B1 | Keep multiple previously mentioned referents distinguishable across a connected statement. |
| Express quantity — `quantity` | A1 | Express a quantity or distinction between one and more than one with enough precision for the context. |
| Qualify quantities — `quantify_sets` | B1 | Express a scope-sensitive quantity such as some, all, neither or only, with the intended set clear. |
| Express possession — `possession` | A1 | Make clear who something belongs to or its relevant part–whole relationship. |
| Specify a complex referent — `nested_reference` | B1 | Identify a referent through multiple linked possession, part–whole or descriptive relationships. |

### Properties & comparison (6)

| Skill | Current band | What the criterion asks for |
| --- | --- | --- |
| Attribute a property — `property` | A1 | Attribute a quality or state to the intended referent. Do not require an adjective word class or a copula. |
| Qualify a property — `qualified_property` | B1 | Restrict a property by circumstance or perspective, making its intended scope clear. |
| Compare referents — `comparison` | A1 | Express a clear comparison between identifiable referents along a stated or contextually clear dimension. |
| Specify a comparison standard — `comparison_standard` | B1 | Express a comparison with a precise standard, degree or exception. |
| Express degree — `degree` | A1 | Express the intensity or extent of a property in a way that fits the intended meaning. |
| Connect degree to consequence — `degree_consequence` | B1 | Express a degree in relation to a limit or consequence, such as too hot to drink. |

### Events & participants (6)

| Skill | Current band | What the criterion asks for |
| --- | --- | --- |
| Express who does what — `event_roles` | A1 | Express an event with the actor and other relevant participants distinguishable. Do not require a fixed word order or case system. |
| Change event perspective — `perspective_roles` | B1 | Present an event from a non-default participant perspective while preserving who did what. Do not require a passive construction. |
| Express transfer — `transfer` | A1 | Express a transfer with the thing transferred, source or giver, and recipient clear where relevant. |
| Express a constrained transfer — `complex_transfer` | B1 | Describe transfer with additional beneficiary, instrument or condition while keeping participant roles clear. |
| Express causation — `causation` | A1 | Express that a participant or event brings about another event or state. |
| Distinguish causation and agency — `causal_chain` | B1 | Distinguish causing, allowing or arranging an event from directly performing it. |

### Time & event structure (6)

| Skill | Current band | What the criterion asks for |
| --- | --- | --- |
| Refer to past events — `past_reference` | A1 | Locate an event before the relevant present using target-language wording and context. Do not require tense inflection. |
| Order past events — `past_sequence` | B1 | Make the relative order of multiple past events clear, including an event preceding another past reference point. |
| Refer to future events — `future_reference` | A1 | Locate an event after the relevant present or reference point. Do not require a future-tense form. |
| Relate future possibilities — `future_conditions` | B1 | Distinguish a future intention, prediction or conditional event with the relevant timing clear. |
| Express event phase or repetition — `event_phase` | A1 | Distinguish ongoing, completed or habitual events where the distinction is supported by the current wording and context. |
| Contrast event structure — `aspect_contrast` | B1 | Relate contrasting event phases or repetition patterns without confusing completion, duration or habituality. |

### Space & movement (6)

| Skill | Current band | What the criterion asks for |
| --- | --- | --- |
| Locate an entity — `location` | A1 | Locate an entity relative to an identifiable place or reference object. |
| Coordinate spatial frames — `spatial_frame` | B1 | Describe a spatial relation where the viewpoint or frame of reference matters and keep it clear. |
| Describe movement — `motion` | A1 | Express movement with relevant source, path or destination distinguishable. |
| Describe a multi-stage path — `motion_path` | B1 | Describe a path with multiple spatial relations or changes of direction in a followable sequence. |
| Use spatial reference — `spatial_deixis` | A1 | Use context-appropriate here/there or proximal/distal reference with a recoverable intended location or referent. |
| Shift spatial viewpoint — `shift_deixis` | B1 | Maintain clear spatial reference when describing a different speaker’s or participant’s viewpoint. |

### Negation, questions & possibility (6)

| Skill | Current band | What the criterion asks for |
| --- | --- | --- |
| Negate a proposition — `negation` | A1 | Express what does not hold with the intended event, property or participant scope clear. |
| Control negation scope — `negation_scope` | B1 | Distinguish materially different scopes of negation, such as not all versus none. |
| Ask a question — `question` | A1 | Request confirmation or missing information with the intended question recoverable. Do not require inversion or a question particle. |
| Embed a question — `embedded_question` | B1 | Express an indirect or embedded question while keeping the requested information clear. |
| Express possibility or necessity — `modality` | A1 | Express ability, possibility, desire, permission or obligation with the intended force clear in context. |
| Distinguish modal meanings — `modal_distinctions` | B1 | Distinguish a relevant difference in certainty, permission, obligation or ability rather than leaving the modal force ambiguous. |

### Connecting ideas (6)

| Skill | Current band | What the criterion asks for |
| --- | --- | --- |
| Connect a reason — `reason` | A1 | Connect a proposition with a relevant reason or purpose so their relationship is clear. |
| Express concession — `concession` | B1 | Relate an outcome to a counterexpectation without confusing concession with cause. |
| Express a condition — `condition` | A1 | Express that an outcome depends on an identifiable condition. |
| Express a counterfactual — `counterfactual` | B1 | Distinguish an imagined contrary-to-fact condition and its consequence from an actual event. |
| Report speech or thought — `reported_content` | A1 | Attribute speech, belief or thought to its source without confusing the source with the learner. |
| Maintain perspective in reports — `nested_report` | B1 | Keep speaker, time and reference clear through an embedded or perspective-shifting report. |

### Social phrases (3)

| Skill | Current band | What the criterion asks for |
| --- | --- | --- |
| Thank, apologize or respond politely — `courtesy` | A1 | Use an appropriate conventional thanks, apology, welcome or polite response. |
| Exchange social pleasantries — `social_checkin` | A1 | Ask or answer a conventional wellbeing check-in, such as how are you or I am well. |
| Greet and say goodbye — `greeting` | A1 | Use a conventional greeting or farewell appropriate to the exchange. |

## How to interpret the difficulty labels

The CEFR defines levels using illustrative can-do descriptors across categories,
not a certification of this app's 45-item catalog. ACTFL describes proficiency in
listening, speaking, reading and writing using its own level framework. Citing
both is useful background, but does not establish a per-skill mapping or a direct
CEFR/ACTFL equivalence. [@coe_descriptors_audit2026] [@actfl2024]

**Audit conclusion:** treat the current A1/B1 assignments as provisional authoring
metadata until their intended meaning and supporting evidence are reviewed.
A function such as asking a question can be realized simply or with sophisticated
language. Demonstrating it once is not evidence of an overall CEFR level.

Current code inspection also shows that these labels are not a universal skill
unlock rule. The configuration candidate selector includes applicable function
and interaction skills regardless of band; band proximity participates in the
optional lexical-hint path. Courtesy is the only pragmatics-lens entry. Jev's
adapter separately requires 45 criteria and tells the assessor not to infer a
skill from difficulty or prerequisites. These are distinct paths to reconcile
when we later design assessment; this audit does not change them.

## Boundaries to review together

These are findings to discuss, not instructions to merge or remove skills.

| Boundary | Why it needs attention | Question for the review |
| --- | --- | --- |
| Referent, event roles, property and possession | A short sentence may legitimately express several; general reference is embedded in many other functions. | What evidence qualifies independently, and how should XP account for overlap? |
| Quantity / quantify sets / negation scope | “Not all” concerns both set quantification and negation scope. | When do we recognize both, and what makes the complex criterion distinct? |
| Property / qualified property / degree / comparison standard | Scope, intensity and standards can be expressed together. | Can each criterion get a clear positive example and a near miss? |
| Causation / reason / degree consequence | Causing an event, explaining it, and exceeding a limit are related but different. | Which relation is actually asserted by the learner? |
| Modality / modal distinctions | The basic criterion already requires intended force to be clear; the complex criterion also asks for disambiguation. | What additional evidence does the second criterion require? |
| Future reference / future conditions / condition / modality | Intentions, predictions and contingencies overlap. | Is complexity an extra skill, a dimension of performance, or both? |
| Location / spatial deixis / spatial frame / shift deixis | All involve reference, but differ in viewpoint and anchoring. | What minimum context is needed to distinguish them fairly? |
| Greeting / courtesy / social check-in | Conventional expressions can serve several social purposes; courtesy bundles several acts. | Are the breadth and boundaries useful for teaching and scoring? |
| Causal chain ID versus criterion | The ID and opportunity suggest a chain; the label and criterion concern causing, allowing, arranging versus doing. | Which concept is intended? |
| Simple/complex pairing | Seven groups each have three A1 and three B1 entries, suggesting a designed pattern. Concession, for example, is not simply a harder reason. | Are the pairings useful relationships or an overly tidy taxonomy? |

## Coverage questions

The catalog does not separately name requests, offers, clarification requests,
self-repair or turn management. Some may fit existing question, modality or social
criteria. Reading, listening and pronunciation are also not established by these
textual functions. We should first decide this catalog's scope before treating
any of those as omissions to fix. Retry rewards can exist without adding a
self-repair skill.

## Proposed review sequence

1. Walk through the eight groups and confirm what each skill means.
2. For each ambiguous boundary, write a positive example, a near miss and an
   overlapping example. Begin with reference, negation, questions and modality.
3. Decide what a band means: earliest supported use, typical task complexity,
   teaching order, or a proficiency claim. Those are different choices.
4. Decide whether the more complex capabilities remain separate skills or become
   dimensions of the same skill. Preserve IDs until that decision is made.
5. Record keep/clarify/merge/split decisions with reasons, then approve actual
   catalog edits. Only afterward author language-core and variety guides.

## Verification and provenance

All 45 goal IDs occur exactly once as skill nodes in the navigation map. The audit
snapshot in [skill-inventory.yaml](skill-inventory.yaml) is derived from those two
sources and remains review material, not a second runtime catalog. Counts and
empty prerequisite lists were checked against the files. Runtime observations
came from configuration/mod.rs (candidate selection), difficulty.rs (prompt
levels), and learning/coaching/assessment_adapter.rs (Jev request criteria).
