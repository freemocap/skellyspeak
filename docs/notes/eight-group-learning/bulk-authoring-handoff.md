# Language source authoring handoff

Status: required source authoring completed in the primary chat on 2026-10-04.
See [current results and verification](catalog-authoring-progress.md). The task
instructions below record the bounded authoring scope; they are not an outstanding
request to start another agent. New content remains AI-authored and needs_review.

Read the [French review and verification record](french-authoring-review.md) and
[complete offline assessment specimen](french-assessment-specimen.json) for a
concrete composition example.

## Task to give the next model

Complete the required English-explanation source guides and assessment guidance
for the remaining target languages in SkellySpeak. Work in the shared checkout,
one complete language at a time. Follow AGENTS.md. Do not change runtime code,
contracts, schemas, global prompts, scoring, language identity or UI. Do not commit,
deploy, call paid generation APIs or create new tasks. Preserve unrelated changes.

Complete **all remaining required source documents** in this task. Work one language
at a time for quality control, but after each language's checks pass, continue
immediately to the next. Batch boundaries are checkpoints, not permission gates.
Do not stop, ask whether to continue or hand control back after each language.
The completion condition is zero `required_missing` entries and a passing `--ready`
gate, plus the final checks below. Optional translations are outside this task.

First tighten German's possibilities/constraints assessment: ambiguity between
permission and practical opportunity does not by itself make the main skill
unclear if both readings establish a correctly expressed function in that group.
Use unclear only when the evidence does not establish correct group use. Regenerate
the German inspection specimen and update its review note after this correction.

If a grammatical or variety question cannot be substantiated, try other reliable
sources and simpler demonstrably valid examples. Never invent rules or filler.
Record a genuinely unresolved item, continue independent languages, and only stop
for a blocker that prevents all remaining useful work. Context compaction or a long
run is not a request for another per-language handoff: maintain a concise progress
ledger in docs/notes/eight-group-learning/ and resume from it.

## Scope and inventory

The required source backlog at this handoff is **256 files = 16 target
languages × 8 skill groups × 2 documents**. English, Spanish, French and German
have complete source pairs; preserve them except for the German correction above. All source editions are explicitly
assigned to English by `content/policies/guide-authoring.yaml`; this is the language
of the explanatory prose, not a default grammatical system.

| Target directory | Required variety keys |
| --- | --- |
| `arabic` | `arabic-levantine`, `arabic-modern-standard` |
| `greek` | `greek-greece` |
| `hindi` | `hindi-india` |
| `indonesian` | `indonesian-indonesia` |
| `irish` | `irish-ireland` |
| `italian` | `italian-italy` |
| `japanese` | `japanese-japan` |
| `korean` | `korean-south-korea` |
| `malayalam` | `malayalam-kerala` |
| `mandarin` | `mandarin-mainland-china` |
| `portuguese` | `portuguese-brazil` |
| `russian` | `russian-russia` |
| `thai` | `thai-thailand` |
| `turkish` | `turkish-turkiye` |
| `ukrainian` | `ukrainian-ukraine` |
| `vietnamese` | `vietnamese-vietnam` |

Re-read the language file and coverage report before each batch; this table is a
handoff inventory, not a competing configuration. Continue with Italian,
Portuguese, then every remaining language in the table. Handle Arabic as a deliberate
variety-sensitive batch: Levantine is not MSA with different spelling. Follow its
existing vocalization instructions and do not present MSA examples as everyday
Levantine. If the current supplement contract cannot represent necessary teaching
examples accurately, document that specific limitation before authoring the batch;
do not silently change schemas or mark unsuitable examples `use_core`.

Do **not** bulk-author Spanish or Arabic explanatory translations in this task.
English, Spanish and Arabic remain the bundle targets, but missing explanatory
editions are supported through on-demand translation from a complete source.
The total bundled-target gap is 576 files; that is not the mandatory source backlog.
Do not treat optional translations as required runtime assessment data.

## Read these exact inputs

From the repository root:

1. `AGENTS.md`, `content/CONTENT_README.md`,
   `content/languages/LANGUAGES_README.md`, `content/skills/SKILLS_README.md`.
