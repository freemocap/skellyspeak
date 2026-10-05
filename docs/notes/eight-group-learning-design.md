# Eight group learning design and implementation checklist

Status: core source implementation and required multilingual authoring complete.
Final running-app acceptance and independent linguistic review remain open.
See [PR readiness](eight-group-learning/pr-readiness.md) for current verification
and [content implementation](eight-group-learning/content-implementation.md) for source ownership.
Updated: 2026-10-04.

This document specifies eight communicative groups, teaching subskills, complete
authored language guides, personal evidence, contextual coaching and targeted
conversation starts. Checked tasks identify implemented or reviewed artifacts;
unchecked tasks are requirements, not working features.

## Agreed decisions

- The eight groups below are the accepted design direction. The catalog defines
  42 teaching subskills; multilingual boundary review remains open.
- Only the eight main groups are assessment and XP units. Subskills organize
  guides and conversation targets; they have no individual XP, levels or tracked
  assessment results in this version.
- Use the Jev Choice pipeline and its four-category probabilities.
  Revise the criteria to judge correct use, tolerating errors unrelated to the
  demonstrated function. Use a 0.6 combined-positive threshold and
  experience/effort revision rules initially. Evaluate prompt quality later.
- Every group question includes compact offline-authored language and variety
  guidance. Merely naming the language is insufficient. Native code assembles
  questions, validates answers and awards credit; the hosted server transports
  bounded requests without learning or reward policy.
- The application will ship complete required authored material for every supported
  target language and variety. English, Spanish and Arabic are the incremental
  bundled explanation target; missing translations are generated on demand. AI
  authorship is an acceptable minimum, with explicit provenance and review metadata.
- Shared definitions describe communicative meanings and functions. No language's
  grammar is the universal default. Optional language-specific prose is an explicit
  content decision, not a missing guide or a runtime availability feature.
- Authored content and learner experience are separate. No learner evidence is a
  valid personal state; missing required application content is a defect.
- The language workspace is one surface with the conversation and coach at its
  centre. Practice and Skills are secondary destinations opened from that
  workspace, not peer tabs. Opening one replaces the conversation area and keeps a
  visible return to the active conversation; returning restores the draft, scroll
  position, and coach thread. Suggested icons are speaking people, a bicep, and a
  brain, with visible labels where space permits and accessible names everywhere.
  Mockup: the "SkellySpeak language workspace" Design canvas (2026-10-03).
- Skills combines explanations, target-language examples, personal usage, and
  access to the coach. It is part of the existing app, not a separate application.
- The coach thread stays per conversation, as the native model already has it
  (`coachMessages` on the conversation; `askCoach` takes a `conversationId`).
  Skills does not get its own coach pane. "Ask the coach" from a guide or an
  example asks in the active conversation's thread with a typed context attached
  to that question (W7 below).
- Add an action to start a conversation from a phrase or bubble, and an action to
  start one targeting a skill. Both use the current partner without prompting; the
  action names the partner ("Practice this with Lupe"). Switching partner happens
  in the top bar first.
- Provide Ask the coach on relevant guides, examples, and personal evidence, with
  the relevant language and skill context supplied automatically.
- Use Fast for partner replies and reply briefs. Keep partner text independent of
  assessment completion and preserve native scheduling priority for visible replies.
- One Jev request evaluates eight skill groups, grammar and understandability.
  Grammar and understandability never grant additional skill XP. The separate
  partner-understood effort counter uses the understandability result.
- Optional assistance has two execution modes: Automatic and On demand. These
  control actual request creation, not merely whether a result is displayed.
- Do not award or display a clean-message effort counter. Absence of detected
  mistakes is not a reliable perfection target. This does not change the
  skill-specific correct-use gate or qualifying revision effort.

## Agreed AI execution and disclosure

Execution routing and activation below are implemented and regression-tested. Live-app testing has begun; complete content coverage and contextual start flows remain open.

| Feature | Model | Initial execution mode | Required source |
| --- | --- | --- | --- |
| Partner reply | Fast | Always on submission | Learner message and bounded conversation context |
| Assessment: eight skills, grammar, understandability | Jev | Automatic | Learner message and preceding exchange; no subsequent partner reply |
| Coaching feedback | Standard | Always on submission | Learner message and relevant preceding context |
| Reply brief | Fast | On demand | Actual partner reply and bounded preceding context |
| Reading support: translation and word gloss | Fast translation; Standard gloss | On demand | The exact selected learner or partner text |
| Suggested replies and usage explanations | Standard | On demand | Actual partner reply and relevant context |
| Read aloud | Configured speech route | Existing read-aloud preference | Actual partner text |

Workspace-wide preferences cover assessment, reply brief and reading support.
Coaching always runs automatically and adds error marks without opening Analysis. Central Settings and the AI panel edit the same native-owned
values; there are no per-conversation overrides in this pass. Suggested replies
and usage explanations remain explicit learner actions. Supporting quote extraction
is internal assessment work, not another learner setting; it must not block partner
text or award credit a second time. Partner replies, openings and reply briefs use Fast; regression tests cover their
captured model routing.

### On-demand lifecycle

- Automatic schedules a feature when its required source becomes available.
- On demand creates no inference request until the learner opens or requests the
  feature. Opening saved results is a read, not another paid inference.
- Repeated clicks share an existing pending operation. Failed or unknown outcomes
  expose an explicit Retry; opening a failed result does not silently retry it.
- Preference changes govern subsequent turns. They do not backfill conversations,
  delete results or silently cancel running work. Already-requested operations finish
  under their captured execution policy unless explicitly canceled.
- A late request uses the saved message and captured linguistic context. Resolve
  current access authority at request time. Do not reinterpret source content after
  language, variety or partner changes.
- A late assessment may award qualifying credit once. Missing assessment means
  Not assessed, not zero ability. Not requested, pending, insufficient evidence,
  failed and completed are distinguishable states.

### Combined assessment contract

One request contains `model`, `state` and ten independently evaluated entries in
`questions`. Shared state contains the exact learner message, preceding speaker
turns, input provenance, selected language/variety and compact authored assessment
guidance. It excludes learner-facing chapters, translations of those chapters,
unrelated conversation history and the subsequent partner reply. Each question
explicitly names the state fields and authored guidance it uses. Questions cannot
read one another's answers. [@typesafePrimitives2026] [@typesafeState2026]

| Questions | Choice outcomes | Native consumer |
| --- | --- | --- |
| Eight main skill IDs | absent, contextual, direct, unclear | Correct-use gate, evidence and eight-group XP |
| grammar | acceptable, local_errors, major_errors, insufficient_evidence | Message feedback only |
| understandability | understandable, needs_clarification, unrecoverable, insufficient_evidence | Face, message feedback and partner-understood effort counter; no skill XP |

