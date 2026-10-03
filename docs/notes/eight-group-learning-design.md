# Eight group learning design and implementation checklist

Status: agreed product direction; workspace navigation and message tools implemented
in the working tree, with the learning replacement still proposed and incomplete.
Updated: 2026-10-03.

This document plans the replacement of the twelve-skill learning system with eight
communicative groups, explicit subskills, complete authored language guides,
personal evidence, contextual coaching, and targeted conversation starts. It is
the working checklist for this replacement, not a description of working features.

Implementation was authorized on 2026-10-03 after the planning decisions below.
The cutover must intentionally retire the old learning system and its data while
preserving unrelated owners. Commits and deployment remain separately authorized.

## Agreed decisions

- The eight groups below are the accepted design direction. Their precise subskill
  boundaries and identifiers still need a definition pass.
- Only the eight main groups are assessment and XP units. Subskills organize
  guides and conversation targets; they have no individual XP, levels or tracked
  assessment results in this version.
- Use the existing Jev Choice pipeline and its four-category probabilities.
  Revise the criteria to judge correct use, tolerating errors unrelated to the
  demonstrated function. Keep the current 0.6 combined-positive threshold and
  experience/effort revision rules initially. Evaluate prompt quality later.
- Every group question includes compact offline-authored language and variety
  guidance. Merely naming the language is insufficient. Native code assembles
  questions, validates answers and awards credit; the hosted server transports
  bounded requests without learning or reward policy.
- Replace the old learning and assessment system completely. Old learning records,
  XP, levels, and awards need not survive. Do not build credit conversion,
  compatibility assessment, a legacy reader, or two active assessment systems.
- The application will ship complete required authored material for every supported
  language, variety, and applicable explanation/interface locale. AI authorship is
  an acceptable minimum, with explicit provenance and separate review metadata.
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
  to that question (W7 below). Earlier mockup text about one language-wide thread
  is withdrawn.
- Add an action to start a conversation from a phrase or bubble, and an action to
  start one targeting a skill. Both use the current partner without prompting; the
  action names the partner ("Practice this with Lupe"). Switching partner happens
  in the top bar first.
- Provide Ask the coach on relevant guides, examples, and personal evidence, with
  the relevant language and skill context supplied automatically.

The earlier [radar implementation note](skill-radar-levels-handoff-2026-09-30.md)
describes the current branch's older model. Its historical-credit preservation and
twelve-skill assumptions are superseded for this replacement. It remains evidence
about existing code, not the new design specification.

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

The mockup's subskill-coverage radar is superseded. The first implementation tracks
only eight main-skill XP totals. There are no subskill counters or mastery claims.
The existing experience/effort rules remain the starting credit policy; display
and level integration must consume the same eight main-skill totals.

### Start a conversation from a phrase

The learner invokes a branching-style action on a bubble, authored example, or
selected text. The action captures the exact source text and language context,
then starts a new conversation with the selected persona.

The partner's first message must be the phrase or contain it naturally, depending
on whether it can stand alone. Merely discussing its topic is insufficient.
Show the seed in the new conversation's setup. Starting from a phrase does not
award the learner evidence for the partner's generated use of that phrase.

Before implementation, specify whole-bubble versus selected-text precedence,
length/empty-selection handling, language/persona mismatch behavior, and whether
the opening may inflect or otherwise adapt the text. Default proposal: preserve
the selected phrase verbatim and add surrounding context; never silently rewrite it.
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
| Shared learner explanation | Conceptual explanation independent of target-language grammar | Complete translations for declared explanation/interface locales |
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

## Existing code to inspect before implementation

This is a starting ownership map from source inspection, not a complete reuse or
deletion inventory. Paths identify responsibilities; none are permission to retain
obsolete assessment behavior. Other staged and unstaged work exists in the checkout.