2. `content/policies/guide-authoring.yaml`, `content/policies/skill-credit.yaml`,
   `content/prompts/assessment/skill-criteria.yaml`.
3. `content/languages/<target>/<target>-language.yaml`: identity, every variety,
   writing guidance, orthography and declared capabilities. This remains unchanged.
4. For each skill, `content/skills/<skill>/<skill>-definition.yaml`,
   `<skill>-subskills.yaml`, and `<skill>-explained-in-english.yaml`.
   The ordered subskill IDs and shared concepts come from these exact files.
5. The two files under
   `content/languages/__TARGET_LANGUAGE_TEMPLATE/skills/__SKILL__/` and their
   referenced generated schemas under `content/rust-schemas/`.
6. Worked pairs under `content/languages/french/skills/`. Start with
   `time-events/french-time-events-assessment.yaml` and
   `time-events/french-time-events-explained-in-english.yaml`; also read
   `possibilities-constraints/` for function ambiguity and `managing-conversation/`
   for context-sensitive examples. French is a formatting and quality pattern,
   not the grammar or translated wording to impose on another language.
7. `references.bib`. Locate relevant primary references; do not recycle French
   sources as evidence about another language.

## Output paths and exact division of responsibility

For each row below, create these two files:

- `content/languages/<target>/skills/<folder>/<target>-<folder>-assessment.yaml`
- `content/languages/<target>/skills/<folder>/<target>-<folder>-explained-in-english.yaml`

| Folder | `skill_id` | Required ordered sections |
| --- | --- | --- |
| `people-places` | `people_places` | identification, qualities_states, location_movement, possession_relations, quantity_comparison |
| `time-events` | `time_events` | present_events, past_events, future_events, duration_frequency, event_sequence, event_phase |
| `information-exchange` | `information_exchange` | asking_information, answering_information, checking_facts, useful_detail |
| `feelings-viewpoints` | `feelings_viewpoints` | wants_intentions, preferences, emotions, opinions, agreement_disagreement |
| `possibilities-constraints` | `possibilities_constraints` | ability, permission, obligation, possibility, certainty |
| `reasons-connections` | `reasons_connections` | causes_reasons, consequences, conditions, contrast, supporting_claims |
| `coordinating-action` | `coordinating_action` | requests, offers_invitations, suggestions, commitments, accepting_declining, negotiating_plans |
| `managing-conversation` | `managing_conversation` | opening_closing, acknowledging, clarification, rephrasing, correcting_misunderstanding, turns_topics |

**Assessment document:** the existing schema has a single `guidance` string, not
invented per-subskill fields. Aim for roughly 120–220 English words per group.
Explain what correctly demonstrates its functions in this target language; include
at least one positive construction, one unsuccessful or absent-use counterexample,
and the context needed to distinguish neighboring functions. Cover the whole group.
Do not paste the full learner guide into the assessment or duplicate global criteria.

Assessment uses `absent`, `contextual`, `direct`, `unclear`. An unsuccessful attempt
alone is `absent`; a context-dependent correct contribution can be `contextual`.
Errors elsewhere must not erase a successful use. Do not reward a copied term,
a bare keyword or the partner’s performance. Do not require perfection, a full
sentence, a specific tense or an English-like construction unless the actual
function and target grammar require it. Do not claim a colloquial or regional form
is universally wrong. Do not rewrite probability thresholds or add subskill XP.

**Learner guide:** one section per declared subskill, in its declared order. Use
English for `explanation`, `meaning` and `note`; use the target language for
`examples[].text`. Each section needs a concise language-specific explanation and
at least one original, natural, correctly formed example, its meaning and a note
identifying the relevant construction or conversational role. Prefer one good
example, with a second only when a real contrast needs it. Do not pad sections with
shared conceptual definitions or generated boilerplate. A short answer requires its
question/context in the English note. Avoid invented gender-neutral forms that do
not exist in the target; explain gender/register choices when they matter.

Set `shared_explanation` to
`skills/<folder>/<folder>-explained-in-english.yaml`. Do not copy that document into
the target folder. Do not put Markdown emphasis, romanization, English translations,
role labels or a whole dialogue into example `text`. These examples can become the
literal opening phrase of a conversation. Explanatory prose can mention target
forms naturally. All examples must respect the target’s current writing guidance.