Keep full distributions and confidence available in details. Confidence is not a
grammar percentage, and the number of demonstrated groups is not a correctness
percentage. The initial UI uses categories rather than an invented 0–10 mapping.
The understood face represents estimated understandability of the learner's message,
not an observed mental state or emotion. Clarification/unrecoverable outcomes use
the confused presentation; insufficient evidence uses a neutral unavailable judgment,
never an invented positive or negative result. Exact icon/copy is part of UI review.
The face opens the full message assessment, including grammar and eight skill results;
Ask the coach receives that saved result and its source context.

Validate complete known question coverage and probability values before publication.
Bind the result to its source version, attempt, content revision and credit policy.
Publish the assessment and applicable credit in one native transaction. The hosted
service validates bounded transport requests and reports usage; it does not interpret
skills, select awards, or own learner execution preferences.

### Audit findings and acceptance checks

Confirmed by source inspection on 2026-10-04:

| Finding | Exact source | Required verification |
| --- | --- | --- |
| Coach proactivity selects feedback intensity; it does not disable automatic scheduling | `native/src/learning/coaching/coach_policy.rs`, `native/src/conversations/turn_plan.rs` | On-demand features make zero requests before invocation |
| Reply/context/speech operations already receive queue priority | `native/src/conversations/execution/dispatch.rs` | Preserve priority and measure reply delay under occupied background capacity |
| Requested reply help reuses an existing operation | `native/src/conversations/execution/assistance.rs` | Duplicate clicks share work; retries remain explicit |
| Skills, message ratings and reaction currently have separate operation consumers | `native/src/conversations/execution/publication.rs`, `snapshots.rs`, `native/src/conversations/assessments.rs` | Exactly one combined Jev operation feeds all assessment displays |
| XP comes from accepted skill observations; quote attribution is a separate dependent operation | `native/src/learning/practice.rs`, `rewards/mod.rs`, `coaching/assessment_adapter.rs` | Grammar/face never award XP; extraction failure cannot duplicate credit |
| Learner projections consume catalog identities, assessment and attribution | `native/src/learning/learner/progression.rs`, `learner_state.rs` | Every consumer accepts the same eight group IDs |
| Message-size diagnostics omit Jev question instructions | `native/src/diagnostics/inference.rs` | Report state, question and complete request sizes separately |
| Face details assume the actual partner reply; feedback cards expect numeric ratings | `ui/src/features/conversation/partners/PersonaReaction.tsx`, `coaching/ConversationFeedbackCard.tsx` | Category display and source context match the combined request |

The model-comparison pilot supports further Fast partner-reply evaluation, not a
blanket Fast assignment for glosses or coaching. See
[the measured pilot](model-comparison-initial-results.md) and
[its quality review](model-comparison-expanded-plan.md). Fast partner replies are
an explicit product decision; fixture tests cannot establish linguistic quality.

Operational diagnostics retain sizes, timings, requested/actual model, request IDs,
validation stages and reported token/cost metadata without learner content. Exact
prompt inspection is private to the workspace and labels specimen versus actual
request. Show contributing content paths/revisions. Distinguish provider-reported
cost from admission reservations and token estimates; no paid run of the proposed
ten-question request has been performed in this audit.

## Research basis and limits

Functional-notional teaching separates concepts such as time, space, and quantity
from communicative actions such as seeking information and requesting action.
This informs the distinctions below; it does not establish eight independent
measurable abilities. [@threshold_general_notions] [@waystage_language_functions]

Dialogue-act research models semantic content, communicative functions, and
relations between contributions. It supports examining context and permitting
multiple supported labels, not awarding credit merely because many labels fit.
The annotation framework does not validate a learner scoring formula.
[@bunt2020_dialogue_acts]

Communication repair has empirical support across a sample of twelve languages
from eight families. Clarification and repair deserve explicit treatment; the
study does not establish this entire catalog as a universal taxonomy.
[@dingemanse2015_communication_repair]

The eight-group arrangement, labels, example counts, and radar in the conversation
mockup are product proposals. The mockup shows sample coverage, not a validated
proficiency score or an agreed level formula.

## Candidate catalog

This starting inventory contains 42 proposed subskills. Freeze it after boundary
review; do not turn the count or the mockup wording into an accidental requirement.
Group numbers are discussion references, not proposed persisted identifiers.

| Group | Purpose | Candidate subskills |
| --- | --- | --- |
| 1 People, things, and places | Establish referents and describe their properties and relationships | Identification; qualities and states; location and movement; possession and relationships; quantity and comparison |
| 2 Time and events | Situate events and express their temporal structure | Present situations; past events; future events; duration and frequency; sequence; ongoing and completed events |
| 3 Feelings and viewpoints | Express a person's internal perspective | Wants and intentions; preferences; emotions; opinions; agreement and disagreement |
| 4 Possibilities and constraints | Express what is possible, permitted, required, or uncertain | Ability; permission; obligation and necessity; possibility; certainty and uncertainty |
| 5 Reasons and connections | Explain relationships between ideas | Causes and reasons; consequences; conditions; contrast; supporting a claim |
| 6 Information exchange | Seek and supply relevant information | Asking for information; answering relevantly; checking facts; providing useful detail |
| 7 Coordinating action | Arrange or influence what people do | Requests; offers and invitations; suggestions; commitments; accepting and declining; negotiating a plan |
| 8 Managing conversation | Establish contact and maintain mutual understanding | Opening and closing; acknowledging and responding; asking for clarification; rephrasing; correcting a misunderstanding; managing turns and topics |

Every final subskill definition must include a purpose, positive evidence,
counterexamples, required context, neighboring boundaries, and representative
realizations across structurally different languages. Presence is not correctness,
independence, difficulty, or mastery; define those separately if the product uses them.

### Boundaries to resolve with examples

- Identification versus description versus a present situation: avoid automatic
  multiple credit for any sentence that identifies a current state.
- A desire or intention does not necessarily locate an event in the future.
- Ability, permission, and requests can share wording but have different functions.
  Judge the contribution in its context, not its grammatical surface alone.
- Information checking asks whether a proposition is true; clarification checks
  how a previous contribution should be understood. Document ambiguous cases.
- Agreement about a claim differs from accepting an invitation or commitment.
- A conditional relation differs from merely mentioning a possible outcome.
- Rephrasing for mutual understanding differs from repeating a sentence or applying
  a correction without expressing a new communicative contribution.
- Negation can operate within any group. Do not restore a generic affirmation or
  negation bucket, or count every declarative sentence as independent evidence.
- Where politeness, thanks, apologies, narration, and summaries belong needs an
  explicit coverage review. Do not hide gaps in an unrestricted other category.

## Learner flows

### Practice and Skills responsibilities

