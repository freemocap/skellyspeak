# UX design pass

Status: **Stage 1, colour, the Chat | Practice tabs, three widths, the voice
panel and the vocabulary settled after seven reviews, 2026-09-27. The first build
batch is agreed ([build-plan.md](build-plan.md)); step 1 (vocabulary) and step 2
(colour tokens) are implemented on branch `ux-design-pass`, uncommitted.** Proposal artboards are a
review-only page, `ui/tools/design-pass-preview.html`, served by the UI dev server.

## Brief

The functionality and architecture are sound. The interface is hard to follow
for anyone who has not been walked through it: too many simultaneous choices,
controls whose consequences are not visible, one thing called by several names,
and chrome competing with the language being practised. Pass through the app top
to bottom (first run, conversation start, chat, Drill, shell and modes), fix the
UX and UI, and flag deeper data-flow, native or AI work for later.

A measure of the problem: the guided tour (disabled, `TOUR_ENABLED = false`)
needs nine stops to explain the chat screen (`ui/src/app/tour/tourStops.ts`).

The goal, in Jon's words from the first review: learning a language is hard and
the app will present a lot of information, so everything around that should be
cognitively smooth and calm, supporting the learner's emotional state so the
effort goes to the language. Full control stays available on request, never as a
requirement.

## Working principles

0. **Calm around a hard task.** Predictable places, progressive disclosure, and
   nothing important that moves or scrolls away.
1. **One screen, one job.** One primary action per screen, visible without
   hunting.
2. **A control's look says what it does.** Choices look like choices. Anything
   that sends an AI request looks like a start or send action.
3. **Defaults first, options one step away.** Collapsed and summarised on one
   line, not deleted.