| Responsibility | Existing entry points | Required investigation |
| --- | --- | --- |
| App navigation | [ModeTabs](../../ui/src/app/shell/ModeTabs.tsx), `ui/src/state/navigation/`, `ui/src/app/AppShell.tsx` | Add a third destination without duplicate routes or lost chat/practice state |
| Skills UI | `ui/src/features/skills/`, `ui/src/components/learning/`, `ui/src/state/learning/` | Recompose guide, evidence, selection and progress around the new catalog |
| Phrase actions | [PhraseActions](../../ui/src/components/reading/PhraseActions.tsx), `ui/src/features/conversation/messages/`, `ui/src/app/ReadingTools.tsx` | Connect bubble and selected-text actions through their captured reading scope |
| Content | [Content guide](../../content/README.md), `content/shared/skills.yaml`, `content/languages/`, `content/prompts/skills/`, `content/schemas/` | Replace old definitions and identify complete authored coverage |
| Content validation | `native/src/configuration/skills.rs`, [guides.rs](../../native/src/configuration/guides.rs), `native/src/bin/inspect-content.rs` | Existing guide types already carry origin/review fields; inspect before introducing another provenance owner |
| Assessment and learning | `native/src/learning/practice_assessment.rs`, `practice.rs`, `coaching/`, `learner/`, `rewards/` | Identify all old assessment, credit, aggregation and presentation paths |
| Conversation starts | `native/src/conversations/conversation_prompt.rs`, `native/src/learning/recommendations.rs`, `native/src/conversations/execution/tests/practice_openings.rs` | Existing focus/recommendation code is not proof that the two new start actions exist end to end |
| Coach | `ui/src/features/conversation/coaching/`, `native/src/conversations/coach_prompt.rs` | Resolve shared context entry points and durable conversation ownership |
| Durable cutover | `native/src/storage/store/`, `native/src/storage/schemas/` | Inventory retired data and dependencies, then choose a bounded destructive transition |

## Workspace and chrome: what the code does today and what changes

Baseline read from `ui/src` on 2026-10-03 before the workspace changes. The baseline
subsections below describe what motivated the work; they are not a description of
the current shell. Work-packet status and the implementation record below describe
the current checkout and supersede the Design-canvas mockup where they disagree.

### Shell baseline before W1–W4

- `state/navigation/navigation.ts` already has the hierarchy we want in data:
  `page: 'guided' | 'skills'` (Skills is a secondary page opened by `openSkills`;
  Android back on a phone returns it to `guided`), and inside `guided` a
  `practiceView: 'chat' | 'drill'` (persisted) plus `mobileSurface: 'chat' | 'panel'`
  for the coach sheet on narrow widths. There is no third peer tab to remove.
- `app/shell/ModeTabs.tsx` is the only thing that presents Chat and Practice as
  peer tabs (`.mode-tab[data-place]`, identity-coloured in `styles/shell/layout.css`
  lines 41–65). Skills has no entry in the top bar at all; it opens only from the
  radar / level chip and from `skillNavigation.explore` (`AppShell.tsx` `mapRequest`).
- `app/shell/SurfaceHost.tsx` keeps Skills mounted and CSS-hidden, but renders
  `{drilling ? <DrillPage/> : <ConversationPage/>}`: opening Practice UNMOUNTS the
  conversation (draft, scroll, coach panel state all gone). That is the real
  "return restores state" bug. Retaining the component also requires pausing
  hidden scroll observers and phone coach dismissal handlers.
- `app/shell/TopBar.tsx` order: wordmark · `ModeTabs` · language picker · theme ·
  progress/level chip (`SkillRadarGlyph`, `ProgressCounters`) · Settings · More.
  `AppShell.tsx` sets `data-place` = chat | practice | skills, which tints the bar.

### How the coach works now (this overrides the earlier "one thread per workspace" decision)

- The coach thread is a property of ONE conversation: `snapshot.coachMessages`,
  sent by `executeAction({ kind: 'askCoach', conversationId, … })`
  (`features/conversation/coaching/CoachAnalysisPanel.tsx`), and
  `native/src/conversations/coach_prompt.rs` builds the system prompt from that
  conversation's exchange, settings and edits. There is no language-level thread.
- A language-wide thread would need a new native owner, a new store table, and a
  prompt that no longer has an exchange to quote. Not worth it. Decision revised:
  **the coach thread stays per conversation.** "Ask the coach" from Skills asks in
  the ACTIVE conversation's thread and attaches skill context to that one
  question. The context chip in the pane shows what was attached.