Conversation is the main workspace for exchanging messages and asking the coach.
Practice owns saved phrases, repetition, recordings and comparison with reference
audio. Skills owns explanations of communicative capabilities, authored examples
and the learner's evidence. Saving a phrase to Practice is distinct from starting
a conversation from that phrase. Both destinations may lead into conversation;
neither owns a second coach thread. The eight groups organize Skills and evidence,
not eight separate practice modes.

### Skills and personal evidence

Opening Skills retains the selected target language and variety. A learner selects
a group, then a subskill. The same surface offers the shared concept, how the
selected language expresses it, authored examples, and the learner's own examples.
Authored examples and personal evidence must remain visibly distinguishable.

Proposed desktop layout: group navigation and optional radar at left, explanation
and evidence in the main area. Narrow layouts stack the guide and evidence.
Skills has no separate coach pane: Ask the coach returns to the active
conversation with question-specific context, retaining Skills selection. Whether
guide/evidence use tabs remains open.

Personal evidence identifies the source conversation and relevant surrounding
turns. No observed evidence is neither a failure nor an assertion of inability.
Context insufficient for a judgment must not become zero ability. Technical
assessment failure is shown separately from absence of evidence.

Track eight main-skill XP totals. There are no subskill counters or mastery claims.
Experience counts newly demonstrated groups; effort counts qualifying repeated
groups on changed revisions. Display and levels consume the same group totals.

### Start a conversation from a phrase

The learner invokes a branching-style action on a bubble, authored example, or
selected text. The action captures the exact source text and language context,
then starts a new conversation with the selected persona.

The partner's first message must be the phrase or contain it naturally, depending
on whether it can stand alone. Merely discussing its topic is insufficient.
Show the seed in the new conversation's setup. Starting from a phrase does not
award the learner evidence for the partner's generated use of that phrase.

Agreed: preserve the selected phrase verbatim and allow surrounding words. Do not
change spelling, punctuation, Unicode encoding or inflection. In conversation
bubbles, selected text takes precedence; otherwise use the whole message. Native
validation accepts 1–2,000 characters, rejects blank/control text and requires an
exact source substring. Reject a partner whose language differs from the source.
Archived or replaced sources cannot initiate a new conversation.
If the required opening cannot be produced or validated, report the failure with
an explicit retry path rather than publishing an unrelated successful opening.

### Start a conversation for a skill

The learner chooses a group or subskill and starts with the selected persona.
The partner creates opportunities for the learner to use the target capability.
The partner demonstrating it alone does not satisfy the practice objective.

Subskill targeting is direct. For a whole group, decide whether the learner chooses
a subskill or a declared policy selects one. Show the actual target. Decide how
long targeting persists and how it interacts with topic and difficulty controls.
Skill targeting and phrase seeding are distinct start intents; combining them is
not required for the first implementation unless explicitly designed.

### Ask the coach

An action on a guide, authored example, or personal example opens the coach with
the selected language/variety, group/subskill, relevant authored material and its
revision, selected text, and necessary conversational context. The learner can
inspect the visible context and ask a question without restating it.

Context is scoped to the question. Changing the selected skill must not silently
reinterpret earlier coach messages. Coach answers are interactive guidance, not
automatic edits to the authored guide, partner history, or assessment ledger.
The coach thread belongs to the active conversation; the attachment belongs to
the individual question.

## Content ownership and completeness

| Layer | Owns | Completeness requirement |
| --- | --- | --- |
| Shared catalog | Main skill and teaching subskill identities, definitions and boundaries | Eight assessable groups; each subskill has a teaching definition and declared context |
| Shared learner explanation | Conceptual explanation independent of target-language grammar | Complete source concepts; three bundled explanation languages as an incremental target |
| Target-language realization | Examples, constructions, usage notes and compact assessment guidance | Explicit coverage of every required subskill and offered variety |
| Language-specific detail | Additional distinctions that improve the selected language's guide | Authored detail or an explicit no-additional-detail disposition |
| Authorship and review | Origin, generation/source provenance, revision and human review | Mandatory origin and provenance; human review may follow the complete generated baseline |
| Personal evidence | Learner usage and its source context | May legitimately be empty; never used to infer content completeness |

Target language, target variety, explanation language, and interface locale are
separate axes. Define their required combinations before bulk authoring. Do not
silently render English explanations when another explanation language is selected.
Examples must retain target text, meaning, and an explanation of what they illustrate.

Proposed authorship values are AI-generated, human-authored, and mixed. Record
content/source revision, generation provenance where applicable, and review scope.
A reviewed parent record must not imply review of every translation or variety.
Automated schema validation and human linguistic review must remain distinct.

Completeness is checked offline during authoring and in build validation. Missing
required content fails validation. It is not a normal learner-facing guide state.
No extra language-owned subskill is needed merely because a language realizes a
shared function differently. Additional identities require a shared-catalog review.

### Agreed directory and file responsibilities

This is the target layout, not the current on-disk tree. Names below a template
directory are literal template filenames. Every top-level folder has the concise
SCREAMING_SNAKE_CASE README shown here: purpose, exact structure, file roles and
editing/validation instructions. Templates contain real required field shapes and
provenance fields, not empty stubs.

```text
content/
  CONTENT_README.md
  languages/
    LANGUAGES_README.md
    __TARGET_LANGUAGE_TEMPLATE/
      TARGET_LANGUAGE_README.md
      __TARGET_LANGUAGE__-language.yaml
      skills/
        time-events/
          __TARGET_LANGUAGE__-time-events-assessment.yaml
          __TARGET_LANGUAGE__-time-events-explained-in-__EXPLANATION_LANGUAGE__.yaml
    spanish/
      SPANISH_README.md
      spanish-language.yaml
      skills/
        time-events/
          spanish-time-events-assessment.yaml
          spanish-time-events-explained-in-english.yaml
          spanish-time-events-explained-in-spanish.yaml
  skills/
    SKILLS_README.md
    __SKILL_TEMPLATE/
      __SKILL__-definition.yaml
      __SKILL__-subskills.yaml
    time-events/
      time-events-definition.yaml
      time-events-subskills.yaml
  prompts/
    PROMPTS_README.md
    assessment/
    conversation/
    practice/
  policies/
    POLICIES_README.md
  language-foundations/
    LANGUAGE_FOUNDATIONS_README.md
  conversation-topics/
    CONVERSATION_TOPICS_README.md
  speech/
    SPEECH_README.md
  rust-schemas/
    RUST_SCHEMAS_README.md
```

The tree illustrates one skill and target language; each catalog group and supported
language follows its template. Subskills are records in each group's subskills file,
not individual directories. Assessment prose is authored once per target/variety;
explanation-language files do not duplicate it. Shared conceptual explanation needs
an explicit locale owner in C1; the directory map does not authorize an English
fallback or repeated copies in every target language.

