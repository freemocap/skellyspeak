---
title: Learner, contacts, and language architecture plan
sidebar_position: 7.1
---

# Learner, contacts, and language architecture plan

Discussion plan, September 9, 2026. **Proposed architecture, not shipped behavior.**
Implementation begins after the user finishes and pushes the current work and we
reinspect that baseline. This document is the consolidated planning source for
the redesign; [Architecture](./architecture) and [Ontology](./ontology) continue
to describe the implementation. Visual design will be developed during the work.

## Direction agreed in discussion

The app centers on a learner developing abilities in multiple languages through
ongoing relationships with conversation partners. Conversations produce reusable
language annotations and inspectable learning evidence. Language profiles and
relationship gardens offer different views of that evidence.

- Give each learner–language relationship persistent preferences, practice goals,
  experience, skill evidence and proficiency estimates.
- Keep selected difficulty, estimated proficiency and experience distinct.
- Promote conversation partners into durable contacts with multiple conversations.
- Separate persona templates, established character facts and relationship memories.
- Give partners static, mathematically generated abstract avatars, with both seeded
  random generation and manual configuration. Never use faces, humanoids or AI images.
- Add editable persona Vibe emoji groups and separately recorded conversation Vibe
  observations. Keep all generated partner/coach prose emoji-free; render emojis
  only in explicit metadata UI. Expand emotional reactions without conflating them
  with comprehension, content tags or proficiency.
- Represent each relationship as a garden, with one independently growing flower
  per conversation. Prefer rounded petals and recursive branching foliage; the
  seven petals represent the existing meaning domains. Language progress aggregates
  across conversations and contacts.
- Unify language analysis, validation, caching and result reuse across all surfaces.
- Evaluate cheaper models for annotation independently of conversation and coaching.
- Support language-specific reference resources and future language expansion.
- Complete each migration boundary, including removal of its obsolete implementation.

## Ownership and entities

| Entity | Owns |
| --- | --- |
| Learner | Stable identity, global preferences and language profiles; distinct from hosted login |
| Language profile | Language-scoped difficulty, assistance/reading preferences, goals, focus, evidence projections and proficiency history |
| Persona template | Starting material for creating a partner; later edits do not rewrite contacts |
| Conversation partner | Stable identity, name, language/variety, background facts, conversational tendencies, avatar recipe and authored Vibe groups |
| Relationship | Learner/contact association, shared memories, conversations and garden projection |
| Conversation | Explicit learner, relationship and language context; ordered source messages and its own flower projection |
| Annotated passage | Exact source text, offsets, translation, contextual token aids and provenance |
| Learning evidence | Source revision, learner, language/variety, contact, rubric, judgment, assistance, modality and timestamp |
| Proficiency assessment | Evidence references, descriptor/rubric versions, scoped estimate, uncertainty and rationale |
| Avatar recipe | Generator/version, stable seed, palette, geometry and manual parameter choices |
| Vibe observation | Source message/revision and author, literal or associative tag groups, provenance and extractor/registry version |
| Partner reaction | Comprehension status and separately expressed emotional response, with source-grounded rationale |

Rust owns durable data, provider routing, prompts, cache resolution, validation,
progression and migrations. React owns presentation and transient interaction
state. A shared frontend store receives backend snapshots and scoped events through
one integration layer. Components use selectors rather than independent fetch and
invalidation conventions. The hosted service retains authentication, validation,
metering and proxy responsibilities.

Recommended frontend choice: Zustand, using explicit actions and selectors. Do not
add a second frontend persistence authority for Rust-owned data. Local disclosure,
hover and draft state need not become global. Final storage choice is pending;
SQLite is the leading candidate for indexed evidence, relationships and caches.

All asynchronous results must carry ownership and revision context. Switching
language/contact/conversation cannot apply old results to a new scope. Establish
a snapshot/event revision protocol that cannot lose updates during initial load.

## Language profiles and progression

Aggregate language evidence across contacts and explanation languages. Preserve
variety on evidence without splitting ordinary dialect changes into unrelated
language careers. Define canonical language IDs before implementing this change;
registry additions must not silently merge previously distinct profiles.

Practice difficulty is a learner choice. Estimated proficiency is an evidence-based
judgment. XP and milestones follow explicit deterministic product rules. No direct
XP-to-CEFR conversion is implied. Preserve the distinction between assisted practice
and independent demonstrations, and retain source lineage to avoid duplicate awards.