- The routing for this already exists: `navigation.readingQuestion` +
  `draftReadingQuestion(q)` + `openPractice('panel')` is how the reading tools
  window asks the coach today (`AppShell.tsx` `onReadingQuestion`,
  `ConversationPage.tsx` lines ~302–316 `askCoach`). `AskCoachContext`
  (`components/learning/AskCoachButton.tsx`) is the in-page version. What is
  missing is a typed context payload instead of a bare string.
- The coach panel (`ConversationPage.tsx` `coachPanel`, `.break`) has its own
  internal tabs `coaching | skills` (`CoachPanelTabs.tsx`); the `skills` tab shows
  `ConversationProgress`. That tab is the per-conversation skill view and gets
  replaced by the new per-conversation evidence (see W8).

### Bubble-action baseline before W4

- `components/reading/MessageTools.tsx` is the one row under every bubble:
  Play / Inspect-audio icons → `tools` as TEXT buttons (`.message-translate`:
  "Translate") → `more` TEXT buttons that overflow into ⋯ ("Words", "Analysis",
  "Pronunciation", "Coach") → fixed icon `actions` (Edit, `AddToDrillButton`
  `deck-add`, `ProvenanceTip`). `useToolOverflow.ts` measures label widths to
  decide what fits. Partner bubbles assemble it in
  `components/reading/TargetMessage.tsx`; learner bubbles in
  `features/conversation/messages/TurnView.tsx`.
- `components/controls/ToolbarIcon.tsx` already maps names to lucide-react icons
  (`practice: BicepsFlexed` exists) plus a few hand-drawn paths. No icon set work
  is needed beyond adding names.

### How conversation starts work now

- `native/src/conversations/direction.rs`: `ConversationDirection { topic:
  Option<TopicChoice>, time_reference, use_persona_details }` with
  `TopicChoice = Builtin{id} | Coach{mode} | Custom{text}`. A skill focus and a
  topic SHARE the `topic` slot (the `Coach{mode}` variant), so a topic start drops
  the focus. `StartChoices.tsx` lines ~108–120 already document the fix: a
  separate practice target shaped like `DrillSkillTarget`
  (`{kind:'coach',mode} | {kind:'skill',skillId}`), currently rendered as a
  disabled "Coming soon" select.
- `SkillsPage.tsx` "Use this in a conversation" writes `profile.choices.focus`
  and calls `onPractice()` → `openPractice('chat')`. It does not create or start
  a conversation; it relies on the next start's `Coach{mode}` recommendation
  picking that focus up. That is the half-built "practice this skill".
- Nothing can seed a partner's first message with a phrase. `Custom{text}` is a
  topic subject, and `conversation_prompt.rs` / `openers.rs` treat it as such.

### Work packets and dependencies

W1–W4 are the bounded workspace/presentation work. W5–W8 are implementation
proposals, not the next authorized sequence. Complete D1–D3 and the relevant
D6–D8 decisions before their dependent contracts. W5 requires the phrase policy
and C5/C6; W6 requires catalog identities, target-duration policy and C5/C6;
W7 requires resolved guide/context contracts; W8 requires guides and the new
evidence projections. Regenerate contracts with each native contract change;
sharing a Rust file is not a reason to bundle these unresolved product decisions.

- [x] W1 **Keep the conversation mounted under Practice.** `SurfaceHost.tsx`:
  render `ConversationPage` always inside the `guided` holder and mount
  `DrillPage` in a sibling holder hidden with the same `page-holder hidden`
  pattern Skills uses. Pass `active={conversing}` and pause scroll observers and
  coach dismissal while hidden. Component regressions cover retained draft,
  reading position and phone coach selection; native-app inspection remains open.
- [x] W2 **Top bar: destinations instead of peer tabs.** Replace `ModeTabs.tsx`
  with `Destinations.tsx`: two buttons, Practice (`practice` icon, label) and
  Skills (`skills: BookOpenText` in `ToolbarIcon.tsx`), rendered on the right of the
  bar before the progress chip. The wordmark (`goHome`) is already "back to
  conversation". Remove `.mode-tabs-top` rules and the two `data-place` tab
  colour rules in `layout.css`; keep `data-place` on `.app` so the bar tint and
  the drill/skills pages still read as places. Compact/narrow: the same two
  icon-only buttons (`layout.css` line 382 pattern already hides tab labels).
  Delete the `page === 'skills' && isMobile` back-handler in `AppShell.tsx` only
  if W3 replaces it. ~half a day including the tour stops in `app/tour/tourStops.ts`.