| Source content audited | Intended owner and treatment |
| --- | --- |
| `content/languages/*.yaml` | Per-language directory; identity, varieties, writing guidance and phrase-bank fields remain explicitly defined by the language template |
| `content/shared/communication.yaml` | `skills/<skill>/` definition and subskill records |
| `content/communication/<target>/<explanation>.yaml` | Per-language skill files, separating assessment guidance from translated learner explanations |
| `content/shared/language-foundations.yaml` | `language-foundations/` for scripts, families and shared writing definitions |
| `content/shared/conversation-topics.yaml` | `conversation-topics/` for topics and localized labels |
| `content/shared/speech-routing.yaml` | `speech/` for provider capabilities and routing data |
| `content/shared/teaching-policy.yaml` | `policies/` for credit, rewards and learner policy; task instructions belong in the named prompt owner |
| `content/shared/skills.yaml`, `learning-goals.yaml`, `learning-map.yaml` | Review their consumers explicitly; the active skill definition/navigation contract must have one owner under `skills/`, not a parallel catalog |
| `content/prompts/skills/demonstration.yaml`, `prompts/conversation/ratings.yaml` | `prompts/assessment/` for the combined assessment's named instructions and criteria; credit thresholds belong in `policies/` |
| `content/prompts/conversation/instructions.yaml` and Rust-owned partner/coach/support/translation/gloss instruction strings | `prompts/conversation/`, with a clearly named instruction file for each task |
| `content/prompts/drill/instructions.yaml` | `prompts/practice/` for phrase generation |
| `content/schemas/*.yaml` | `rust-schemas/`; generated from Rust authoring contracts |

Markdown owns editable instruction prose. YAML owns structured criteria, definitions,
settings and provenance. Rust owns executable assembly and response validation.
Authoring schemas describe content files; provider response contracts describe AI
answers. Neither is a substitute for the other.

Both `native/build.rs` and `native/src/configuration/loading.rs` currently exclude
all Markdown and specially exclude `schemas`. Their inclusion rules must change
together: include declared prompt Markdown, exclude READMEs/templates/generated
schemas, reject unknown runtime files and validate templates separately. Update
the content workbench, inspector, schema exporter, path references and checks in
the same content packet. Do not move files without updating their consumers.

### Content field specification for review

The following is a proposed field contract, grounded in
`native/src/configuration/communication.rs` and `communication_guides.rs`.
It is not a generated schema or an implemented loader contract.

| Document | Required content | Excludes |
| --- | --- | --- |
| `<skill>-definition.yaml` | `schema_version`, `revision`, `id`, editorial `name`, `purpose`, `boundary`, provenance | XP totals and language-specific grammar |
| `<skill>-subskills.yaml` | Parent `skill_id`; ordered `subskills` with `id`, editorial `name`, `purpose`, `positive_evidence`, `counterexample`, `context`, `boundary`, `neighbors`; provenance | Subskill XP and learner state |
| `<skill>-explained-in-<explanation>.yaml` under `skills/<skill>/` | `skill_id`, `explanation_language`, localized `title`, `introduction`; sections keyed by `subskill_id` with `title` and `concept`; provenance | Target-language constructions |
| `<target>-<skill>-assessment.yaml` | `language`, `skill_id`, core `guidance`, explicit `varieties` keyed by variety ID; each states `use_core` or provides `supplement` with provenance | Explanation-language variants, learner-facing chapters and runtime scores |
| `<target>-<skill>-explained-in-<explanation>.yaml` | `language`, `skill_id`, `explanation_language`, shared explanation reference; one section per subskill containing `explanation` and examples with target `text`, translated `meaning`, and explanatory `note`; explicit variety detail dispositions; provenance | Duplicated shared concepts and assessor guidance |
| Assessment prompt Markdown and criteria YAML | Complete question instructions; named criteria; referenced state paths; content revision | XP thresholds and learner records |
| Credit policy YAML | Positive categories, combined-positive threshold, revision/effort rule and policy identity | Prompt prose, UI geometry and authored language facts |

All authored documents carry `schema_version` and `revision`. Provenance carries
`origin` (`ai`, `human`, `mixed`), authorship, citation keys, generation details when
known, and separate review status/scope. Generation details include model and source
revisions for newly generated content. Missing provenance must be explicit, never
invented. Content review is scoped to the exact revision and language/variety; an
edit to reviewed prose requires a fresh review disposition. Pure mechanical moves
do not claim a new linguistic review. Validators reject unknown fields, invalid
references and implicit variety/locale fallback.

The shared explanation file is a proposed addition to the skill template. Store
one conceptual translation per skill/explanation language. Each target guide
references it explicitly and adds only that target language's realization. The UI
combines shared headings/concepts with the selected target guide. Runtime Jev
assembly reads assessment files independently of explanation-language selection.

### Finite authoring coverage

Twenty target languages remain available. English, Spanish and Arabic are the
initial bundled explanation-language target; all supported explanation languages
remain selectable. `content/policies/guide-authoring.yaml` names each target's
source explanation edition explicitly. It is an authoring language, never an
English grammatical default or a silent display fallback.

| Document | Required source baseline | Full initial bundled target |
| --- | ---: | ---: |
| Shared explanations | 8 in the declared source edition (currently English) | 8 × 3 = 24 |
| Target-language assessments | 20 × 8 = 160 | 160 |
| Target-language learner guides | 20 × 8 = 160 | 20 × 8 × 3 = 480 |
| Total | 328 | 664 |

Source guides include every subskill and explicit variety dispositions. Missing
source material remains an error. Bundled translations can grow incrementally:
missing translations do not block source readiness. On opening a guide, use the
bundled edition, then a matching local translation, then generate a translation
of that guide's authored explanation fields. Preserve example text and IDs in
native code. Record AI authorship, source revisions, model and execution metadata.
Cache identity includes source content, explanation language, selected variety and
translation instructions. Failed work requires explicit Retry. This path neither
runs on every turn nor awards learning credit. Generated content is a local,
evictable cache; promotion to bundled authored content is separate authoring work.

### Data ownership and publication review

Confirmed current sources: `native/src/storage/schemas/schema.sql`,
`settings.sql`, `native/src/conversations/assessments.rs`,
`execution/publication.rs`, `native/src/learning/practice.rs`,
`rewards/mod.rs` and `effort/sources.rs`.

