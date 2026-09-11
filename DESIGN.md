# SkellySpeak design brief

Status: approved product direction with implementation proceeding by build phase.
Tauri, React and Rust provide the local foundation; SQLite and typed Rust/TypeScript
contracts are selected. See [README.md](./README.md) for verified current behavior
and [architecture.md](./architecture.md) for implementation authority. Conversation
graph execution and desktop hosted/own-key access are implemented; learning analysis
remains planned. Native and live verification limits are explicit in README.md.

[DATA-MODEL.md](./DATA-MODEL.md) develops the first technical proposal: record
ownership, source references, computed reports and deletion behavior. Its proposed
mechanisms are separate from the agreed product intent in this document.

[EXECUTION.md](./EXECUTION.md) and [AI-STRATEGY.md](./AI-STRATEGY.md) jointly propose
operation execution, provider routes, model selection and context boundaries.
Their status notes distinguish implemented contracts from broader planned operations.

[STATE-AND-STORAGE.md](./STATE-AND-STORAGE.md) proposes persistence authority,
transaction boundaries, scoped frontend hydration and the typed application boundary.

## Purpose

Make language practice welcoming enough to return to and useful enough to build
real ability. The learner chooses what to talk about, receives benevolent help,
notices what they can do and finds an inviting next step. Beauty and play support
that experience. They should not create pressure to perform, maintain a streak
or satisfy a simulated person's emotional needs.

## Agreed product intent

- A learner can practise multiple languages. Each language has its own progress
  and evidence of ability, aggregated across relevant conversations.
- Conversation partners are durable contacts. A partner can participate in
  multiple persistent conversations with the learner.
- Selected practice difficulty belongs to the persistent conversation. It is a
  request about how to communicate, separate from estimated proficiency and XP.
- Partners can have identities, tendencies and background facts. Background facts
  stay unobtrusive and arise when relevant or asked about. Private coaching must
  not become something the partner knows.
- The garden view represents a relationship, with one flower per conversation and rounded
  petals and mathematically generated branching foliage. Seven petals represent
  the seven language-practice domains. Define their evidence and growth rules
  before treating the visualization as a score.
- The garden is an aesthetic view of relationship and conversation data, not a
  domain entity or storage requirement. Alternative visualizations must use the
  same source records and view-independent metrics. Renderer-specific seeds,
  geometry and styling belong to presentation configuration.
- Partners have static abstract procedural avatars. Seeded generation and manual
  configuration use explicit mathematical parameters. No faces, humanoids,
  AI-generated images or animated avatar patterns.
- Vibe uses emoji groups as playful metadata. Authored persona Vibe, observed
  message Vibe and partner reactions are distinct. Generated conversational and
  coaching prose contains no emojis; the learner's text remains their own.
- Evaluate geometric Vibe extraction: encode text in a shared embedding space and
  rank a precomputed emoji reference table by similarity. This is a candidate for
  avoiding a generative LLM call per observation. Model choice, multilingual
  quality, long-text aggregation and similarity calibration remain to be evaluated.
- Assistance should behave consistently wherever language appears. Reuse useful
  analysis. Evaluate local resources and model choices against linguistic quality,
  latency and cost rather than assuming every interaction needs a model call.
- The application starts from empty data, with one coherent implementation and no
  compatibility or import obligations.

## Agreed ownership and control

| Concept | Owns |
| --- | --- |
| Learner | Personal identity and personal preferences |
| Language profile | Practice evidence, XP and proficiency estimates across conversations in that language |
| Conversation partner | Character identity, background, conversational tendencies, avatar and authored Vibe |
| Relationship | Relevant shared memories, familiarity and the association of conversations with that partner |
| Conversation | Messages, difficulty, practice choices and analysis; displayed as a flower in the garden view |

## Language extensibility