- [ ] W3 **A visible return strip on Practice and Skills.** Partial: new
  `app/shell/ReturnStrip.tsx` rendered by `SurfaceHost` above `DrillPage` and
  `SkillsPage`: "← Back to conversation" (`openConversation()`) preserves the
  phone coach selection. Android Back uses the same action for either destination.
  The wordmark intentionally uses `goHome` to select chat. The active conversation
  title is still pending; do not introduce another conversation controller in the
  shell merely to fetch it. The visible return action is implemented and tested.
- [x] W4 **Icons for bubble tools.** `MessageTools.tsx`: `MessageTool` gains
  `icon: ToolbarIconName`; row buttons become `.message-tools-icon` with
  `aria-label`/`title` = label; the ⋯ menu keeps icon + text. `useToolOverflow.ts`
  measures the icon buttons, retaining the measurement span for scaled and touch
  targets. Shared identities/order: Translate, Words, Pronunciation, Analysis.
  Pronunciation uses a written `/ə/` symbol; playback and audio inspection retain
  their distinct icons. Both speakers expose saved pronunciation aids and Analysis;
  learner Analysis retains its existing feedback/disclosure behavior. Available
  audio and learner editing remain source-specific. `.message-translate` still
  serves saved-phrase and retry actions, so its remaining styles are retained.
- [ ] W5 **Fork action: start a conversation from this phrase.**
  Native: `ConversationDirection` gains `opening_seed: Option<String>` (validated
  with `validate_text`); `openers.rs` / `conversation_prompt.rs` instruct the
  first partner message to contain the seed verbatim, embedding it when the
  phrase needs a frame; test in `execution/tests/practice_openings.rs`. UI: new
  `components/reading/StartFromPhraseButton.tsx` (`fork: GitFork` in
  `ToolbarIcon.tsx`) beside `AddToDrillButton` in `MessageTools` `actions` and in
  `PhraseActions.tsx`; it calls `useConversation.startNewConversation()` for the
  current contact, sets the start draft (`setStartDraft`) with the seed, and
  starts immediately. `ConversationStart.tsx` shows a "Started from a phrase"
  chip with the seed when the draft carries one. The seed is a field on the
  direction, so a `Custom` or `Builtin` topic can coexist with it. ~1.5 days.
- [ ] W6 **Practice target on the direction (skill-targeted start).** Do what
  `StartChoices.tsx` lines 108–120 say: `ConversationDirection` gains
  `practice_target: Option<DrillSkillTarget>`; `recommendations::capture`
  resolves `{kind:'skill', skillId}` as `drill/skill_focus.rs::capture` does;
  `TopicChoice::Coach{mode}` moves into that field (`Coach{mode}` is deleted,
  not kept beside it). Enable the select. `SkillsPage` "Use this in a
  conversation" becomes "Practice this with {partner}": create + start with
  `practice_target = {kind:'skill', skillId}` and the current contact, no
  profile-choices write. Group targets wait for the new catalog (D1). ~1 day.
- [ ] W7 **Typed coach context.** Replace `readingQuestion: string | null` in
  `navigation.ts` with `coachRequest: { question: string; context: CoachContext }`
  where `CoachContext = { kind: 'skill'; skillId; variety } | { kind: 'example';
  skillId; text; conversationId } | { kind: 'reading'; … }`. `askCoach` action
  gains `context`; `coach_prompt.rs` appends the resolved guide text and the
  example as untrusted data. `CoachAnalysisPanel` renders the context as a chip
  above the thread for that question. Skills' "Ask the coach" buttons post a
  `coachRequest` and `openConversation('panel')`. ~1 day after the catalog exists.