Every document lists every target-owned variety. `use_core` is a positive editorial
claim that the core content applies there; it is not a missing-content fallback.
Use the existing `supplement` disposition for justified differences, with precise
prose and citations. Do not invent differences just to fill a supplement. French
uses shared neutral written constructions applicable to both declared varieties;
that does not mean all conversational French is identical across those varieties.

## Provenance and research

Use a descriptive revision such as `<target>-skills-YYYY-MM-DD` and put that exact
revision in every document-level and variety-level review record. Preserve the
schema-version field. Set `origin: ai`, state AI authorship plainly and retain
`needs_review`. `generation: null` is legitimate when model identity/revisions are
not actually known; do not invent a generation model. If recording generation,
use the existing schema and real source revisions.

Consult primary grammar references, university teaching material, language
institutions or documented linguistic research. Add needed bibliography entries
with `url`, `review` and a narrowly scoped `claim`. Only use `full-text` if the
relevant text was actually read. Existing general-function references support
functional organization, not language-specific morphology or dialect equivalence.
Cite the relevant keys in each file’s provenance. Write original examples and
explanations; do not reproduce source lessons or example collections.

## Validation and inspection

Run these from the repository root after the complete language batch:

```sh
npm run content:check
cargo run --manifest-path native/Cargo.toml --bin audit-content -- --coverage
npm run check:fast
cargo test --manifest-path native/Cargo.toml --lib configuration::
```

`content:check` validates authored files but does not mean coverage is complete.
The coverage report lists exact missing paths. One complete source batch must
reduce `required_missing` by 16, with none for its target. Do not edit the gate to
make missing material pass. `--ready` is expected to fail until all source batches
are complete; at the end it must pass even if optional translations remain missing.

Inspect the actual ten-question assessment payload for every declared variety:

```powershell
'{"currentLearnerMessage":"<an original target-language test sentence>","precedingExchange":[]}' |
  cargo run --manifest-path native/Cargo.toml --bin audit-content -- --request <target> <variety>
```

This runs offline and emits the complete `state`, questions and hashed source paths.
Use actual source-language text in the command. Inspect all eight skill questions,
grammar and understandability; learner-guide prose must not be copied wholesale
into them. Review positive, negative, context-dependent and ambiguous cases on
paper for each group. These are editorial expectations, not measured model scores.
The French regression in `native/src/configuration/communication_guides_tests.rs`
checks request composition, both varieties, 42 guide sections, exact examples and
bounded skill-start context; it does not prove that French grammar is correct.

For content-only batches, do not add tautological tests that only count newly added
files. If an integration gap needs a test/code change, explain it separately and
run the applicable native Clippy/full test gates before handoff. Do not change
runtime behavior as part of bulk authoring. The final combined source state needs
full native tests and a live app acceptance pass, including on-demand translations.

## Progress and completion

Record the target, 16 exact paths, varieties, source/review status, section count,
actual check results and before/after required coverage. Include any unresolved
linguistic limitations. Distinguish schema-valid, AI-reviewed and independently
reviewed; do not call a bundle linguistically verified because Rust accepted it.

Keep language review notes under `docs/notes/eight-group-learning/` if needed.
Do not write work logs or speculative READMEs inside `content/languages/`.
Keep progress updates concise and continue automatically after each batch.

After the entire required catalog is authored, run:

```sh
npm run content:check
cargo run --manifest-path native/Cargo.toml --bin audit-content -- --ready
npm run check:fast
cargo test --manifest-path native/Cargo.toml --lib
cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings
npm run docs:links
```

A test that assumes a particular bundled document is missing may need a deliberate
fixture adjustment: remove that source in the test setup instead of depending on
production incompleteness. Such a narrowly scoped test correction is authorized;
preserve the tested failure behavior and do not weaken assertions or change runtime
code. Other necessary code/schema changes remain outside this authoring task.

Finish with one consolidated completion report: actual coverage, checks, authored
languages, unresolved linguistic review needs and a short running-app checklist.
Do not claim live provider or visual verification unless performed. Do not commit,
deploy or fill optional translation editions. If a hard blocker remains, report
exactly which required files are unfinished and why; do not call the catalog complete.