| Record | Owner and planned responsibility |
| --- | --- |
| Source message and preceding context | Conversation owner. Assessment references the immutable message version and captured linguistic context; it never rewrites source text. |
| Operations and attempts | Execution owner. Request identity, actual payload, model, state, errors and provider receipts remain attributable to one operation/attempt. |
| Combined accepted assessment | Learning owner, published against the successful source attempt. The ten answers share one result identity; UI consumers do not persist competing copies. |
| Skill credit and reward events | Learning owner, same transaction as accepted assessment. Grammar and understandability do not become skill IDs or additional skill XP. |
| Quote attribution | Source-bound learning evidence, separately identified as pending/complete/failed. It cannot independently award credit. |
| Levels and learner views | Derived native projections of the same eight-group evidence and credit. UI renders generated contracts; it does not recalculate awards. |
| Automatic/on-demand preferences | One native-owned workspace preference record with revision checking. Settings and AI panel share it; capture the applied revision in new work. |
| Feedback disclosure | Owned by the exact accepted result. Opening a card or asking the coach cannot assess or credit the source again. |
| Practice cards, audio, credentials and unrelated conversation settings | Their existing domain owners; assessment publication has no authority to rewrite them. |

Publication is one transaction: check source/attempt authority, validate complete
result coverage, save the accepted result, compute eligible skill credit, save reward
events and complete the operation. Failure rolls back product publication while
retaining useful attempt diagnostics through the established failure path. Late
requests, revised messages, repeated clicks, retries and restart must not duplicate
credit or attach evidence to a different message version.

Persisted JSON and SQL changes require the repository's explicit workspace migration
review, consecutive steps and recovery checks. Do not choose a format version until
implementation inspects the current chain. Released format contracts and unrelated
records remain outside this packet's editing authority.

**Decided:** the active experience has no clean-message (`no_issues_flagged`)
effort counter. Coaching can still describe specific errors; neither an empty
correction list nor a grammar category grants a clean-message award. The skill
correct-use gate continues to tolerate unrelated errors.

This requires a complete consumer change, not just hiding a counter:

| Consumer | Exact source | Required implementation scope |
| --- | --- | --- |
| Qualification and award creation | `native/src/learning/effort/qualification.rs`, `sources.rs` | Remove the clean-message qualification/award path; keep other effort dimensions independently specified |
| Native totals and reporting | `native/src/learning/effort/mod.rs`, `report.rs`, `native/src/learning/learner/progression.rs` | No clean-message field, total, filter or report category in the active product contract |
| Shared UI counters and aggregation | `ui/src/components/learning/effort-dimensions.ts`, `LanguageTable.tsx`, `ui/src/state/learning/useLanguageTotals.ts` | No Clean counter, column, aggregation or sorting option |
| UI styling and localization | `ui/src/styles/components/progress-counters.css`, UI localization dictionaries | Remove only references owned by this counter; check dynamic callers before deleting labels/icons |
| Persistence | `native/src/storage/schemas/schema.sql`, workspace migration coordinator | Specify intentional retirement and affected record ownership under the migration contract; do not edit released steps or reset workspaces |
| Contracts and tests | Rust exporter, generated UI contracts, effort and message-rating suites | Regenerate types and test that coaching/assessment completion cannot create the counter |

**Decided:** retain the separate `partner_understood` effort counter, driven by
the validated combined Jev understandability result. The `understandable` choice
qualifies for one unit per submitted message version. `needs_clarification`,
`unrecoverable` and `insufficient_evidence` do not qualify. A pending, unrequested
or failed assessment grants no unit and is not a negative learner judgment.
The counter has no independent AI call, coaching dependency or skill XP effect.

Publish its unit in the assessment's native transaction. Keep source-bound
deduplication: retries, repeated reads, late assessment and restart cannot award
the same submitted message twice. The saved award records its inclusion policy;
changing a display or reopening details cannot recalculate earned units. Full
probabilities remain inspectable; qualification uses the selected category, not
the skill XP probability threshold or a new confidence threshold.

## Implementation owners

| Responsibility | Owner |
| --- | --- |
| Workspace navigation | `ui/src/app/`, `ui/src/state/navigation/` |
| Skills guides and evidence | `ui/src/features/skills/`, `ui/src/state/learning/` |
| Phrase actions | `ui/src/components/reading/`, `ui/src/features/conversation/messages/` |
| Authored catalog and guides | Target owners: `content/skills/`, `content/languages/<language>/skills/`; source mapping above |
| Content validation and inspection | `native/src/configuration/communication.rs`, `communication_guides.rs`, `communication_inspection.rs`, `native/src/bin/inspect-content.rs` |
| Assessment, evidence and XP | `native/src/learning/practice_assessment.rs`, `practice.rs`, `coaching/`, `learner/`, `rewards/` |
| Conversation starts and coach context | `native/src/conversations/` |
| Workspace schema and transactions | `native/src/storage/` |
| Provider transport | `server/app/inference/`; no skill or XP policy |
| Request execution preferences | Native-owned workspace preference contract; UI Settings and AI activity consume generated types |
| Model roles and activation | `native/src/conversations/turn_plan.rs`, `execution/turns.rs`, `execution/dispatch.rs` |
| Assessment disclosure | Native snapshots and `ui/src/features/conversation/partners/PersonaReaction.tsx`, `coaching/ConversationFeedbackCard.tsx` |

## Workspace tasks

- [x] W1 Keep conversation state mounted while Practice or Skills is open; pause hidden interaction observers. Component regressions pass; native-app checks remain open.
- [x] W2 Provide Practice and Skills destination buttons in the conversation workspace.
- [ ] W3 Show Back to conversation with the active conversation title. The return action is implemented; the title and native-app restoration checks remain open.
- [x] W4 Provide accessible bubble tools for Translate, Words, Pronunciation and Analysis, with source-specific playback, inspection and editing controls.
- [x] W5 Add phrase-seeded conversation starts using the selected partner, exact source text and validated opening behavior.
- [x] W6 Add group/subskill-targeted conversation starts with an explicit target and duration policy.
- [x] W7 Attach typed guide/example context to a question in the active conversation's coach thread; display its scope and treat quoted content as data.
- [x] W8 Compose Skills from group/subskill navigation, authored explanations, personal evidence and conversation/coach actions.

### Language controls

App language is the primary interface and explanation choice in Settings and
onboarding. Explanation options holds an explicit independent explanation-language
override. Preserve existing settings until the learner edits them. Interface locale
and explanation language remain separate internal capabilities; the primary control
updates both in one settings change.

## Open decisions

Resolve these with concrete examples and layouts, before their dependent contracts.
Do not reopen the agreed eight-group direction, complete authoring requirement,
or main-group-only XP.