The initial Spanish, French, Arabic and Mandarin practice set exercises differing
scripts, reading directions and segmentation needs; it is not the product's language
limit. English is also present in the current registry. The intended architecture
supports a much larger language catalog through declarative language configuration
consumed by shared prompt construction and linguistic analysis code. Adding a
language should ordinarily mean defining its relevant properties, not creating a
separate pipeline or duplicating prompts for that language.

Language and AI Operations jointly own a finite configuration design review before
the next reading-assistance slice. Candidate properties include stable identity,
variety, script/direction, segmentation conventions, romanization and explanatory
linguistic guidance. Exact schema and authoring interface remain design work.
Review the reference GCP/SkellySubs and Python language configurations for useful
principles; adoption is intentional and does not make reference code authoritative.

Registering a language is separate from establishing quality for a model/task or
speech provider. Performance may vary substantially; speaker population alone does
not establish expected quality. Configuration must not imply tested support, choose
a hidden fallback or weaken source validation. Task/model/language evaluation remains
explicit. This extensibility does not change single-language conversation ownership.

## Partner creation and language scope

Provide a one-button way to create a randomized partner for the chosen target
language. An optional character editor lets the learner select or edit character
attributes. Creating a character manually is not a prerequisite for conversation.
The exact editor controls and layout can be developed during visual design.

Each partner has one target language; simultaneous multilingual partners are out
of scope. Every conversation has a fixed target language. Conversations are never
converted, translated wholesale or reassigned to another language's progress.
Changing a partner's language is not required for the initial scope. If offered,
it must affect only newly created conversations; saved conversations retain their
own target language. The control itself can be deferred without blocking design.

The learner can use their explanation/native language inside a target-language
message to request expression help. For example, in a Spanish conversation,
“Quiero ir a la tienda para … buy some bread” asks for help expressing “buy some
bread” in Spanish. Supply that help in context and continue the Spanish conversation;
do not switch its target language or create a second language-learning thread.
Assistance and supplied wording must remain distinguishable from the learner's
own demonstrated target-language ability. Handling ambiguous names, quotations and
fragments is a quality/evaluation detail, not a separate multilingual product mode.

Use the agreed shared-memory and coach-privacy boundaries. Elaborate familiarity
stages, simulated relationship dynamics and additional memory complexity are not
prerequisites for the initial design.

## Conversation continuity

A conversation is a freely evolving, resumable thread. Topic changes and time away
do not create another flower. Its short descriptive title follows its content
without restricting the subject. Creating another conversation is an explicit
learner action.

Relevant shared memories can inform any conversation within the relationship.
They should arise naturally, not be repeatedly announced. Partner identity remains
consistent across threads. Private coaching and assessments are not shared memories
available to the partner.

A new conversation offers that partner's most recently used practice settings as
an editable starting point. Once created, it owns its settings independently.
Difficulty is never a language-profile setting. Preference categories are defined
below; exact values and first-conversation defaults still need definition.

The learner controls difficulty, assistance, conversation creation/deletion,
partner configuration and authored Vibe. The system can update descriptive titles,
observed Vibe, evidence-based assessments and flower growth, with explanations
available. Coaching recommendations do not change practice settings without the
learner choosing to apply them. Choices and observations remain separate.

Shared memories are inspectable, correctable and removable. Removing a memory
prevents it from being supplied as relationship context; managing its source
conversation is a separate action. Automatic extraction must not simply recreate
a removed memory; define the suppression mechanism before implementation.

Editing partner identity edits that contact. Creating another partner is a separate
explicit action; an identity edit does not automatically create another person.

## Agreed meaning of progress

| Measure | Meaning | Presentation |
| --- | --- | --- |
| Participation | Time and meaningful contributions invested in a conversation | Stalk and foliage growth |
| Practice | Language skills exercised, including with assistance | Seven petals showing practice across the domains |
| Demonstrated ability | What learner messages support saying about proficiency, with uncertainty | Language report card with examples across conversations |

Assisted practice contributes to flower growth. Mistakes do not damage the flower,
and time away does not make it wilt. A flourishing flower represents valuable
practice at any difficulty; it does not imply advanced proficiency.