4. **One name per thing, and one look per control, everywhere.** A control that
   does the same job has the same icon, words and colour on every surface and in
   every mode; anything else is a cue conflict. See [Vocabulary](#vocabulary).
5. **Space goes to the language being practised.** Status, inspection and empty
   panes recede until they have something to show.
6. **Inspection stays, one level down.** AI activity, evidence, YAML, prompts and
   statistics keep their depth but leave the primary path.
7. **Warmth comes from the partner and the rewards, not from copy.** Authored
   personas and the existing reward presentation carry the personality. Chrome
   copy stays plain.
8. **Colour and depth carry meaning.** Identity colours mark places and voices,
   blue marks what you can press, and depth says what a surface is for. See
   [colour and depth](colour-and-depth.md).
9. **No static copy on working surfaces.** Chat and Practice carry no standing
   instructions. The one hint is an empty state that points at the control it
   describes; live state is a small chip; explanations go to tooltips and
   settings. Controls in a group sit on one row.

## Constraints carried from the working agreement and design system

- Plain functional labels; no slogans, filler, exclamation marks or emoji in the
  interface.
- Statistics remain dense mechanical reports. This pass may move them; it does not
  soften them.
- Reward presentation (sound, animation, haptics) is required behaviour.
- Settled platform, AI access and on-device decisions are not reopened. Access UI
  can be rearranged; the access model is unchanged.
- Settings stay compact, grouped, with secondary details collapsed.
- Layout and typography fixes follow the language-independent behaviour rule.

## Method, per stage

1. Walk the flow in the running app where possible, otherwise the production
   preview fixtures, at desktop and narrow widths, light and dark, LTR and RTL.
2. Record findings with file references, most confusing first.
3. Propose: artboards on the production stylesheet in
   `ui/tools/design-pass-preview.*`, with numbered notes that map to findings.
4. Review with Jon; record decisions in the stage note.
5. Implement in production components as one bounded change per stage. Run tests,
   previews and style/localization checks, and check the running app.
6. Anything that needs native, AI, storage or content changes goes to
   [Deferred](#deferred-native-ai-content-or-state-model-work). The pass does not
   change those contracts.

## Stages

| Stage | Scope | Status |
| --- | --- | --- |
| 1 | First run: language, sign-in, first conversation start | Settled; build steps 5 and 6: [01-first-run.md](01-first-run.md) |
| 2 | Chat: message bubbles, help and coach surfaces, composer, conversation settings | Initial findings below |
| 3 | Practice (was Drill): card list, practice stage, recording, results, Add cards | Initial findings below |
| 4 | Shell and modes: navigation model, top bar, phone navigation, overlays, Progress and Skills, More | Chat \| Practice tabs and three widths settled; build step 3: [04-shell-and-modes.md](04-shell-and-modes.md); rest in findings below |
| — | Colour and depth (all stages) | Settled on the cool palette; build step 2: [colour-and-depth.md](colour-and-depth.md) |
| — | Voice input (Chat and Practice) | One identical panel, settled; build step 4: [voice-input.md](voice-input.md) |
| — | Vocabulary (all stages) | Decided; build step 1: [Vocabulary](#vocabulary) |
| — | Typography and design-system consistency (all stages) | Findings below; T1 is an open build question |

## Initial findings for later stages

These are observations from the first sweep, not proposals yet.

### Stage 2 — Chat

- **C1 Bubble chrome equals content.** Every message carries a permanent footer of
  text actions (Translate, Word by word, Analysis, Add to Drill) plus corner
  buttons (speak, edit, recording). On a phone the controls are as tall as the
  message. `messages/TurnView.tsx`, `components/reading/TargetMessage.tsx`.
- **C2 Help is split across five places.** The reply-help tray (“Help with this
  reply”), the coach pane’s “On your message”, the per-message Analysis dialog,
  the per-message feedback popup and the coach chat. A newcomer cannot tell which
  to use. `composer/ReplyHelp.tsx`, `coaching/LiveCoachReview.tsx`,
  `ConversationPage.tsx` (Message analysis dialog), `coaching/MessageFeedback.tsx`,
  `coaching/CoachAnalysisPanel.tsx`.
- **C3 Two text inputs at once.** The message composer and “Ask about a message…”
  are both visible on desktop; typing into the wrong one is easy.
- **C4 Scores on every learner bubble,** shown with emoji (`✍️ 3/10 🗣️ 5/10`).
  `coaching/MessageFeedback.tsx:67`.
- **C5 “Conversation settings” mixes scopes.** Difficulty and prompt belong to this
  conversation; reading aids, speech and reward toggles are app-wide settings
  (the component says so). The label implies they affect only this conversation.
  `session/ConversationSettings.tsx`.
- **C6 Failures look like messages.** “Partner reply is unavailable.” renders as a
  partner bubble. `messages/ReplyStatus.tsx`.
- **C7 “Experience” tab** in the coach pane is a statistics view named with an
  internal term. `coaching/CoachPanelTabs.tsx`.
- **C8 One setting, three labels.** “Read aloud” / “Auto-speak tutor replies” /
  “Read persona replies aloud”; “Auto-send” / “Auto-send transcriptions” / “Send
  after stopping the microphone”. `ConversationSettings.tsx:73-74`,
  `settings/SettingsModal.tsx:413,423,440`.

### Stage 3 — Drill

- **R1 Three words for one thing.** “Drill target”, “phrase”, “line” for items;
  “take” and “attempt” for recordings; “reference” and “target” for the model
  audio. `DrillLayout.tsx`, `AddPhrases.tsx`, `RecordDock.tsx`, `AttemptRows.tsx`,
  `DrillComparison.tsx`.
- **R2 The default view is the full instrument.** Two spectrograms, Fit / Same
  scale / Align words, time direction, voice speed, live thresholds and the report
  column all show at once. The seven density passes in
  [drill-ux-redesign](../drill-ux-redesign-2026-09-23.md) made each part tighter;
  none made the default simpler. Candidate: phrase, listen, record and word result
  by default, with the comparison one click away.
- **R3 Two navigations for the same list.** The “Drill targets 1/1 · Previous ·
  Next · Random target” bar and the phrase rail. `DrillLayout.tsx`, `PhraseRail.tsx`.
- **R4 Add phrases asks six things before Generate:** lengths, chat lines, skill,
  topic, difficulty and count. `AddPhrases.tsx`.
- **R5 Recording modes and thresholds live in the dock.** Tap / Hold / Auto, pause
  length, shortest take and threshold. `RecordDock.tsx`.

### Stage 4 — Shell and modes

- **S1 The top bar holds ten controls:** Conversations, home, language, Chat/Drill,
  Progress/XP, AI status, theme, Settings, More. `app/shell/TopBar.tsx`.
- **S2 Four navigation patterns for destinations.** Chat/Drill is a segmented
  switch; Progress is an overlay; the skill tree is a page reached from More or
  Progress; conversations are a drawer; a third progress view is the coach pane’s
  Experience tab. The navigation store has six independent fields (`page`,
  `practiceView`, `mode`, `mobileSurface`, `overlay`, `historyOpen`).
  `state/navigation/navigation.ts`.
- **S3 “Conversations” uses the menu icon** but opens the current partner’s
  conversation list; every row repeats the language name. `TopBar.tsx`,
  `session/ChatHistory.tsx:92`.
- **S4 More is a mixed drawer:** share logs, Settings (again), Browse languages,
  Skill tree, AI activity, Reload. `app/shell/MoreDialog.tsx`.
- **S5 New conversation has three names:** “New”, “✚ New chat”, “New
  conversation”. `ConversationPage.tsx:556`, `ChatHistory.tsx:73,78`.
- **S6 Phone navigation is partial.** The bottom bar is Chat | Coach. Drill is an
  unlabeled top-bar icon, and opening it hides the bottom bar. Progress and Skills
  are not in it. `app/shell/MobileNav.tsx`.

### Typography and design-system consistency

- **T1 Digits, spaces and ASCII punctuation render in the Arabic reading font
  across the whole interface.** `--font-sans`, `--font-serif` and `--font-mono`
  list `--font-scripts` first, and the Arabic faces declare
  `unicode-range: U+0020-0040, …`, which covers space, digits and `!"#$%&'()*+,-./:;<=>?@`.
  Measured in the preview page: `0123456789?.,:/` at 40px is 251px in the app
  stack and 251px in Skelly Arabic Reading, against 303px in IBM Plex Sans. This is
  why numbers and question marks look slightly off everywhere. The range is
  deliberate: it keeps Arabic text runs together in the native window
  ([font coverage note](../language-font-coverage-2026-09-20.md)). Fixing it needs
  a shared rule for which face owns shared ASCII characters in interface text and
  in reading text, not a per-language patch, checked in the native window.
  `ui/src/styles/foundations/tokens.css`, `ui/public/fonts/README.md`.
- **T2 Emoji and dingbats used as icons,** against the design system:
  🔊 `TargetMessage.tsx:161`; ✏ `TurnView.tsx:163`, `MessageFeedback.tsx:80`;
  ✍ 🗣 `MessageFeedback.tsx:67`; 🗑 ✚ `ChatHistory.tsx:121,73`;
  🙂 😕 `PersonaReaction.tsx:14-15`; ✎ `ConversationChoices.tsx:41`,
  `ConversationPage.tsx:499`. The icon set in `ToolbarIcon.tsx` already has
  `voice`, `trash`, `plus` and an edit-capable style.
- **T3 The default palette mixes warm and cool.** The default appearance palette
  is cool, but the cool override does not set `--chip` or `--track`, so chips,
  recessed wells and the Chat/Drill switch stay beige (`#dbd4c5`, `#e2dac6`) on a
  grey ground. The `tokens.css` comment still calls warm the default. Measured in
  the preview page with the default appearance. *Resolved in build step 2: cool is
  the base palette with its own chip and track.*

## Vocabulary

Decided 2026-09-27 except where marked. One learner-facing word per thing;
internal and inspection views may keep technical terms.

| Thing | Word | Replaces |
| --- | --- | --- |
| The character you talk with | **partner** | persona, contact, tutor |
| The helper who reviews your messages | coach | — |
| One thread with a partner | conversation | chat (as a noun) |
| The two tabs | **Chat**, **Practice** | Chat, Drill |
| One thing you practise saying | **card** | drill target, target, phrase, line |
| The list and panel of them | **Practice cards** (Jon, during step 4) | Cards |
| The computer voice you copy | **reference** | target, example |
| Each recording of you saying a card | **attempt** | take, recording |
| How close an attempt came | match (“86% match”) | proposed |
| The three ways to record | Tap, Hold, Auto | Tap to record, Hold to talk, Live |
| Listening in Auto without making attempts | Detect attempts (off) | Auto detect takes |
| Saving a chat line for practice | Add to Practice | Add to Drill |
| Making new cards | Add practice cards | Add drill targets…, Add phrases, Add cards |
| The language explanations use | Explain in | Explanation language, My native language |
| Progress counters | XP, skills | experience, effort (kept inside the Progress report) |
| The pop-ups that show XP earned | XP badges | XP cards (card now means a Practice card) |
| The AI request log | AI activity | AI activity & tools, AI View |

Why Practice: Chat trains understanding and responding to a partner; Practice
trains the physical act of speaking through repetition. Why card: a card can
hold a word, a phrase, a sentence or several sentences.

Practice's Auto is today's Live mode with “Auto detect takes” on. Turning
Detect attempts off keeps today's listen-only state (capture mode `monitor`).

Renames these decisions force, so each word keeps one meaning (agreed in the
seventh review):

- **“Practice” elsewhere.** “Practice XP”, “Practice progress” and “Practise this in
  conversation” use practice to mean the whole app or Chat. They become “XP”,
  “Progress” and “Use this in a conversation”
  (`features/conversation/progress/ProgressSummary.tsx`, `features/skills/SkillsPage.tsx`).
- **“Attempt” elsewhere.** Progress calls an assessed chat message an attempt
  (“Exclude attempt from progress”, “Recorded attempts”). It becomes “assessment”
  (“Exclude this assessment”, “Assessed messages”).
- **The live stream.** `LiveRecording` labels its regions “Take n”; it becomes
  “Attempt n”.
- **Internal names** such as `practiceView`, `openPractice` and `PracticeSwitch`
  mean the Chat/Drill pair today. Not learner-facing; rename in the Stage 4 state
  work (A6) to avoid confusing the next reader.

## Deferred: native, AI, content or state-model work

- **A1** ~~Drill Auto (continuous) recording is desktop-only natively but offered
  on phones.~~ Superseded: already resolved before this pass. Phones stream
  browser-captured audio to the shared native segmenter (`mic_listen_push`); see the
  follow-up in the [mobile parity audit](../mobile-parity-audit-2026-09-23.md). The
  first version of this list cited the audit's pre-fix findings.
- **A2** Drill mode, threshold, pause and shortest take are page state and reset on
  restart; persisting them is a native settings change.
- **A3** Reading, speech and reward toggles are app-wide native settings. If some
  should be per conversation, that is a native settings change; otherwise Stage 2
  only relabels and regroups them.
- **A4** Before merging help surfaces (C2), confirm which ones share native
  operations. The UI README states that Analysis uses the grammar operation.
- **A5** Persona facts must be in the learner’s explanation language (decided
  2026-09-27). Today they are in different languages across content files: Spanish’s
  Lucía has an English occupation (“Veterinary nurse at a small animal clinic”),
  German’s Jonas has “Fahrradmechaniker”, Portuguese’s Marina “Bibliotecária”.
  Content work: author or translate default-partner facts per explanation language.
  Needed before Stage 1 shows occupation and city on the start card.
- **A6** Navigation state (six fields) should become one destination plus one
  overlay. UI state only, but it touches the shell, conversation, Drill and
  Skills; plan it with Stage 4.
- **A7** Remembering the last-used topic and options as defaults is a native
  preference.
- **A8** T1 needs a shared font-routing decision in the fonts policy before any
  change, and a check in the native window on each platform. Proposed to stay out
  of the first build batch.
- **A9** Chat Auto (pause to finish) and hands-free talking: a listening take
  returns no transcript to the interface, and read-aloud must pause listening.
  See [voice input](voice-input.md).
- **A10** ~~Spectrogram and level meter in Chat come from the listening session;
  Chat gets them once it records through that session, which depends on A9.~~
  Spectrogram done 2026-09-27 at Jon's request: a single recording keeps its own
  live analysis (`mic_spectrogram`, and `mic_push` copies on phones), so Chat's
  recording and transcription are unchanged. See
  [voice input](voice-input.md#implemented-build-step-4). The level meter belongs
  to Auto and waits for A9.
- **A11** Remember recorder settings (mode, timing) as learner preferences;
  generalises A2 to both surfaces.
- **A12** The persona-generation prompt often writes persona details in the target
  language; it must write them in the explanation language (AI layer; see A5).
- **A13** The three width tiers need one more breakpoint (400px) in the style
  checker’s allowed set (`ui/tools/check-styles.ts`) and a tier hook to replace
  the single `useIsMobile` breakpoint (860px). UI tooling, no native change.
- **A14** A conversation's practice target, separate from its topic. Today a
  skill focus is a kind of topic (`TopicChoice::Coach`), so pressing a topic on
  the start card drops a focus set in Options, and a conversation cannot aim at a
  skill the learner picks. The direction needs a target of its own, shaped like
  Practice's `DrillSkillTarget` (`{ kind: 'coach', mode }` or
  `{ kind: 'skill', skillId }`). `recommendations::capture` would then resolve a
  chosen skill as `drill/skill_focus.rs::capture` does. The start card's “Skill”
  select is built and disabled (“Coming soon”) until then; see
  [Stage 1](01-first-run.md#implemented-build-step-6). Stored directions holding
  a coach topic become incompatible, so that conversation data is reset rather
  than converted.

## Decisions

Made 2026-09-27 (first review):

- Topics and practice modes select, then one Start. *(Superseded 2026-09-28: every
  start is one press; see below.)*
- First run chooses one language; more from Browse languages later.
- The language list scrolls between a pinned heading and a pinned action bar, so
  Continue is always visible.
- Use colour and depth to organise the app; make Chat and Drill tangible tabs
  (proposals: [colour and depth](colour-and-depth.md),
  [Stage 4](04-shell-and-modes.md)).

Made 2026-09-27 (second review):

- Colour goes ahead on a cool, neutral base: the cool palette stays the default so
  the identity colours have room.
- Tabs as proposed: Chat and Drill in the global bar on desktop, a bottom tab bar
  on phones, Coach from the chat header on phones.
- Voice input is a first-class track: one recorder for Chat and Drill,
  microphone-first with a typing override ([voice input](voice-input.md)).

Made 2026-09-27 (third review):

- The voice input direction is liked; this pass makes the controls one row, keeps
  Tap / Hold / Auto visible under the record control, and replaces the empty
  stream text with an arrow pointing at the control.
- Drill's phrases become a collapsible side panel on the left, matching the coach
  edge on the right.
- Static instructional copy leaves the main surfaces (principle 9).

Made 2026-09-27 (fourth review):

- The voice panel is identical in Chat and Drill: a microphone icon with no word,
  red outline and glow while live, one full-width arrow with the same sentence
  everywhere, and “Auto-send” as the checkbox label.

Made 2026-09-27 (fifth review):

- **Partner** is the one word for the character you talk with; persona, contact and
  tutor leave the interface.
- **Partner facts** (occupation, city and so on) are written in the learner’s
  explanation language (A5, A12).
- **Chat’s Auto** stays in the Tap / Hold / Auto toggle, dimmed, and shows a small
  “Coming soon” tag when pressed, so the control is the same on both surfaces.
- **Setup screens keep their one orienting line.**
- **The language bar stays on one row** for every language and width.
- **Three widths** (Full, Compact, Narrow) replace the single phone/desktop split;
  proposed in [Stage 4](04-shell-and-modes.md#three-widths).

Made 2026-09-27 (sixth review):

- **Names:** Practice (tab), card, reference, attempt; see [Vocabulary](#vocabulary).
- **Calmer colour:** side panels and edge tabs are neutral with one coloured edge;
  the mode keeps its tab and band but the surface wash is gone; in Practice the
  target card is the main violet element.
- **Three widths** approved.

Made 2026-09-27 (seventh review):

- **The ready microphone is a calm blue** (the “you” colours); red, with its outline
  and glow, means recording and nothing else.
- **Thinner coloured edges** on the coach and cards panels and their edge tabs.
- **The follow-on renames** in [Vocabulary](#vocabulary) are agreed.
- **Nothing is removed in the build.** The mockups show only what changes; existing
  behaviour moves into the new layout. [build-plan.md](build-plan.md) lists it.
- The build stage is close; the remaining questions are in the build plan.

Made 2026-09-28 (review of build step 6):

- **Every start is one press.** The partner's start, each topic and the learner's
  own topic start the conversation directly; the options apply to all of them.
  See [Stage 1](01-first-run.md#implemented-build-step-6).
- **The interface leads the backend.** Where the native side cannot do something
  yet, the UI is built as intended and that part is disabled with “Coming soon”
  on hover. A `BACKEND:` comment at the control and an item under
  [Deferred](#deferred-native-ai-content-or-state-model-work) say what it needs
  (first: A14).
- **Target-language words among interface text are bold in `target-ink`**, so the
  language being learned scans apart from explanations. Translations keep the
  interface style.

## Log

- 2026-09-27 — Plan drafted. Stage 1 walked through the production preview
  fixtures (`onboarding-live-preview`, `conversation-preview`,
  `drill-live-preview`) at desktop and 375px widths; the running native app was not
  used. Proposal page added: `ui/tools/design-pass-preview.{html,tsx,css}`.
  Verified: `npm run previews:check` passes; the page renders at desktop and
  390px phone artboards with no horizontal overflow, and in dark mode (DOM
  checks). No production source changed; no commit.
- 2026-09-27 — First review recorded (see Decisions). Proposal page revised:
  colour-and-depth legend (section A), pinned-frame language screen (1a), a shared
  shell with Chat and Drill tabs used by 1c and 4a, a Palette toggle, and phone
  bottom tabs. Identity colours checked for contrast (WCAG formula: inks ≥ 5.6:1
  light, ≥ 6.8:1 dark). Verified: `npm run previews:check` passes; no horizontal
  overflow at 540px, 1066px and 390px artboards; light, dark, cool and warm
  rendered; tab switching, language choice, sign-in and topic selection exercised
  in the browser. No production source changed; no commit.
- 2026-09-27 — Second review recorded. Voice input investigated (`useMicRecorder`,
  `RecordDock`, `ComposerInput`, native listening session and browser capture) and
  proposed: `VoicePanel` sections Va and Vb, also used by 1c and 4a, drawing the
  production `LiveRecording` with synthetic audio. A1 corrected as already
  resolved. Verified in the browser: Chat talk → transcribing → draft → send,
  typing override, Drill Auto cutting takes with the list and rail updating; no
  horizontal overflow in desktop or 390px phone artboards; `npm run
  previews:check` passes. No production source changed; no commit.
- 2026-09-27 — Third review recorded. Voice panel revised: a record pad the height
  of the stream with the Tap / Hold / Auto toggle under it at the same width; one
  non-wrapping control row; an arrow prompt in the empty stream; live state as a
  chip; standing instructions removed from Chat and Drill, including the start
  card's “or start yourself below”. Drill phrases fold to a violet edge tab. Chat
  Auto shown as the target, marked as needing A9. Verified in the browser: every
  control row is a single line with no overflow at desktop, narrow and 390px
  widths; the phrase panel opens, selects and folds; Drill Auto cuts takes; Chat
  Auto builds a draft and, with Send when I stop, sends each line; light and dark
  rendered; `npm run previews:check` passes. No production source changed; no commit.
- 2026-09-27 — Fourth review recorded. Voice panel unified: the pad is a microphone
  icon only, calm when ready and red with a red outline and glow when live; Send
  moved into Chat's draft; one full-width arrow and one sentence (“Press the
  microphone to start”) on both surfaces and in every mode; the chip shows only the
  time; “Auto-send”; one size and one control order on both surfaces. A live
  microphone red was added to the colour proposal, contrast-checked, replacing the
  magenta recording accent. Verified in the browser: all four panels measure the
  same (face and pad 88px, pad and toggle 112px at the review width; 100 × 76px on
  phone), controls stay on one row with no overflow, the prompt fits at 390px,
  and Tap, Hold, Auto, draft, add-more, send and Drill takes behave as described;
  `npm run previews:check` passes. No production source changed; no commit.
- 2026-09-27 — Fifth review recorded (see Decisions). Proposal page reorganised
  around three widths with a Width control (Full 1120px, Compact 430px, Narrow
  375px); Full renders at true size and scales to fit. Coach and phrases share one
  side panel: beside the surface at Full, a drawer from the edge at Compact, a
  sheet at Narrow. Chat Auto shows “Coming soon”. The language bar has four fixed
  slots. Verified in the browser: tier switching; coach and phrase panels open,
  close from the scrim or fold control, and phrase choice updates the card; the
  language bar is one row at a constant height for all 18 languages at all three
  widths, with no overflow; the Auto tag appears and the mode stays Tap; `npm run
  previews:check` passes. No production source changed; no commit.
- 2026-09-27 — Sixth review recorded. Names decided through four structured
  questions (tab, item, voice, recording). Proposal page updated to Chat | Practice,
  Cards, Add cards, Play reference and “Attempt n · 86% match”; the stream's “Take n”
  labels are hidden rather than faked until `LiveRecording` changes. Colour calmed:
  neutral side panels and edge tabs with one coloured edge, no surface wash, neutral
  attempt list. Fixed: the Practice stage did not fill its row after the flex change.
  Verified in the browser at Full and Compact; `npm run previews:check` passes. No
  production source changed; no commit.
- 2026-09-27 — Seventh review recorded. The ready pad uses the “you” tint, line and
  ink; coloured edges drop from `--border-width-thick` to `--border-width-strong`.
  The build plan was checked against the Drill source. The mockup had left out two
  existing controls: Previous / Next / Random, and Live mode's “Auto detect takes”.
  Both are in the plan's preserve list. The page now shows Detect attempts in
  Practice's control row (Auto only), today's recording settings with their policy
  values, and a “Not shown, and kept” note. Verified in the browser: the control row
  is one line at all three widths with no overflow; with Detect attempts off the
  stream keeps running and no attempts are cut; turning it on again cuts the next
  one; the settings rows fit at Full and Narrow; `npm run previews:check` passes. No
  production source changed; no commit.
- 2026-09-27 — Build plan agreed (yes to all). Branch `ux-design-pass` created.
  Step 1 implemented: the vocabulary in all seven dictionaries, source and tests,
  with draft translations listed for review in
  [translations-step-1.md](translations-step-1.md). Found while applying it: Settings'
  “XP cards” collided with Practice cards and became “XP badges”. Checks and
  browser verification are in the build plan's step results. No commit.
- 2026-09-27 — Step 2 implemented: identity colour tokens, the recording family
  (replacing the magenta accent and the danger colours on recording controls), cool
  as the base palette with its own chip and track (T3), and the brand book. Found
  while doing it: recording borrowed the danger family, and the design system
  documented warm as the light theme. The preview's `vite` entry now attaches to
  the running dev server instead of starting a second copy on port 1420. Steps 1
  and 2 committed by Jon.
- 2026-09-27 — Step 3 implemented: width tiers, Chat and Practice tabs at the top
  and bottom, the place band, Conversations in the chat header, the theme only in
  Settings, the coach drawer and sheet on phones, and the Cards panel. Two
  differences from the reviewed page, both recorded in
  [Stage 4](04-shell-and-modes.md#implemented-build-step-3): the Compact coach opens
  from the header button, and Add cards moved into the Cards panel. No commit.
- 2026-09-27 — Step 4 implemented: one voice panel behind Chat's composer and
  Practice's recorder. Jon's requests during the step were also made:
  - “Practice cards” for the plural labels.
  - The spectrogram in Chat. This took native work (A10), done without moving
    Chat onto the listening session.
  - Vertical resizing for Chat's recording panel and for Practice's reference,
    attempt, attempt list and recording panel.
  - The “Inspect recording” button above the Chat panel removed.
  Details are in [voice input](voice-input.md#implemented-build-step-4); the
  checks are in the build plan's step results. No commit.
- 2026-09-28 — Jon's review of Practice, with changes made:
  - **Cards panel.** At full width it starts folded to its edge tab, with no
    count on the tab. The toolbar's "Practice cards 5/9" button is gone, because
    it duplicated the panel. When the layout is stacked, a cards icon in the
    toolbar opens the drawer or sheet.
  - **Card position.** "5/9" read as progress, so the shown card is now named
    "Card 5 of 9", between Previous and Next.
  - **Attempt card.** It fits its content up to a cap instead of holding a fixed
    height.
  - **Recording panel.** It is its own zone in the place's colour, in Practice
    and Chat. The microphone pad became opaque so a tint cannot muddy it.

  No commit.
- 2026-09-28 — Jon, with changes made:
  - **Chat's place colour is the coach green.** Chat and its coach now share one
    colour, so the split is green for Chat and purple for Practice. This covers
    the top bar band, the Chat tabs and Chat's recording panel. The partner's
    message bubbles and avatar keep the partner colour.
  - **Recording settings in each panel set two things independently:** which side
    the microphone button sits on (Left or Right), and which way time runs across
    the stream (Time → or ← Time, the words the Practice comparison uses).
  - **Choices are kept per panel on this device.** Until one is made, the button
    sits at the end of the reading direction and time runs the same way: the
    interface direction in Chat, the card's script in Practice.
  - **The comparison's time direction no longer moves Practice's recorder.**
  - **Live stream attribute fixed.** The live stream's `data-time` now means what
    the comparison plots' does; it had the opposite meaning.
  - **Labels:** "Microphone button", "Left" and "Right" are new, with drafts in all
    seven languages.

  No commit.
- 2026-09-28 — The thick place-colour band under the top bar and the active tab's
  thick outline became a thin tinted edge with a soft glow. The active tab, top or
  bottom, is raised with a glow in its colour (Jon: the thick line was
  overbearing). No commit.
- 2026-09-28 — Tabs read as tabs:
  - The active tab now opens straight into its page. The line under it came from
    its lift shadow and the bar's glow; both are gone.
  - The place colour is a thin line along the bar that rises around the active
    tab. The tab's glow lights only its top and sides.
  - At Jon's request, phones keep Chat and Practice at the top, in a second row of
    the top bar. The bottom tab bar is removed.

  No commit.
- 2026-09-28 — Jon's review of the bar, the header and the widths, with changes
  made:
  - **The tabs lead the bar.** Chat and Practice come straight after the
    wordmark, before the language, at every width. They are the largest type in
    the bar: bold, at title size. The inactive tab is filled; the active one opens
    into its page.
  - **The bar is one row at every width.** The phones' second row for the tabs is
    gone. To fit:
    - the XP meter is removed;
    - the language shows its endonym, and its English name only at full width;
    - Settings is an icon;
    - AI status is "AI" with its dot, and only the dot on narrow phones;
    - narrow phones drop the "XP" unit from the total.
  - **The chat header is condensed.** Conversation settings and New conversation
    are icon buttons; their names and the settings summary are in their labels and
    tooltips. The XP chip keeps its star beside its total. Coach left the header.
  - **The three widths are now visibly different.** They existed (Full above
    860px, Compact 401–860px, Narrow 400px and below), but Compact reused the
    phone layout apart from drawers instead of sheets, so only two were visible.
    - Full: the coach and cards panels open beside the work and fold to edge tabs.
    - Compact: the coach and the cards are edge tabs on the work's edges, and open
      as drawers from there. The coach is at the end of the conversation; the
      cards are at the start of the stage.
    - Narrow: Coach is a button at the end of the row above the answer, and the
      cards open from the toolbar icon. Both open as sheets from the bottom.
  - **One row above the answer (Compact and Narrow).** Reply help, the status
    line and, when narrow, Coach share it, instead of taking a row each.
  - **Message removed:** "New".

  No commit.
- 2026-09-28 — Build step 6, the conversation start (1c), ahead of step 5 at Jon's
  request. The card has a partner card, topic chips that select, Options folded to
  one line, one start button, and no static copy. Details are in
  [Stage 1](01-first-run.md#implemented-build-step-6). No commit.
- 2026-09-28 — Jon's review of the start card: starting took two presses. Every
  start is now one press, with the large partner start beside the partner, topics
  as action buttons, an open field for the learner's own topic, and Options as an
  easing panel under them. Details are in
  [Stage 1](01-first-run.md#implemented-build-step-6). No commit.
- 2026-09-28 — Jon's third look at the start card:
  - Options moved above the partner.
  - The own-topic heading became the field's placeholder, “Enter your own
    topic…”.
  - The greeting moved into the empty voice panel: “Say hola to start”.
  - Target-language words are bold in the new `target-ink`.
  - The chosen option in every segmented control is filled. Tap / Hold / Auto
    got the same fill.
  - A “Skill” select is built as coming soon (A14).
  - `tr.rich` places elements in translated sentences.

  No commit.
- 2026-09-28 — Jon's review of the top bar and edge tabs:
  - The inactive tab no longer covers the place line.
  - The bar is a touch darker (`--bar`).
  - The line glows along its whole length, and the active tab's glow is
    stronger.
  - The logo stays at every width; its name folds away below 600px.
  - The coach and cards edge tabs have a full border, a 3px coloured edge and a
    glow.

  Details are in [Stage 4](04-shell-and-modes.md) and
  [colour and depth](colour-and-depth.md). No commit.