| Decision | Specific question | Blocks |
| --- | --- | --- |
| Catalog boundaries | Which of the 42 candidates need splitting, combining, or sharper evidence definitions? | Assessment and full authoring |
| Evidence and rewards | Decided: eight-group XP, correct direct/contextual use, 0.6 probability gate and revision/effort behavior initially. Prompt-quality experiments follow implementation. Group display and reward integration must use those same eight totals. | Implementation, not another scoring-design gate |
| Coach context attachment | Whole-guide references and per-question source attachments are implemented. Scoped example/subskill coach actions are implemented. | Real-app acceptance |
| Phrase opening policy | Exact phrase with surrounding words allowed; implemented for durable bubbles, their selections and authored guide examples. Decided 2026-10-04: reading surfaces (word popups, Word help inspector) carry no phrase action; the bubble fork and guide example actions are the entry points. | Real-app acceptance |
| Target duration | Explicit group stays broad; an explicit subskill selects its authored section. Target persists until conversation direction changes. Keep partner/difficulty, use the inspected variety, and clear unrelated topic/time filters. | Implemented; real-app acceptance pending |
| Explanation coverage | Explicit source editions are required for all 20 languages. English, Spanish and Arabic are the bundled explanation targets; missing translations are generated on opening. Interface catalogs remain independently complete. | Implemented; translation quality remains reviewable |
| Data ownership | Keep learning writes scoped to learning-owned fields and tables; protect conversation, practice-card, audio, settings and credential owners. | Persistence implementation |

## Delivery checklist

### Source reconciliation — 2026-10-04

Checked items mean implemented requirements with source/test evidence, not a
completed release or linguistic review. The [implementation checkpoint](eight-group-learning/content-implementation.md)
records verification. The learner has exercised the running conversation pipeline;
full acceptance remains open.

| Completed items | Evidence |
| --- | --- |
| C1–C4, C7 | `native/src/configuration/authoring/{mod,validation,tests}.rs`, `native/src/learning/turn_assessment.rs` and its tests: typed content, provenance, revision-bound review, finite coverage, ten-question request and strict failures |
| L1–L2 | `native/src/conversations/execution/tests/{communication_assessment,turn_assessment}.rs`: correct-use gate, exact group coverage, atomic credit, changed-revision effort, duplicate rejection and reopen |
| L8 | `native/src/conversations/turn_plan.rs` and execution routing tests: Fast replies, openings and brief |
| L13 | `native/src/conversations/execution/tests/{turn_assessment,activation}.rs`: understood credit, abstention, failures, rollback and late one-time publication |
| U11 | `ui/src/components/learning/{effort-dimensions,LanguageTable,ProgressCounters}` and regression tests: clean-message counters removed; unrelated coaching verdict remains |

The current release checkpoint is [PR readiness](eight-group-learning/pr-readiness.md).
Unchecked items below include broader research, review and visual acceptance; they
are not all missing runtime implementations. C8 still lacks a dedicated offline
start/coach-context preview command. Language-quality experiments, independent
linguistic review and full accessibility/device acceptance remain separate work.

Source evidence for contextual flows: native guide/phrase/skill-start handlers and
execution tests; UI GuideActions, StartPhraseButton, SkillsPage and navigation tests.
The catalog review records all 20 source bundles and exact files. Hover layout and
label changes have component coverage; final native-app visual acceptance remains open.

### Phase 1 Finalize product behavior and definitions

- [x] D1 Implement the initial shared catalog with eight stable group IDs, 42 teaching subskills, purposes, positive/counterexamples, context requirements and neighbor boundaries in `content/skills/<skill>/`. Linguistic review and multilingual contrast fixtures remain D2.
- [ ] D2 Create contrast cases for every boundary listed above, including multilingual examples and cases where context is insufficient.
- [x] D3 Author the initial Past events, Requests, and Asking for clarification specimens, with selected-variety guidance and readable exports of their containing groups. These are content/request specimens, not a completed UI flow; see the exports below.
- [x] D4 Mock up the workspace hierarchy (conversation + coach centre; Practice and Skills as destinations), coach context, and both conversation-start flows at wide and phone widths. Done on the Design canvas; language switching not yet drawn.
- [x] D5 Decide coach thread ownership: per conversation (as built). Skills asks into the active conversation's thread with typed context (W7).
- [x] D6 Decide phrase inclusion/adaptation, source selection limits, and group-target selection/duration. Persona is decided: the current partner, no prompt.
- [x] D7 Set the initial assessment/credit policy: eight groups, correctness-aware Jev criteria, 0.6 probability gate and experience/effort revision handling. Implemented in the native assessment/credit pipeline; controlled regression tests pass. Linguistic accuracy remains subject to evaluation.
- [ ] D8 Document learning data ownership and transaction boundaries, including fields shared with conversations and practice.

Gate: reviewed definitions, three complete guide specimens, flow mockups, and
resolved decisions needed by Phase 2. Owner areas: product, language content,
learning domain, conversation flow. No bulk generation against an unsettled schema.

### Phase 2 Establish content and contract requirements

- [x] C1 Specify shared definitions, localized explanations, target-language realizations, variety sections, examples, and explicit inheritance/no-detail dispositions.
- [x] C2 Specify mandatory authorship/provenance and separate review fields; define how edits invalidate or preserve review at the correct scope.
- [x] C3 Generate a finite coverage matrix from the actual language, variety, explanation-language and interface-locale registries.
- [x] C4 Specify the ten-question Jev request and typed results: eight main groups, grammar and understandability, with source-turn ownership, authored guidance, context requirements, probabilities and failure information. Keep quote extraction separate and source-bound. Do not add subskill assessment records.
- [x] C5 Define the two conversation-start intents and coach-context contract from the approved user behavior; retain their distinct semantics.
- [x] C6 Decide the runtime owners and data relationships, then specify persistence changes and generated UI contracts from those owners.
- [x] C7 Implement schema/content validators that reject duplicate/unknown IDs, missing required coverage, undeclared inheritance, missing provenance and locale gaps.
- [ ] C8 Add offline inspection outputs for a resolved guide, compact assessor input, start prompt and coach-context preview.
- [ ] C9 Implement the agreed folder map, concise named READMEs and complete templates; update both content loaders, exporters, workbench and all path consumers together.
- [ ] C10 Extract human-readable prompt Markdown by task and keep machine criteria/policy in their declared YAML owners. Validate exact source provenance and reproducible assembly.

Gate: valid sample content, failing fixtures for missing coverage, and inspectable
contract examples. Existing Rust contract generation remains the source of UI types.
Owner areas: `content/`, native configuration, learning and conversations; UI IPC.

### Phase 3 Complete the authored language catalog

- [ ] A1 Author every shared subskill explanation, boundary, example pattern and assessment criterion.
- [x] A2 Generate and inspect all required target-language and variety realizations from the approved matrix, recording AI authorship and provenance.
- [x] A3 Support the declared explanation targets through bundled editions or explicit on-demand translation, with complete interface catalogs and no silent English fallback. Optional bulk translation is follow-up work.
- [ ] A4 Check every example's language/variety, meaning, intended skill and counterexample boundary; record automated checks separately from linguistic review.
- [x] A5 Resolve all required source cells and produce a zero-gap required-coverage report. Optional bundled translations are tracked separately (320 remaining).
- [ ] A6 Establish the finite reauthor/review workflow for a changed shared definition, translation, language realization or source revision.

Gate: all supported coverage complete at the generated baseline, with truthful
review status. Human review can improve that baseline later; missing required
material cannot be deferred into a normal runtime state.