- [ ] W8 **Skills page recomposition** (after D1/D2): `SkillsPage.tsx` drops
  `ExperienceProfile`, `SkillLevelsPanel`, `ProgressRules` and the `DetailDialog`;
  becomes groups → subskills list (left) + subskill page (guide from
  `configuration/guides.rs`, personal examples from the new evidence store) with
  the W6 and W7 buttons. The coach panel's `skills` tab (`CoachPanelTabs`,
  `ConversationProgress`) becomes "This conversation": the same subskill list
  filtered to evidence from `chatId`. The coach panel is NOT duplicated on the
  Skills page; the Skills page is full-width and its Ask buttons jump back to
  the conversation's panel. Size depends on the catalog work.

W1, W2 and W4 plus W3's return action are implemented on 2026-10-03
(uncommitted). `SurfaceHost.tsx` retains the conversation and lazily mounted
destinations. Page containers use `destination-page`, separate from navigation
button styling. `openConversation` replaces the ambiguously named `openPractice`:
it selects/saves chat and optionally selects the phone coach pane. Return strips
preserve that pane; explicit coach/skill links choose their intended surface.
The startup selection revision prevents a late saved destination from overriding
an explicit return. W3's conversation title and real-app checks remain open.
W5–W8 and the new learning model remain unimplemented.

## Open decisions

Resolve these with concrete examples and layouts, before their dependent contracts.
Do not reopen the agreed eight-group direction, complete authoring requirement,
or retirement of the old learning system.

| Decision | Specific question | Blocks |
| --- | --- | --- |
| Catalog boundaries | Which of the 42 candidates need splitting, combining, or sharper evidence definitions? | Assessment and full authoring |
| Evidence and rewards | Decided: eight-group XP, correct direct/contextual use, existing 0.6 probability gate and revision/effort behavior initially. Prompt-quality experiments follow implementation. Group display and reward integration must use those same eight totals. | Implementation, not another scoring-design gate |
| Coach context attachment | Decided: per-conversation thread. Remaining: the `CoachContext` shape and how `coach_prompt.rs` fences the attached guide/example (W7). | askCoach contract |
| Phrase opening policy | Exact phrase or permitted adaptation; what happens with an incompatible language/persona or oversized bubble? | Start command and acceptance validator |
| Target duration | How is a group reduced to a subskill and how long does conversational targeting last? | Skill-start prompts and controls |
| Explanation coverage | Which explanation-language and interface-locale combinations must be authored, and which shared materials are inherited explicitly? | Content schemas and authoring matrix |
| Reset boundary | Which records/fields belong exclusively to retired learning versus shared chat, practice-card, audio, settings or credential owners? | Destructive cutover |

Old learning data is intentionally disposable. Reviewing the reset boundary must
not reintroduce its preservation. It prevents an accidental deletion of unrelated
application data merely because it shares a table or workspace. The transition
must remove obsolete learning payloads from shared records as well as dedicated tables.

## Delivery checklist

All implementation boxes start unchecked. A checked box requires an artifact and
verification result recorded here, not a statement that work has begun. Phase gates
are inspectable checkpoints, not a request for repeated permission on routine work.
Only the workspace and toolbar implementation identified above is complete in
source. The learning replacement, migration, full authoring and native-app
verification remain incomplete. Phase 5 U1 stays open until its remaining title
and real-app restoration checks are complete.

### Phase 1 Finalize product behavior and definitions

- [x] D1 Implement the initial shared catalog with eight stable group IDs, 42 teaching subskills, purposes, positive/counterexamples, context requirements and neighbor boundaries in `content/shared/communication.yaml`. Linguistic review and multilingual contrast fixtures remain D2.
- [ ] D2 Create contrast cases for every boundary listed above, including multilingual examples and cases where context is insufficient.
- [ ] D3 Design the complete Past events, Requests, and Asking for clarification guides as representative end-to-end specimens.
- [x] D4 Mock up the workspace hierarchy (conversation + coach centre; Practice and Skills as destinations), coach context, and both conversation-start flows at wide and phone widths. Done on the Design canvas; language switching not yet drawn.
- [x] D5 Decide coach thread ownership: per conversation (as built). Skills asks into the active conversation's thread with typed context (W7).
- [ ] D6 Decide phrase inclusion/adaptation, source selection limits, and group-target selection/duration. Persona is decided: the current partner, no prompt.
- [x] D7 Set the initial assessment/credit policy: eight groups, correctness-aware Jev criteria, existing 0.6 probability gate and experience/effort revision handling. Retire old awards rather than converting them. This is a design decision, not implemented runtime behavior.
- [ ] D8 Review the reset boundary and produce an explicit retirement list for code, prompts, content, persisted fields and derived data.