The report card explains strengths, gaps and suggested practice with inspectable
source examples. Unobserved abilities remain unobserved. Estimates may differ by
activity and modality; transcripts alone do not establish listening or pronunciation.
The seven meaning domains organize practice but are not a CEFR conversion formula.
Use Pre-A1 through C2 descriptors for the CEFR-facing view, with scope and uncertainty.
See the [CEFR Companion Volume](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4)
and the existing [meaning-domain design](./skill-progression-design).

Retain assessment snapshots with evidence and evaluator versions so changes are
explainable. Derive current projections from eligible evidence. Reuse existing
assessments and synthesize proficiency only when sufficient new evidence warrants
it; opening a report card must not trigger fresh model analysis.

## Contacts, backgrounds and conversation gardens

A contact survives individual conversations. Its stable facts are separate from
flexible tendencies and from facts shared with this learner. Prompt background
facts as latent context: do not volunteer them to establish personality or redirect
the exchange; use only relevant details when the learner asks or directly raises
the subject. An interest is not a recurring topic obligation.

Relationship memory records established shared history with source references.
Private coach judgments and questions are not automatically partner memories.
Memory extraction must distinguish learner statements, character facts and model
inferences; generated summaries cannot silently redefine established identity.

The selected visual direction is a garden for each contact relationship, with
one rounded flower for each persistent conversation. Returning to a conversation
develops the same flower; a new conversation adds another. Each retains its own
growth, domain evidence and deterministic branching pattern. Relationship and
language summaries aggregate the underlying evidence, not the rendered geometry.

Render flowers procedurally with web-native graphics such as SVG; AI-generated
images are not an implementation option. Recursive stalk/leaf branching expresses
conversation growth, while the seven main petals remain distinct. A third-party
rendering library is optional only if demonstrated needs justify it.

| Flower feature | Intended meaning |
| --- | --- |
| Stalk height/thickness | Accumulated volume within this conversation |
| Recursive leaves/branches | Additional exchanges and sessions within this conversation |
| Seven petals | Existing seven meaning domains |
| Petal size | Practice in that domain within this conversation |
| Petal fullness/vibrancy | Repeated demonstrated use within this conversation, distinguishing assistance |

These are proposed visual mappings, not calibrated scoring formulas. Relationship
activity may grow through repetition while language mastery does not receive
duplicate credit. Use the same source evidence for both projections rather than
independent AI-generated scores. Bound visual growth for long histories and provide
textual equivalents, reduced-motion behavior and non-color-only distinctions.

Recommended default: no wilting because of absence. Recency, if displayed, is a
separate signal. Persist source records and versioned projection rules; preserve
a stable visual seed if needed. Deletion and lifetime-growth semantics remain open.

### Garden panel interaction direction

Show conversations as a sortable grid with short, two-to-three-word evolving
titles. Support age, recent activity, growth/height and a selected skill as sort
criteria, with a plus action for a new conversation. Returning to an older
conversation retains its flower. Title updates reuse captured conversation analysis;
they must not change the conversation ID or independently regenerate on view mount.

Selecting a conversation focuses its flower, a brief assessment and the supporting
coach-advice, petal-details and commentary panels. Hovering a petal enlarges it and
shows its domain name; clicking reveals that conversation's evidence, explanation
and next practice suggestion. Provide equivalent labeled touch/keyboard actions,
focus return and reduced-motion behavior. These remain design prototypes rather
than shipped navigation.

## Static procedural avatars

The accepted family is abstract composable shapes and colors, including mosaic,
contour and ribbon studies. Pattern identity belongs to the partner, not the chat,
language difficulty, proficiency or temporary mood. Do not infer colors or motifs
from nationality, gender or other demographic labels.

Define a versioned recipe: generator ID/version, integer seed, explicit palette,
geometry parameters and outline. Randomize by choosing valid parameters and saving
the concrete result; manual editing operates on that same recipe. Reroll only on
explicit action. Editing a name or opening a conversation cannot change the image.
Reopening or resizing reproduces the composition; revisions deliberately preserve
or migrate existing recipes. Pixel-identical GPU output across devices is not assumed.

Shader-style math fits this architecture: signed-distance shapes, repeated tiles,
warped contours and combinations of waves/noise can describe static patterns.
Expose understandable controls such as palette, scale, curvature, rotation and
pattern density. Keep readable, versioned generator code; compact shader contests
are aesthetic inspiration, not a reason to ship inscrutable one-line programs.