### Phase 4 Implement the single assessment and learning engine

- [x] L1 Implement one Jev operation with ten questions and bounded preceding turns; validate all expected answers and source identity before publication. Subskills remain teaching and targeting content.
- [x] L2 Apply one award per accepted main group per submission; several subskills within a group do not multiply XP. Classify qualifying repeated groups on changed revisions as effort, honor assistance treatment and prevent duplicate publication.
- [ ] L3 Implement the new ledger/projections and enforce one-time publication/credit under retries, restarts and concurrent refreshes.
- [ ] L4 Connect the eight-group catalog to level and reward projections as well as assessment capture. Publication must reject credit outside that same catalog. Keep presentation geometry out of evidence and scoring.
- [ ] L5 Connect sound, animation and haptics to new reward events, respecting learner settings, visibility and reduced motion.
- [ ] L6 Test context-dependent judgments, malformed responses, failure rollback, duplicate publication, partial metadata retention and stale source rejection.
- [ ] L7 Verify observability preserves useful non-content response information on success and failure while redacting credentials and learner content.
- [x] L8 Route partner replies and reply briefs to Fast; test requested/actual model provenance and visible-reply priority with background work queued.
- [x] L9 Implement Automatic/On demand activation, shared pending work, explicit retries and late assessment with one-time credit. Preference changes follow the lifecycle above. Native preferences, capture, scheduling, request/retry and UI controls are implemented and tested. Running-app acceptance remains separate.
- [x] L10 Publish categorical grammar and understandability from the same assessment attempt. No separate grammar, conversation-fit or partner-reaction inference is scheduled.
- [ ] L11 Report full request/state/question sizes and reported usage/cost separately from admission reservations. Keep exact source/request inspection private and source-addressable.
- [x] L12 Remove clean-message effort qualification, awards, active totals and report categories; follow the consumer/ownership table above. Verify no coaching or grammar result can create this award, including retries and restarts.
- [x] L13 Retain partner-understood effort and qualify it from the combined Jev `understandable` choice. Test all other categories, missing/failed results, transaction rollback, late assessment and one-time awards under retries/restarts. No separate inference or skill XP.

Gate: deterministic fixtures and native integration tests establish the new behavior.
Register one assessment owner for the eight groups.

### Phase 5 Implement the language scoped Skills view

- [ ] U1 Add Practice and Skills as destinations off the conversation workspace with the approved icons, labels, shortcuts and Back to conversation; restore draft, scroll and coach thread on return.
- [x] U2 Build group/subskill selection and the chosen progress visualization against real new-model projections, not mockup sample counts.
- [x] U3 Integrate complete shared and language-specific guide content, target-language reading/audio tools and visible authorship/review details.
- [ ] U4 Integrate personal examples with source navigation and correct language, variety and conversation scope; separate them from authored examples.
- [ ] U5 Distinguish no personal evidence, insufficient context, processing and technical failure without implying missing application content.
- [x] U6 Wire contextual Ask the coach and skill-targeted conversation actions from groups, subskills and examples.
- [ ] U7 Verify each skill, practice and evidence action has one coherent destination.
- [ ] U8 Verify narrow layout, RTL, keyboard/focus, long translations, reading/script scale, coarse pointers and reduced motion.
- [x] U9 Add the three optional workspace execution preferences to central Settings and the AI panel using the same native contract; changing one surface updates the other.
- [x] U10 Connect the face and message details to saved understandability, grammar and eight-group results. Expose Not assessed, pending, insufficient evidence and failure without artificial scores. Saved categorical details, probability disclosure, abstention, failure and request/pending presentation are implemented; see the focused running-app checklist in the implementation note.
- [x] U11 Remove Clean from counters, language tables, sorting, totals, details and localized labels; preserve unrelated uses of shared controls/icons.

Gate: component and integration tests exercise complete guide-to-evidence and
guide-to-action flows. Owner areas: app/navigation, Skills, shared reading/learning,
state and their styles. Shared components do not import feature state.

### Phase 6 Implement conversation starts and contextual coaching

- [x] F1 Add phrase starts to whole bubbles, whole-word selections and authored guide examples. Reading popups intentionally have no phrase action. Preserve exact source text and captured language scope.
- [x] F2 Create the new conversation with the intended persona and seed; guard duplicate clicks and stale source/persona selection.
- [x] F3 Compose and validate the phrase-containing first partner message under the approved inclusion policy, with visible failure and explicit retry/cancel behavior.
- [x] F4 Implement skill-targeted starts that elicit learner use, expose the chosen target, and honor the agreed duration, topic and difficulty behavior.
- [ ] F5 Implement coach context attachment, visible scope and history ownership for guides, authored examples and personal evidence.
- [ ] F6 Verify coach content cannot become partner-chat history or automatic learner evidence, and source text cannot override instruction ownership.
- [ ] F7 Test empty/long selections, multilingual text, quotations, repeated starts, language/persona changes, provider failures, restarts and canceled openings.

Gate: native plus UI integration tests prove each action reaches a new conversation
or correctly contextualized coach exchange. No paid live evaluation is claimed by
fixture tests; live test usage is a separately identified verification activity.

### Phase 7 Complete application integration

- [ ] R1 Audit all callers of the catalog, assessment and XP contracts.
- [x] R2 Register one eight-group assessment path through capture, dispatch and publication.
- [x] R3 Align native/UI projections, generated exports, commands, styles and localization with the eight-group contract.
- [ ] R4 Implement the learning-owned workspace schema and initialization with explicit transaction boundaries.
- [ ] R5 Test repeated startup, one-time credit and protection of unrelated data owners.
- [ ] R6 Test fresh-workspace behavior and rollback on initialization or publication failure.
- [x] R6a Review persisted settings/result changes against the workspace format contract. Where incompatible, specify a consecutive migration, ownership treatment and recovery/rollback tests before writing persistence code; never substitute a development reset.
- [ ] R7 Verify all assessment entry points use the same eight group identities and policy.
- [ ] R8 Ensure maintained guides describe the implemented system directly.

Gate: one assessment owner, complete authored coverage and consistent contracts
across native code, UI and content.

### Phase 8 Verify the integrated application

- [ ] V1 Run the final fast gate, affected regression tests, full UI suite, production build and preview checks.
- [ ] V2 Run native Clippy/tests, generated-contract checks and language/content checks; run affected server checks only if server behavior changed.
- [ ] V3 Validate documentation links, bibliography citations and the completed authoring matrix.
- [ ] V4 Inspect hosted CI for every relevant job on the actual candidate commit, including jobs skipped behind earlier failures.
- [ ] V5 In the real app, navigate Chat/Practice/Skills across languages and varieties; inspect complete guides and source-correct personal evidence.
- [ ] V6 Start from a phrase, confirm the first partner message includes it as promised, then start from a skill and confirm the partner elicits learner use.
- [ ] V7 Ask the coach from each entry point; switch skills/languages and verify context, conversation history and source boundaries.
- [ ] V8 Verify new credit/reward behavior, restart recovery, sound/haptics, disabled effects, backgrounding and reduced motion on intended devices.
- [ ] V9 Record local automated results, real-app results, hosted CI and remaining issues separately; obtain explicit release/deployment authorization before publishing.