Gate: reviewed definitions, three complete guide specimens, flow mockups, and
resolved decisions needed by Phase 2. Owner areas: product, language content,
learning domain, conversation flow. No bulk generation against an unsettled schema.

### Phase 2 Establish content and contract requirements

- [ ] C1 Specify shared definitions, localized explanations, target-language realizations, variety sections, examples, and explicit inheritance/no-detail dispositions.
- [ ] C2 Specify mandatory authorship/provenance and separate review fields; define how edits invalidate or preserve review at the correct scope.
- [ ] C3 Generate a finite coverage matrix from the actual language, variety, explanation-language and interface-locale registries.
- [ ] C4 Adapt the existing Jev inputs/outputs to eight main groups with source-turn ownership, authored guidance, context requirements, probabilities, supported quotations and failure information. Do not add subskill assessment records.
- [ ] C5 Define the two conversation-start intents and coach-context contract from the approved user behavior; retain their distinct semantics.
- [ ] C6 Decide the runtime owners and data relationships, then specify persistence changes and generated UI contracts from those owners.
- [ ] C7 Implement schema/content validators that reject duplicate/unknown IDs, missing required coverage, undeclared inheritance, missing provenance and locale gaps.
- [ ] C8 Add offline inspection outputs for a resolved guide, compact assessor input, start prompt and coach-context preview.

Gate: valid sample content, failing fixtures for missing coverage, and inspectable
contract examples. Existing Rust contract generation remains the source of UI types.
Owner areas: `content/`, native configuration, learning and conversations; UI IPC.

### Phase 3 Complete the authored language catalog

- [ ] A1 Author every shared subskill explanation, boundary, example pattern and assessment criterion.
- [ ] A2 Generate and inspect all required target-language and variety realizations from the approved matrix, recording AI authorship and provenance.
- [ ] A3 Complete translations for every required explanation/interface locale without an implicit English fallback.
- [ ] A4 Check every example's language/variety, meaning, intended skill and counterexample boundary; record automated checks separately from linguistic review.
- [ ] A5 Resolve all missing/error cells in the authoring matrix and produce a zero-gap coverage report.
- [ ] A6 Establish the finite reauthor/review workflow for a changed shared definition, translation, language realization or source revision.

Gate: all supported coverage complete at the generated baseline, with truthful
review status. Human review can improve that baseline later; missing required
material cannot be deferred into a normal runtime state.

### Phase 4 Implement the single assessment and learning engine

- [ ] L1 Implement eight-group assessment with the required adjacent turns and speaker roles; validate source identity and evidence before publication. Subskills remain teaching and targeting content.
- [ ] L2 Apply one award per accepted main group per submission; several subskills within a group do not multiply XP. Retain existing changed-revision experience/effort behavior, assistance treatment and duplicate-publication protection initially.
- [ ] L3 Implement the new ledger/projections and enforce one-time publication/credit under retries, restarts and concurrent refreshes.
- [ ] L4 Implement the approved group summary, level and reward calculations; keep presentation geometry out of evidence and scoring.
- [ ] L5 Connect sound, animation and haptics to new reward events, respecting learner settings, visibility and reduced motion.
- [ ] L6 Test context-dependent judgments, malformed responses, failure rollback, duplicate publication, partial metadata retention and stale source rejection.
- [ ] L7 Verify observability preserves useful non-content response information on success and failure while redacting credentials and learner content.

Gate: deterministic fixtures and native integration tests establish the new behavior.
Only one assessment owner may be registered in the application when cut over.
Implementing new modules for tests does not authorize a parallel live assessment path.

### Phase 5 Implement the language scoped Skills view