The report card explains demonstrated ability separately from participation and
practice. Exact participation measurements, repetition handling, XP rules, growth
curves and assessment criteria remain design questions. These quantities must not
be silently converted into one another.

## Agreed learner journey and onboarding

The home screen centers on contacts and their gardens, with language progress
readily accessible in a separate view.

1. On first use, choose a language to practise and a language for explanations.
   Choose or create a partner; provide a ready-to-use option so character creation
   is not required.
2. Choose a comfortable conversation difficulty and begin talking. Assistance is
   available immediately; no placement test is required to begin.
3. Keep the conversation central. Suggestions, explanations and corrections are
   available nearby. Flowers and evidence can be inspected when the learner wants.
4. On return, choose a contact and resume a conversation from their garden or
   deliberately start another. Resuming restores that conversation's settings.
5. Open the language progress view to explore practice and demonstrated ability
   across conversation partners.

A basic-use tutorial starts automatically on the first visit. The learner can
dismiss or move away from it, explicitly skip it, and start it again from Settings.
The tutorial is optional and must not prevent ordinary use. Remember completion
or skipping so it does not automatically repeat on each visit. Replaying it must
not reset the learner's conversations, settings or progress.

Tutorial content should explain the agreed journey: contacts and gardens, starting
and resuming conversations, difficulty, assistance, and finding progress. The exact
presentation and treatment of an interrupted tutorial remain to be designed.

## Agreed deletion, exclusion and archiving

- Deleting a conversation removes its messages, flower and derived analysis. Its
  evidence stops contributing to language progress.
- Deleting a partner removes the contact, relationship memories, garden and
  conversations. Explain that scope before confirmation.
- Removing a shared memory stops its use in conversation context and prevents
  automatic extraction from simply bringing it back. Source messages remain
  unless separately deleted.
- Excluding evidence from assessment keeps the conversation but omits the selected
  evidence from proficiency and skill-credit calculations.
- Deleting or excluding contributing evidence can reduce displayed totals. Explain
  this plainly; do not maintain invisible lifetime scores.
- Archiving a partner or conversation hides it from the default view while keeping
  it resumable and its evidence intact.

These are user-facing lifecycle operations. Relationship-memory dependencies on
deleted conversations and the effect of assessment exclusions on practice-only
flower measures still need explicit rules.

## Agreed assistance model

| Kind of assistance | Purpose |
| --- | --- |
| Understanding | Translations, word meanings, pronunciation and explanations of what the partner said |
| Expressing yourself | Suggested replies, sentence starters and help composing a message |
| Reflecting | Private coaching about what was communicated, what worked and what to practise next |

Suggestions enter the draft and never send automatically. The partner's main role
is engaging conversation, including natural clarification when confused. Detailed
teaching feedback belongs with the private coach.

Conversation settings own difficulty, how much composing help to offer, and how
proactive coaching should be. Translation, romanization and pronunciation visibility
are also remembered per conversation and apply consistently across its chat and
assistance surfaces.

Learner-wide presentation preferences own text size, contrast and other accessibility
choices. A heavily supported conversation with Juan and a more independent one with
Marta can coexist without changing the learner's general accessibility preferences.

## Agreed turn flow

Record a learner message in its conversation with known composing assistance.
The partner responds using conversation settings, partner identity and relevant
shared memories. Prepare reusable language help for the exchange, then make
observations such as skill evidence, Vibe, memory candidates and descriptive titles
available as their inputs and results permit. Derive progress and flower growth
from records using explicit rules.

This describes dependencies, not a mandatory serial sequence. Conversation should
not wait for every assessment. Supporting results can arrive independently with
clear pending/error states. Retrying failed analysis must not regenerate the
partner reply or count a message twice. Private coach discussion is not input to
partner memory.

## Execution architecture principles

Intentionally adopt useful graph, gating, hydration and concurrency concepts from
the reference material. Starting from an empty implementation does not mean
discarding sound architectural ideas. Each adopted concept must have an explicit
purpose and contract; no wholesale inheritance of code or architecture is implied.