Gate: no unresolved required content, duplicated assessment paths or unverified
core flows. Mark the design implemented only after the corresponding tasks pass;
do not mark live-app checks complete from screenshots or fixture previews.

## Planning checkpoint and work order

No application code changes until the user explicitly authorizes implementation.
Folder ownership, model roles, the combined assessment and execution defaults are
agreed. Finish C1–C3 and D8 as concrete content-field, coverage and ownership tables
before bulk authoring or persistence changes. Phrase-seeding and target-duration
decisions block their own start flows, not the assessment/content work packet.

Implement and verify these authorized packets in order:

1. C9–C10: content organization, templates, prompt extraction and loader/tooling checks.
2. C4/C8: complete ten-question request/response contract and offline inspection.
3. L1–L7/L10/L12–L13 and R1–R7: eight-group publication, projections, effort qualification, ownership and recovery.
4. L8–L9/L11 and U9–U11: routing, activation, diagnostics and assessment disclosure.
5. A1–A6 and U1–U8: complete language coverage and Skills integration.
6. W5–W7/F1–F7: explicitly specified start flows and coach attachments.
7. V1–V9: integrated verification, then specific running-app checks for the user.

Each packet reports source implementation, automated checks and remaining real-app
checks separately. The checklist is not proof of implementation. No commits,
release changes, paid experiments or deployments are authorized by this plan.

## Verification record

### Content and request foundation — 2026-10-03

Implemented: authoring validation and offline request inspection.
Eight-group catalog integration and persisted learning changes are incomplete.
Runtime assessment uses the correct-use instructions in
`content/prompts/skills/demonstration.yaml`; the registry has one instruction owner.

- `content/shared/communication.yaml` defines eight assessed groups and 42
  teaching subskills. Subskills have no scoring fields. Native validation rejects
  ambiguous identities, broken neighbor references and missing provenance.
- `content/communication/spanish/english.yaml` is the first complete
  language/explanation specimen: all eight groups, 42 teaching sections, and
  explicit Mexico/Spain assessment supplements. It is generated content marked
  `needs_review`, not a claim of expert linguistic validation. Its cited sources
  support selected constructions, not an exhaustive review of every example.
- Compact assessment prose is authored separately from learner-facing prose in
  the same guide. The request projection inserts the compact core and selected
  variety supplement; it does not summarize guides online or substitute an
  English-language grammar default.
- `content/prompts/skills/demonstration.yaml` contains the revised Choice
  criteria. Each question names the skill, defines its boundary and includes the
  authored language guidance. The complete question belongs in instructions;
  state retains the source message and preceding exchange. This follows
  [@typesafePrimitives2026] and [@typesafeState2026]. Runtime capture and offline inspection use the same correct-use instructions. Eight-group catalog wiring remains an open integration task.
- The authoring report enumerates every configured target/explanation-language
  pair. These are language choices, distinct from the seven interface locales.
  Every supplied group requires all of that language's varieties and subskill
  sections. `--communication-ready` fails while any required pair is incomplete.
  No normal runtime missing-guide state or implicit explanation fallback is added.
- `inspect-content --communication-request <language> <variety> <explanation>`
  reads state JSON from stdin and prints the assembled eight-question request.
  It performs no provider call, stores no learner record and awards no XP.
  `--communication`, `--communication-coverage`, and `--communication-ready`
  inspect the catalog, authoring gaps and content completeness respectively.

Still required: the remaining authored languages/explanations and UI translations,
multilingual contrast fixtures, runtime capture/publication, learning persistence,
the Skills view, targeted starts and coach context. Native-app readiness is unverified.

Reviewable exports from the native inspector:

- [Time and events in Spanish](eight-group-learning/time-and-events-spanish.md),
  including Past events, the learner guide and assembled assessment instructions.
- [Coordinating action in Spanish](eight-group-learning/coordinating-action-spanish.md),
  including Requests.
- [Managing conversation in Spanish](eight-group-learning/managing-conversation-spanish.md),
  including Asking for clarification.
- [Actual eight-question request](eight-group-learning/spanish-request.json),
  assembled from a synthetic learner reply and preceding question. This was not
  sent to a provider; it is not evidence of assessment quality.

Verification:

- Native library tests: 783 passed, five ignored, zero failures.
- Native Clippy with warnings denied and the inspector binary build: passed.
- Fast checks and documentation links: passed.
- Hosted request admission tests: 36 passed using the server virtual environment.
  Pytest reported an unwritable optional cache; test execution completed.
- Inspector execution: eight question IDs and authored Spanish guidance verified.
- Content coverage: two complete target/explanation pairs out of 400. The readiness
  check reports `incomplete_communication`; 398 pairs require authoring.
- Native-app behavior and provider assessment quality remain unverified.

Assessment verification scope:

- Eight-group fixtures exercise native dispatch, authored guidance, response
  validation and credit transactions. A direct/contextual answer must meet the
  0.6 combined-probability threshold. An unclear answer does not qualify even
  when its positive probability is high. Full returned probabilities are retained.
- Subskill response IDs fail validation. Repeated publication is idempotent;
  qualifying changed revisions earn effort once per group, and unchanged replies
  earn no additional credit. Credit records survive workspace reopening.
- These fixtures supply the eight-group capture explicitly. They do not establish
  complete runtime catalog, level, reward or UI integration. L1 and L4 remain open.
- Native dispatch generates the hosted request fixtures. Server admission must
  preserve these requests without owning their assessment or XP policy.

### Localized guide content

Implemented:

- Required group titles and introductions, plus subskill titles and conceptual
  explanations, belong to the selected explanation-language document.
- Inspection uses these authored headings. Missing or blank fields fail validation;
  editorial catalog labels do not fill them.
- Spanish-target content covers both English and Spanish explanation languages,
  with eight groups, 42 subskills and explicit Spain/Mexico guidance in each.
  Examples retain their target text. Assessment guidance is separately authored;
  changing the explanation language does not change its assessment policy.
- Generated authorship and `needs_review` remain explicit. Translation validation
  establishes structural completeness and source-text preservation, not linguistic
  quality. Complete catalog, levels, rewards and UI integration remain open.

Verification: 786 native tests passed, five ignored; Clippy with warnings denied,
the fast gate, documentation links and 28 documentation content tests passed.
Schema output was regenerated from Rust and checked by the native suite.