- [ ] U1 Add Practice and Skills as destinations off the conversation workspace with the approved icons, labels, shortcuts and Back to conversation; restore draft, scroll and coach thread on return.
- [ ] U2 Build group/subskill selection and the chosen progress visualization against real new-model projections, not mockup sample counts.
- [ ] U3 Integrate complete shared and language-specific guide content, target-language reading/audio tools and visible authorship/review details.
- [ ] U4 Integrate personal examples with source navigation and correct language, variety and conversation scope; separate them from authored examples.
- [ ] U5 Distinguish no personal evidence, insufficient context, processing and technical failure without implying missing application content.
- [ ] U6 Wire contextual Ask the coach and skill-targeted conversation actions from groups, subskills and examples.
- [ ] U7 Remove superseded duplicate skill surfaces and destinations while retaining the approved practice and evidence actions.
- [ ] U8 Verify narrow layout, RTL, keyboard/focus, long translations, reading/script scale, coarse pointers and reduced motion.

Gate: component and integration tests exercise complete guide-to-evidence and
guide-to-action flows. Owner areas: app/navigation, Skills, shared reading/learning,
state and their styles. Shared components do not import feature state.

### Phase 6 Implement conversation starts and contextual coaching

- [ ] F1 Add the phrase-start action to whole bubbles and selected/reading text, beside existing phrase actions; preserve exact source text and captured language scope.
- [ ] F2 Create the new conversation with the intended persona and seed; guard duplicate clicks and stale source/persona selection.
- [ ] F3 Compose and validate the phrase-containing first partner message under the approved inclusion policy, with visible failure and explicit retry/cancel behavior.
- [ ] F4 Implement skill-targeted starts that elicit learner use, expose the chosen target, and honor the agreed duration, topic and difficulty behavior.
- [ ] F5 Implement coach context attachment, visible scope and history ownership for guides, authored examples and personal evidence.
- [ ] F6 Verify coach content cannot become partner-chat history or automatic learner evidence, and source text cannot override instruction ownership.
- [ ] F7 Test empty/long selections, multilingual text, quotations, repeated starts, language/persona changes, provider failures, restarts and canceled openings.

Gate: native plus UI integration tests prove each action reaches a new conversation
or correctly contextualized coach exchange. No paid live evaluation is claimed by
fixture tests; live test usage is a separately identified verification activity.

### Phase 7 Remove the old system and perform the cutover

- [ ] R1 Update the retirement inventory against the current shared checkout; identify dependent work and review current diffs before each removal.
- [ ] R2 Remove old runtime registration, assessor adapters, prompts, twelve-skill content and obsolete native/UI projections in the integrated cutover.
- [ ] R3 Remove retired XP/level/reward paths, legacy tests/fixtures, generated exports, commands, styles and localization entries after checking dynamic callers.
- [ ] R4 Implement the approved bounded destructive learning-data transition. If the existing workspace is opened, use its explicit consecutive format migration; do not silently reset an unknown or damaged database.
- [ ] R5 Test that retired learning records/payloads are gone, a repeated startup does not rerun destructive work, and unrelated owners follow the reset-boundary decision.
- [ ] R6 Test equivalence of a fresh workspace and a transitioned workspace for the new learning state; verify failures roll back rather than leave mixed schemas.
- [ ] R7 Search active code/content for old assessment entry points and identifiers; investigate every retained hit and prove only the new engine runs.
- [ ] R8 Update maintained guides and mark superseded design notes; do not rewrite released historical migration steps or archived reference material.

Gate: one live system, no old-data conversion or runtime compatibility path, and no
published build that requires both engines. Preparation phases may overlap in
source work; release waits for the full cutover and complete authored coverage.

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

## Recommended first work packet

After the bounded workspace corrections, complete D1 through D3: the catalog/boundary specification and three complete
guide specimens. D4 through D8 refine the flows and unresolved policies.
C1 through C6 follow those decisions; bulk authoring follows the
validated content contract. Phases 4 through 6 can then progress against the same
approved definitions, converging at the single cutover in Phase 7.

## Verification record

### 2026-10-03 replacement content and request foundation