The following requirements connect backend behavior to the learner experience:

- **Explicit dependency graph:** operations declare the inputs they actually need.
  Work on the learner's message can begin without waiting for the partner's reply;
  operations requiring the complete reply wait for that input.
- **Concurrent execution:** independent ready operations can run concurrently.
  Conditional and background work have explicit lifecycles and ownership.
- **Partial hydration:** each valid result updates its relevant view as it arrives.
  A completed translation need not wait for an explanation or assessment.
  Reconciliation of settled results must not become a screen-wide readiness barrier.
- **Real operation gating:** pause/resume/step control actual work at operation
  boundaries. An operation held before its provider request spends no provider
  tokens. Pausing does not freeze an already dispatched response; cancellation
  is a separate contract. Waiting states must be visible outside the graph view.
- **Faithful inspection:** the graph, execution and diagnostic records share an
  explicit operation/dependency contract. The visualization must represent actual
  execution, not a separately maintained illustration. How the declaration drives
  scheduling and is checked against runtime events remains a design decision.
- **Scoped results:** partial and final outputs identify their conversation,
  source revision and operation. Completion after navigation must never update
  another conversation or restore deleted/superseded evidence.
- **Reusable work:** graph operations represent useful work, not necessarily LLM
  calls. Cached results, local resources and model calls have explicit provenance.
  Sharing analysis does not require one large call or a serial queue.

Before choosing implementation tools, specify operation states, stream validation
and publication boundaries, retry identity, cancellation, concurrency limits,
snapshot reconciliation, and the exact unit/scope of stepping. In particular,
progressive display must honor the emoji-free generated-prose requirement.

## Agreed platform, AI access and data scope

Keep the desktop/mobile platform scope: Windows, macOS, Linux, Android and iOS.
Platform packaging and verification are implementation tasks, not reasons to
reopen the product definition.

AI-dependent work requires a reachable configured AI service. Provide three access
routes: hosted access through sign-in, the learner's own API key, and a custom URL
for a self-hosted instance of our server code using the same SkellySpeak protocol.
That server may be local or remote; arbitrary OpenAI-compatible endpoints are outside
Custom URL scope. Connectivity follows the
chosen route; a separate offline product mode is not required. Specific endpoint
and speech capabilities will be expressed by the provider contract.

