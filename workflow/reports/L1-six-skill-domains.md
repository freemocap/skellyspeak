# Six pedagogical domains — proposal for discussion

User direction: consolidate seven into six intelligently; automatic coaching after
each learner message, deeper review on request. This report proposes meanings and
evidence rules only. No catalog, renderer, contract, XP or production code changed.

## Actual starting point

Inspected active src/assets/skill-catalogs/catalog.json and src/lib/skill-domains.ts.
The seven domain IDs are reference, properties, events, time, space, operators and
connections, with three direct communicative skills each (21 total). They are not
vocabulary/grammar/listening/speaking categories. Also read the deprecated
old/skellyspeak-app/src-tauri/src/prompts/skills.rs rubric: exact current-message
evidence, observed/partial/uncertain distinctions, meaningful target-language
relationships and assisted-condition limits are useful principles, not an active
assessment implementation to copy.

## Primary grounding and limits

The Council of Europe's current publication page identifies the 2020 Companion
Volume as the updated CEFR resource. Its Chapter 5 distinguishes linguistic,
sociolinguistic and pragmatic competences; grammatical accuracy and effective
language use are related but distinct. Sections 2.7–2.9 support selecting relevant
descriptors for differentiated profiles. This supports separate correctness and
communication judgments, not a claim that CEFR supplies six app categories.
[Official publication](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions),
[Companion Volume, §§2.7–2.9 and 5.1–5.3](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4).

The CEFR descriptive scheme treats communication through activities and strategies,
including interaction and mediation, rather than reducing everything to four isolated
skills. Our six domains below are therefore selective practice organizers, not a
complete model of communicative competence or six certified CEFR subscores.
[Council of Europe descriptive scheme](https://www.coe.int/en/web/common-european-framework-reference-languages/descriptive-scheme).

## Recommended consolidation

| Proposed domain | Existing mapping | Retained observable skills |
| --- | --- | --- |
| Entities & reference (`reference`) | reference unchanged | referent, quantity, possession |
| Properties & comparison (`properties`) | properties unchanged | property, comparison, degree |
| Events & participants (`events`) | events unchanged | event_roles, transfer, causation |
| Time, place & movement (`situating`) | merge time + space | past_reference, future_reference, event_phase, location, motion, spatial_deixis |
| Negation, questions & possibility (`operators`) | operators unchanged | negation, question, modality |
| Connecting ideas (`connections`) | connections unchanged | reason, condition, reported_content |

**Why this merge:** time and space both situate entities/events relative to a reference
point; their existing goals remain useful and separable beneath one navigable heading.
It preserves all 21 communicative criteria and five familiar domains. Alternatives
such as combining events with causal connections blur participant roles versus
relations between propositions; combining reference and properties erases a useful
distinction between identifying something and describing it. This is our pedagogical
judgment informed by the framework, not a merger mandated by CEFR.

Do not merge the subskills themselves. Saying where an event happened does not show
past-reference skill; saying when it happened does not show motion. A broad domain
heading must not authorize evidence propagation to unobserved children. The merged
domain has six children; its extra opportunities cannot silently earn double rewards
or dominate a future aggregate. Gamification weighting and display geometry need
separate discussion. This report does not change historical records or migrate IDs.

These domains still omit many important dimensions, including sociolinguistic
appropriateness, interaction management, reception and mediation. Do not pretend
“Connecting ideas” exhausts pragmatics. Technical lexical/orthographic/form issues
can be reported by the correctness assessment without inventing a seventh domain.
Audio pronunciation, fluency and listening require suitable audio/task evidence;
typed text or an ASR transcript alone is insufficient.

## Source-linked evidence per automatic pass

Judge concrete **skill criteria**, then derive their domain through the native catalog.
The model cannot assign arbitrary categories. Each observed judgment needs 1–4 exact
current-learner-message ranges selected by first/last grapheme IDs plus a short reason
explaining how the wording realizes the relationship. Context references can explain
interpretation, but partner text and generated correction text cannot substitute for
learner evidence. Multiple judgments may cite the same source for distinct criteria;
deduplicate one skill judgment per message/contract. This is not overlap repair of
word-gloss targets: the evidence relation is a separate annotation type.

Proposed outcomes: demonstrated, partial, not_demonstrated, uncertain. Omitted skills
mean not observed; never failure. Use not_demonstrated only for an identifiable attempted
criterion whose failure is evidenced. Global pass status can be insufficient_evidence
even when parsing succeeds. Do not manufacture six judgments for every short reply.

Native-known assistance tags attach to the cited source ranges: inserted wording,
scaffold or revision where recorded; unknown external help remains unknown. A successful
assisted expression can be recognized as successful **under those conditions**, not
independent mastery. Explanation-language-only material cannot demonstrate target-language
production; ambiguous names/code-switching need uncertainty, not script-based language
classification. Existing assessment exclusions remain authoritative for evidence use.

## Concrete two-axis example

Context: partner asks where the learner went yesterday. Learner: `Ayer yo ir al mercado.`

- Technical correctness: **issues found**. Source `yo ir` [5,10) has a finite verb-form
  issue in this reading; proposed wording `yo fui` is assistance, never evidence.
- Likely understanding: **likely clear**. `Ayer` [0,4) and `al mercado` [11,21) make the
  intended past trip/destination recoverable in this context despite the form error.
  This predicts comprehensibility; it does not prove the partner understood.
- `past_reference`, situating: demonstrated semantic time reference, citing `Ayer`;
  do not claim correct past-tense morphology. `motion`, situating: evidence from
  `ir al mercado` [8,21) with a rationale about movement/destination. `event_roles`,
  events: possible demonstrated actor/action relationship citing `yo ir` while
  retaining the separate technical issue. Other domains are not observed.

All ranges are illustrative half-open scalar coordinates; native rendering would
derive exact excerpts from immutable source. If “yo fui” was supplied by the app in
a revised message, that revision is assisted and cannot become independent mastery.

Counterexample: `Está allí.` may be technically well formed but unclear if the
referent and place are absent from captured context. Conversely a one-word answer
can be fully appropriate when the question establishes its referent. Never equate
length, difficulty setting, grammatical perfection or politeness with understanding.

## Decisions and implementation boundary

Six is user-decided. Recommended consolidation and names above are now concrete for
review; no generic questionnaire is needed. Still discuss reward aggregation and
whether a domain view summarizes observed practice or a separately assessed proficiency
profile. No numeric probability, 1–5 grammar scale, CEFR level, XP value or unlock is
authorized by this proposal. Per-message model judgments require later calibration;
proficiency requires broader repeated evidence, task coverage and assistance-aware
assessment. No averaging turn judgments into a CEFR estimate.

Next implementation, only after approval: versioned catalog/domain mapping, pure
evidence validator, automatic operation lifecycle and presentation updates assigned
to their owners. Keep existing catalogs and garden/skill-map behavior unchanged now.