This checkpoint implements authoring validation and offline request inspection.
It does not switch runtime assessment, change persisted learning data or install a
second runtime assessor. The existing twelve-skill engine remains active until
the complete replacement is ready for the single cutover.

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
  [@typesafePrimitives2026] and [@typesafeState2026]. The file is an offline
  replacement input; the runtime still captures `presence.yaml` until cutover.
- The authoring report enumerates every configured target/explanation-language
  pair. These are language choices, distinct from the seven interface locales.
  Every supplied group requires all of that language's varieties and subskill
  sections. `--communication-ready` fails while any required pair is incomplete.
  No normal runtime missing-guide state or implicit explanation fallback is added.
- `inspect-content --communication-request <language> <variety> <explanation>`
  reads state JSON from stdin and prints the assembled eight-question request.
  It performs no provider call, stores no learner record and awards no XP.
  `--communication`, `--communication-coverage`, and `--communication-ready`
  inspect the catalog, authoring gaps and cutover prerequisite respectively.

Still required: the remaining authored languages/explanations and UI translations,
multilingual contrast fixtures, runtime capture/publication and retirement
migration, the Skills view, targeted starts and coach context. No whole replacement
or real-app readiness is claimed by this checkpoint.

Verification: pending final checks for this checkpoint.

- 2026-10-01: design and task list authored from the agreed discussion and inspected
  source entry points. No application implementation or data deletion performed.
- Documentation links passed (`npm run docs:links`); a separate check of this
  note's relative links, bibliography citations and 61 unique task IDs passed.
- Documentation tests passed: 28 tests using
  `npx vitest run --config tools/vitest.docs.config.ts --configLoader runner`,
  plus all 7 tests from `npm run security:test --prefix docs/docs-site`.
  The default `npm run docs:test` command could not load its configuration because
  the bundled loader encountered a Windows directory access restriction; the
  runner loader executed the same test configuration successfully.
- Scoped `git diff --check` passed for the initial documentation-only work. Its
  implementation checkboxes were unchecked at that time; subsequent work is
  recorded separately below.

### 2026-10-03 workspace corrections and message-tool consistency

Implemented in the working tree:

- Separated navigation-button styling from destination-page layout. Skills
  scrolls within its remaining height, below the visible return strip.
- Centralized conversation entry in `openConversation`, including saved
  destination updates and protection against a late startup read. Return strips
  and phone Back preserve the coach selection; the wordmark selects chat.
- Paused hidden conversation scrolling and phone coach dismissal. Reading
  position is restored on activation; destination overlays use active-surface
  context so hidden surfaces cannot retain their floating controls.
- Shared Translate, Words, Pronunciation and Analysis identities and ordering.
  Learner messages now expose saved pronunciation/romanization. Both Analysis
  controls retain their source-specific behavior, including durable coaching
  disclosure. Written `/ə/` notation replaces the ear icon. Audio playback,
  recording inspection and learner editing retain their existing capabilities.
- Updated the shared UI guide and regenerated the design-system bundle, reply
  preview and exported toolbar icons. No native contracts or persisted formats
  changed. The existing large conversation integration suite was reused for its
  real controller/snapshot fixtures; splitting that suite remains separate work.

Verification:

- 175 tests passed across 11 affected navigation, toolbar, message, coaching,
  conversation and scroll suites. Coverage includes Practice → Skills →
  conversation, retained phone coach selection, late destination restoration,
  real-page draft/scroll retention and independent pronunciation toggles.
- Documentation tests passed: 28 content tests and 7 security tests. The first
  attempt was blocked by the sandbox configuration loader; the authorized rerun
  passed outside the sandbox.
- Browser inspection used the production-component conversation fixture at
  desktop and 390px phone width, including the RTL learner pronunciation toggle.
  The browser Skills demo filled the destination container at both widths;
  phone DOM bounds confirmed no horizontal overflow and an independently
  scrolling Skills page. These are browser/demo checks, not a native-app run.
- Final validation passed: `npm run check:fast`, `npm run build`,
  `npm run previews:check`, `npm run design-system:check` and `npm run docs:links`.
  The build retains its existing large-chunk warning; the conversation tests emit
  the existing simulated-canvas notice. Neither run failed.

Still open: native-app/device restoration and audio checks, W3's conversation
title, W5–W8 and all new-learning-model phases. No commits or deployment.