Route individual operations to a standard generation model or a smaller, faster,
cheaper model according to task requirements. The established Gemini choice is
the starting candidate for Standard. Define Fast candidates for bounded work such
as titles and literal extraction; evaluate language quality before assigning them.
One message or turn can involve multiple model targets. Embeddings and deterministic
computation are separate execution choices. Concrete assignments are proposed in
[the AI strategy](./AI-STRATEGY.md#models-by-task-class).

Conversations, contacts, memories, learning evidence, settings and exploratory
statistics are stored on the device. There is no synchronization service. Hosted
identity and token-usage accounting support access and metering; they are not a
cloud copy of the learner's application data. Relevant content is sent to the
configured provider for inference; on-device storage does not mean inference
requests contain no conversation text. Do not add behavioral telemetry to support
the learner's local statistics.

## Agreed statistical reporting

The statistics surface is a dense, mechanical, non-conversational report of the
underlying data. Its visual language is scientific, numerical and computational:
distributions, time series, tables, explicit measures and technical labels. No
conversational summaries, motivational narration or personalized observations
addressing the learner. Density and exploratory detail are product goals.

The hierarchy is:

| Level | Report content |
| --- | --- |
| Global app usage | Overall usage totals, token distributions, time-series data and numerical activity breakdowns |
| Selected language | Skill sets, experience/XP, estimated CEFR level such as A1/A2, and performance across the seven skill domains |
| Conversation partner | Conversation counts and distributions, skill-domain statistics across those conversations, and aggregate flower measures including an average flower |

Individual conversations and contributing records can be inspected beneath these
levels. The statistical report is distinct from in-conversation coaching.
Concise performance-based guidance is allowed in the language assessment area,
grounded in the seven domains; it does not turn the general statistics interface
into a conversational assistant.

Counts and charts identify units, denominators, speaker, language, time range and
included sources as appropriate. Provider tokens and linguistic units must be
named separately. Measured activity, model judgments and estimated proficiency
remain distinguishable. Report assessment coverage and uncertainty; missing
analysis is not zero performance, and XP is not a CEFR conversion formula.

Average-flower calculations and the exact measures, filters and chart layouts will
be specified during focused statistics design. Aggregate view-independent domain
metrics under explicit rules, then render them; do not imply an averaged proficiency
certification.
Reuse analysis and stored records; opening or exploring reports should not itself
require more model calls.

## Focus and decision boundary

The statistics hierarchy and mechanical report style are agreed. Detailed reporting
design does not block the product-scope summary and technical architecture. The following
work can proceed in focused passes without blocking that transition:

- Character editor controls, tutorial presentation and detailed setting labels.
- Richer familiarity behavior and additional relationship-memory features.
- Visual layout, interaction and accessibility studies for the feature inventory.
- Calibration of XP, growth curves and statistical display choices.

Source ownership, deletion consequences, assistance attribution and clear separation
of measurements from estimates remain requirements. Their detailed mechanisms belong
in architecture and implementation specifications, not an endless product questionnaire.

## Remaining sequence

Functional restoration keeps the familiar chat, bubbles, lesson/analysis, word
inspection and utility-panel interactions. The completion checklist lives in
[UI-SURFACES.md](./UI-SURFACES.md). Provide both a restrained seven-category skill-map
view and the growing flower view over the same underlying evidence and metrics;
renderer selection never changes XP or assessment. Prioritize a verified AI exchange
and source-linked language assistance before treating the visual shell as complete.

- [x] Agree on statistical reporting hierarchy, density and presentation style.
- [x] Summarize scope, deferrals, implementation phases and acceptance outcomes in
  [BUILD-PLAN.md](./BUILD-PLAN.md).
- [x] Draft the data-model proposal with concrete ownership and deletion examples.
- [x] Draft paired execution and AI-strategy proposals, including all three access routes.
- [x] Review and accept the consolidated data-model, execution and AI-strategy defaults.
- [x] Draft storage, state and IPC contracts against the proposed ownership/execution rules.
- [x] Accept persistence defaults and select SQLite/rusqlite, ts-rs and Tauri commands
  for the local foundation; execution subscriptions remain Phase 2 work.
- [x] Propose concrete provider/model candidates and a bounded evaluation plan in
  [AI-EVALUATION.md](./AI-EVALUATION.md).
- [ ] Select provider protocols and evaluate models/embeddings; specify concrete
  capability checks, request/metering contracts and execution budgets.
- [ ] Develop focused visual studies alongside architecture where useful.
- [x] Review architecture and explicitly authorize implementation.

Implementation checkpoints and actual user checks are tracked in [BUILD-PLAN.md](./BUILD-PLAN.md).
The local foundation and chat access are implemented; assessment and garden behavior
remain future work. README records runnable behavior and verification limits.

## Presentation direction

Use the SkellySpeak logo, navy application chrome, light chat canvas, compact
controls and blue accents. Chat and the secondary lesson/analysis pane define
the desktop workspace. A toolbar drawer selects partners and their conversations.
Narrow screens expose Chat and Lesson tabs. Flowers are evidence views inside
the secondary pane, never the application branding or a decorative landing page.

## Immediate voice-first entry

The app opens directly into chat with default partner/conversation state prepared
in Rust. No mandatory title or configuration sequence precedes composing. The
reference layout and Record/Stop/Send interaction are the presentation specification;
Lesson/Analysis and Talk to your coach remain alongside chat. The coach's submitted
messages persist separately and never enter the partner prompt. Preserve useful
reference behavior as real functionality; do not replace it with decorative placeholders.

### Hosted service observability

The active hosted service is maintained in `server/`, independently of the local
conversation model. Its reviewed authentication, capped provider requests,
transactional admission/settlement and revocation controls are adopted intact.
Diagnostics add a separate bounded authenticated request lane; they never reset
counters, mutate allowances or bypass authorization. The app exposes an explicit
on-demand status check instead of automatic status polling. Deployment remains a
user-controlled Git operation with server tests and container checks as gates.


## AI access restoration decision

One settings section owns Hosted, API keys (OpenRouter chat and Groq transcription)
and Custom URL access. Custom URL targets our self-hosted server implementation and
shares its versioned protocol with hosted access. Requests capture their target and never infer another route
from a failed request. Preserve the reference's separation of chat and speech providers
without inheriting its whole credential implementation.

Retain platform-protected credential storage following Apple and provider guidance;
no session-only default or alternate file store is adopted. Saved credentials are
not revealed in settings. See `SECURITY.md` for sources and verification limits.

## Reference interaction fidelity

The composer, settings and execution inspector use the reference application's
visual hierarchy and interactions as their target. Evaluate individual styles and
components against current ownership and contracts before reuse; do not transplant
provider orchestration, persistence or the reference pipeline into presentation.
Restore compact, aligned Record/Stop and Send controls, a subordinate styled Discard
action, distinct modal surfaces, and compact searchable autosaving settings.

Audio settings include persisted auto-send transcriptions and waveform history
duration. A longer waveform window means visible amplitude history, not automatic
silence detection. Auto-send submits the completed transcript through ordinary
admission exactly once; failed acceptance retains the draft. It must not bypass
holds or send into a different conversation after navigation. Handling an existing
typed draft must be explicit in implementation and verification.

The AI graph is a read-only projection of declared operations, dependency edges
and attempt states. Selecting nodes may expose existing inspection/actions; opening
or laying out the graph must not trigger inference. Show only implemented nodes.
Graph restoration does not require completion of the full annotation pipeline.

## Request-load resilience policy

Harden request admission before expanding automatic analysis. One user action may
create several declared operations, but must have a finite work budget. Opening a
panel, restoring a window or reading a report must not create inference work.
Resume releases eligible work through capacity limits; it does not flush a backlog
directly to providers. A refused allowance holds related work with a visible reason.

Hosted, API-key and Custom URL are access choices within the same native execution
policy. Changing providers must not multiply available local workers or silently
retarget queued work. Status and credential checks need their own bounded capacity
so diagnosis remains possible while paid work is held.

The hosted service enforces its own limits independently of client cooperation.
A possible protocol gate can retire incompatible clients, but a supplied version
is not proof of identity or protection against abuse. That gate remains a proposal.
See the [incident evidence](./INCIDENT-POSTMORTEM.md) and
[implementation checkpoint](./BUILD-PLAN.md#next-checkpoint-request-load-resilience).

## Work ownership and reading surfaces

Rendering a panel, reopening saved content, changing reading preferences or hydrating
a report must not schedule inference. Reading surfaces consume durable source-linked
results; explicit user assistance requests and declared turn operations own paid work.
Bound total graph expansion and repair attempts while preserving independent
completion. Source text/offsets belong to the application; models supply analysis,
not redundant copies of known source formatting. Cache reuse is an optimization,
not the boundary preventing duplicated or unintended execution.

## Voice defaults

Voice is the primary interaction: microphone input, transcription, automatic send,
partner reply and spoken playback. Text input is essential but secondary; visible
reply text and inline reading remain essential alongside audio. Transcription is
part of the core default route capability, not an optional enhancement. Explicit
voice opt-out is permitted. Missing read-aloud is incomplete core functionality.

Auto-send voice transcriptions and automatically read new partner replies default
to on when those capabilities are implemented. Both controls remain user-adjustable
and save automatically. These defaults are approved behavior, not currently active
features. Auto-send follows successful transcription; automatic reading applies to
new replies, not reopening saved conversations.

## Inline word reading

A normal word click reveals the saved gloss directly beneath that occurrence using
the compact word/gloss stack. Unannotated text remains readable and inert; missing
analysis must not open an empty detail modal. This adopts the reference's inline
reading behavior without importing its inference lifecycle. A separate deep-inspection
feature requires working data and its own reviewed interaction.

## On-demand word pronunciation

Provide a small speaker action for an individual source word on hover or keyboard
focus, with an accessible touch equivalent. Only an explicit click/activation requests
speech for that word; hover, reading, selection and opening history never generate
or precompute audio. Bind pronunciation to the selected source occurrence and current
language/voice, using the selected AI route and existing admission/cancellation rules.
Word playback must coordinate with whole-reply playback and microphone capture.
This is an approved follow-up interaction, not an implemented feature. Interaction
owns presentation; native execution and AI owners define the bounded request contract
before implementation. Resolve word boundaries from accepted source spans rather
than inventing a whitespace tokenizer for every language.

The current Mandarin target uses Simplified Chinese. Shared generation prompts must
express that writing convention from language configuration; preserve source text
rather than silently converting user input or saved messages. Arabic text surfaces
must preserve shaping and appropriate direction consistently for user, assistant
and composer text; Interaction owns concrete typography and layout validation.

## Conversation controls and partner navigation: focused design pass

The conversation difficulty control should sit beside target and explanation
languages, accessible without opening settings. The requested range is absolute
zero through fluent; its exact levels and prompt semantics require the focused
Interaction/AI proposal. This controls the conversation, not assessed proficiency.
Do not merely relabel the current three difficulty values as a broader scale.

Partner management must expose durable identity, editing and one-action randomized
creation. Proposed navigation: a top-level partner collection and a contextual
profile for the selected conversation partner. Placement and whether the contextual
profile occupies a right-side tab remain proposals, not implemented behavior.
Interaction owns the layout proposal; AI maps controls to actual prompt effects.
Remove inert controls as their replacement is integrated; do not present topic or
persona selectors as operational without a domain action behind them. Private coach
assistance remains a separate workstream and does not become partner knowledge.

## Contact terminology

Use Contact / Contacts in product-facing terminology. This names the people the
learner talks with without implying a romantic relationship. Existing internal
partner identifiers are not renamed by this terminology decision alone.

A generated persona followed by an explicit “Add to contacts” action is a proposed
future lifecycle. Whether and how an unadded person's conversations remain durable,
and what adding a contact changes, require design agreement before persistence
changes. A Contacts collection and contextual Profile surface are proposals; the
terminology is the approved decision.

## Conversation difficulty: approved implementation scope

Use one compact five-choice dropdown: Absolute zero, Beginner, Intermediate, Advanced,
and Fluent. New conversations default to Beginner. Difficulty changes only trusted
prompt guidance for vocabulary, sentence complexity and conversational burden.
Absolute zero uses the same translation, glossing, coaching, suggestions and analysis
machinery as every other setting. It introduces no special bilingual cue, response
option mechanism, extra inference request or separate assistance surface.

The current conversation owns the setting. Changes affect the next accepted send;
already accepted work retains captured instructions. Chosen difficulty is not assessed
proficiency and does not award XP. No obsolete difficulty compatibility mode is kept.
The user explicitly authorized resetting this Mac’s development database after
verification and before launching this contract. Preserve all runtime logs.

## Conversation toolbar density

Difficulty is a compact dropdown immediately beside Native, sharing the existing
language selector row and styling. No separate heading/slider/stop-label row or
selection-dependent geometry. Review the full toolbar at its actual pane width;
absence of overflow alone is not visual acceptance. Keep chat content dominant.
This changes presentation only: the five values, autosave and captured prompts remain.

Conversation controls must form a visually distinct region from the message canvas:
use a consistent control-surface tone and boundary, not additional height or headings.
Density and hierarchy are simultaneous acceptance criteria, assessed in the complete
pane. Interaction owns the implementation and Code Quality checks it against the
style guide and actual geometry.