SVG is sufficient for current geometric studies. Evaluate a bounded WebGL/GLSL
renderer only for patterns that benefit from it; no third-party package is selected
yet. Render a frame on recipe/size changes and reuse it. No time uniform, animation
loop, pointer-driven motion or continuously active GPU per contact. A shader-rendered
thumbnail is a deterministic rendering cache, not an AI-generated asset. Check 24/40px
legibility, larger profile sizes, device pixel ratios, cache lifecycle and supported
Tauri/mobile webviews before adopting a renderer. See [Khronos WebGL](https://www.khronos.org/webgl/).

## Vibe, reactions and descriptive statistics

Vibe is a playful visual interpretation of content, expressed as emoji groupings.
It can be literal (a car or beach) or associative (a cluster evoking a quiet journey).
It is not a correctness score, proficiency judgment or diagnosis of the learner.

### Separate authored, observed and reactive information

- **Persona Vibe:** editable ordered emoji groups chosen by the user or proposed
  during character creation, then saved as explicit persona configuration. Allow
  selection/paste and randomization. Groups can remain abstract; optionally attach
  a user-written meaning, but do not require a universal semantic interpretation.
  They influence the partner as soft context without overriding stable facts,
  explicit user direction or the no-emoji prose rule.
- **Observed Vibe:** tags extracted from actual source messages, attributed to the
  speaker. Preserve literal versus associative provenance, source references and
  short explanations. Authored persona emojis do not count as observed occurrences
  and observations do not silently rewrite the persona's configured Vibe.
- **Partner reaction:** maintain comprehension separately from emotional tone.
  Confusion cannot be hidden by an amused, warm or curious response. Expand the
  emotional vocabulary through a reviewed set (for example amused, enthusiastic,
  reflective, sympathetic or skeptical) while preserving fallible interpretation
  and clarification explanations. These are character responses, not measured
  human feelings or claims about the learner's internal state.

### Enforce the prose boundary

Partner replies, coach replies, generated suggestions and explanatory prose must
not contain emojis. Prompts express the rule, but do not guarantee compliance.
Enforce it centrally before generated prose is displayed or persisted as accepted
output, including boundary-aware handling of streamed Unicode sequences. Invalid
output follows bounded corrective retry/error behavior; do not silently strip
characters, corrupt source text or briefly display prohibited output before cleanup.

Keep emoji-bearing data in explicit metadata fields, preferably validated emoji/tag
IDs rendered through a shared registry. Explanations remain prose without emojis.
Preserve learner-authored messages exactly; the generation restriction does not
rewrite what the learner typed. Define exact handling of quoted learner emojis in
generated replies and ambiguous text-presentation symbols in the output contract.
Use versioned Unicode emoji sequence data rather than a broad range regex that
misclassifies ordinary digits or breaks joined emoji sequences. See
[Unicode Emoji](https://www.unicode.org/reports/tr51/).

### Extract once and aggregate locally

Reuse the shared annotation service's concepts, dictionary results and cached
interpretations for literal mappings. Context still matters: a word mention is not
proof an event happened, and multiword/negated/ambiguous uses need their source.
Let model analysis propose bounded associative groups when useful, preferably within
an existing structured pass with explicit per-message attribution. Do not add a full
independent model call per emoji or on opening a statistics view. Keep partner
self-report and content annotation separate contracts even if their scheduling is
shared. Cache validated extraction by source context and extractor versions.

Store observations once, referencing learner, contact, relationship, conversation,
message/revision, author, actual content language(s), time and provenance. Target
language alone does not identify the language of mixed-language source text.
Use one canonical concept/emoji registry across languages, retain the original
ordered group, and normalize aliases/presentation variants explicitly. Counts of
individual tags, ordered groups and unordered co-occurring pairs are different
statistics and must be labeled accordingly.

Provide local projections for a conversation, a relationship/contact, a language
and the learner's overall usage. Include emoji distributions, common groups/pairs,
changes over time and related source examples in a separate statistics/XP view,
alongside conventional participation and practice counts. Distinguish learner
content, partner content and private coach content; private coach observations
must not enter partner memory. No extra cloud telemetry is implied.

Recommended default: count each tag at most once per eligible source message;
compute pair co-occurrence at most once per message. Retries, remounts and multiple
renderings never create extra occurrences. Show the denominator and extraction
coverage when presenting rates. Revisions supersede old observations; deletions
and exclusions follow explicit retention rules. Emoji renderer/version changes
cannot silently reinterpret historical counts. Vibe does not award skill XP or
change flower proficiency petals. Any optional avatar/Vibe mapping is an explicit
user action that saves a new static recipe, not ongoing automatic visual drift.

## Shared language service and AI policy

All reading surfaces consume one annotated-passage contract. Reuse existing partner
translations and annotations in coach advice; suggestions become reusable passages.
Separate short contextual annotation from explicitly requested deep word explanation.
Standardize source coverage, offsets, field requirements and semantic validation
across guided analysis, reading preparation and benchmark fixtures.

Resolution order:

1. Reuse valid annotations already attached to the exact passage.
2. Consult shared Rust memory/durable contextual caches and deduplicate active work.
3. Resolve candidate forms, senses and readings from indexed local resources.
4. Batch unresolved or ambiguous spans with their sentence context for model analysis.
5. Validate, record provenance and publish the result to all consumers.

Segmentation, lexical candidates and contextual interpretation are separate tasks.
Dictionary senses are not universal contextual answers. Keep generated interpretations
distinct from sourced lexical facts. Cache identity includes semantic context,
language/variety, explanation language, operation and relevant prompt/schema/model/
resource versions. Preserve meaningful case, accents and source text. Cache hits
and local resolution remain visible in traces; failures are not empty answers.
Bound cache storage and support eviction, reset and version invalidation.

Use operation-specific model policies for annotation, conversation and pedagogical
reasoning. Preserve hosted allowlists and custom-server model naming. Do not cache
all generative operations indiscriminately or defeat intentional regeneration.

Benchmark the baseline, smaller models with the same contract, and local resources
plus batched unresolved spans. Use reviewed multilingual examples including ambiguous
senses, names, morphology, mixed-language errors, dialects, segmentation and readings.
Measure source preservation, linguistic quality, retries, p50/p95 latency, actual
cost per successful passage and cache/local-resolution hit rates. Set acceptance
thresholds from a reviewed baseline before selecting a model; valid JSON is insufficient.

Candidate resources: [Kaikki](https://kaikki.org/),
[CC-CEDICT](https://cc-cedict.org/editor/editor.php?handler=Download),
[CAMeL Tools](https://camel-tools.readthedocs.io/),
[UniMorph](https://unimorph.github.io/) and
[Universal Dependencies](https://universaldependencies.org/).
Assess exact dataset licenses, editions, gloss languages, dialect coverage and
packaging before adoption. Openly licensed does not mean public domain. Prefer
structured lookup and curated grammar entries to sending whole books to models.

Language capabilities must separately describe conversation, annotation, resources,
speech input/output and UI localization. Unsupported capabilities must be explicit.
Start resource evaluation with Spanish, then test Arabic and Mandarin constraints;
existing English/French support remains in the quality matrix. Additional languages
and aesthetic redesign are subsequent work, not prerequisites for the core migration.

## Decisions to settle before affected implementation

| Decision | Recommended starting position | Needed before |
| --- | --- | --- |
| Existing user data | Preserve with a verified one-time migration and recoverable backup; no destructive clean start by default | Persistence cutover |
| Learner identity scope | One explicit local learner initially; keep hosted account identity separate; defer switching/sync | Schema approval |
| Canonical language and preference scope | One profile per language, variety-tagged evidence, language overrides for assistance/difficulty; explicit conversation overrides | Profile schema |
| Automatic difficulty | Recommendations only initially; learner keeps control | Profile/prompt integration |
| Flower volume and repetition | Count substantive learner participation; assistance can grow practice; no automatic wilting; calibrate growth curves | Flower projection |
| Deletion and historical growth | Retained eligible evidence drives current scores; decide whether any separate lifetime participation record survives deletion | Retention schema |
| Contact identity edits and memory | Version identity changes, preserve historical context, offer inspectable/correctable shared memories | Contact cutover |
| Avatar renderer and editable parameters | Seeded static SVG first; benchmark shader recipes before adding WebGL; user-controlled randomization and edits | Avatar implementation |
| Vibe registry and output boundary | Separate authored/observed/reaction records; define Unicode handling, group limits and literal/associative provenance | Vibe contract |
| Descriptive statistics | Once-per-message counts with explicit author/language scopes, denominators and deletion behavior | Vibe/statistics persistence |
| Uncharacterized conversations | Preserve existing no-persona conversations explicitly; decide their place in contact navigation | Contact UX |
| State and storage tools | Zustand frontend; evaluate SQLite for durable indexed domain data and separate bounded caches | Technical design |
| Resource packaging | Optional language packs; choose a starter pack only after size/offline requirements are agreed | Resource integration |
| Quality and performance budgets | Approve reviewed multilingual gates and measured budgets; no unmeasured percentage promises | Model/resource selection |

Exact flower aesthetics, character creator layout and animation can be decided
through prototypes during implementation. They must not determine evidence ownership.

## Execution sequence and exit gates

### 0. Freeze the baseline and approve contracts

After the user's update, reinspect implementation and repository instructions.
Inventory authoritative stores, IPC, event subscriptions, prompts, caches, UI
consumers and tests. Capture baseline behavior and representative multilingual
fixtures. Settle schema-blocking decisions above. Record every retiring path and
its replacement in a migration checklist. The user performs all Git writes.

### 1. Establish learner and language ownership

Implement versioned entities, scoped preferences and migration. Replace global
difficulty storage and pair-scoped ownership where the new model requires it.
Introduce shared frontend state and the backend snapshot/event bridge. Migrate
all affected readers/writers together. Gate: switching languages restores each
profile's choices; changing explanation language or dialect cannot lose progress;
late events and concurrent saves cannot cross ownership boundaries.

### 2. Establish durable contacts and relationships

Migrate saved partners without inventing missing identity or merging similar names.
Replace template-per-chat selection as the contact ownership mechanism. Implement
contact navigation, multiple conversations, latent backgrounds and scoped shared
memory. Include saved static avatar recipes and editable persona Vibe groups.
Gate: continuity survives restart and template edits; avatars remain static and
recognizable; coach privacy and
historical identity remain intact; every old chat has an explicit destination.

### 3. Consolidate language work end to end

Implement shared passages, validators, durable contextual caching and active-request
deduplication. Move every reading surface onto that service and remove duplicate
translation/annotation generation and feature-owned request caches. Gate: the same
passage yields consistent aids across chat, coach and lessons; opening another
surface reuses completed work; restart, invalidation and provider failures behave
correctly. Reflect local/cache resolutions in the operation graph and tracing.
Enforce the shared emoji-free prose boundary and validate source-attributed Vibe
metadata separately; exercise split Unicode sequences and preserve learner input.

### 4. Build evidence-backed profiles and flowers

Implement relationship and language projections, proficiency history and inspectable
report cards. Reuse the seven domains. Gate: evidence attribution, assistance,
repetition, edits, exclusions and deletion obey the approved rules in both views;
flower growth is stable and accessible; estimates show their actual evidence scope.
Add descriptive Vibe distributions and expanded partner-reaction views with explicit
provenance and coverage. Gate: aggregate counts reconcile to unique source messages
across conversation/contact/language/learner views without changing XP or proficiency.

### 5. Optimize and extend

Benchmark independent annotation routing, integrate the first licensed language pack,
and batch unresolved work. Gate: approved linguistic/performance budgets pass on
the supported-language matrix. Expand language capabilities only with corresponding
tests and honest support declarations.

These are complete vertical migrations, not indefinite parallel architectures.
A temporary adapter may exist only inside an unfinished migration with an explicit
removal gate; it must not become a shipped permanent compatibility layer.

## Definition of a clean cutover

- One authoritative writer and contract per concept; all consumers migrated.
- Obsolete IPC, stores, hooks, prompts, schemas, caches, CSS and tests removed or
  rewritten to test the replacement behavior. Search the full repository for old
  identifiers and verify remaining historical references are intentionally labeled.
- Import old data once; no dual writes or normal-operation reads of legacy schemas.
  Verify counts, source references and identity ownership before marking migration
  complete. Test interruption/restart and recoverability. Fail on invalid states.
- Keep necessary migration code isolated and versioned; data preservation does not
  justify retaining a second runtime architecture. Never infer identity or historical
  proficiency that the source data cannot establish.
- Run relevant repository checks and stop on failure: frontend tests/build, Rust
  clippy/tests, hosted tests when contracts change, and docs build. Test real Tauri
  integration and applicable native-device behavior separately; unit tests do not
  establish microphone, speech, signing or live-cloud results.
- Verify language/contact switching during active work, refresh races, restart,
  migration, cache invalidation, data deletion and factory reset with meaningful
  integration fixtures. Avoid implementation-mirroring tests.
- Update current architecture/ontology and the nearest public behavior docs in the
  same phase; update privacy/hosted docs when retention or routing changes. Remove
  completed roadmap items. Retire this plan when implementation docs fully replace it.

No application behavior is changed by this planning task. Existing uncommitted work
is outside the migration until the baseline is ready.
