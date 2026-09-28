# Stage 1 — first run to first conversation

Status: **settled after seven reviews, 2026-09-27. 1c implemented 2026-09-28
(build step 6, ahead of step 5 at Jon's request; see
[Implemented](#implemented-build-step-6)); 1a and 1b not implemented.** Steps 5
(1a, 1b) and 6 (1c) of the [build plan](build-plan.md). Part of the
[UX design pass](README.md). Decisions are under [Review](#review).

- Proposal: `/tools/design-pass-preview.html` through the UI dev server
  (sections 1a–1c; Desktop/Phone, Palette and Dark toggles; notes numbered per
  artboard). Colours follow the [colour and depth proposal](colour-and-depth.md).
- Current: `/tools/onboarding-live-preview.html` (real `OnboardingSetup`) and
  `/tools/conversation-preview.html` (press “Opening / conversation”).
- Sample content: Spanish, partner Lucía, and topics from `content/`.

## Current flow

Two setup screens (languages, then AI access), then the app opens on an empty
conversation that shows the start card, the composer and the coach pane.
The earlier design rationale is in
[onboarding-design-2026-09-19](../onboarding-design-2026-09-19.md); its decision
point 2 (expand or collapse the conversation options) is still open, and this
stage answers it.

## Findings

Paths are under `ui/src/features/`.

### Choose languages — `settings/onboarding/LanguageSetup.tsx`

- **F1 Two controls in every card.** Pressing the card makes it the starting
  language; the corner ring adds or removes it (`:79`, `:88`). The grid has two
  selection meanings, and a newcomer cannot tell which one they used.
- **F2 The starting language is chosen in two places,** the card and the “Start
  in” select, and that select sits with Continue at the top, before anything is
  chosen (`:63-69`).
- **F3 Each card names the language three times:** the endonym, then “Español
  (Spanish)” under “Español”.
- **F4 Two full-width selects below the grid:** “Explanation language” (jargon) and
  “Interface language”, which is already set from the device (`:106-107`).
- **F5 A partner with no identity:** “You will be talking with Lucía” names someone
  the learner knows nothing about; the variety select sits inside that note
  (`:99`).

### AI access — `settings/onboarding/OnboardingSetup.tsx`, `settings/access/SettingsAccess.tsx`

- **F6 Settings layout on a first-run screen.** An “AI access” label, route tabs
  (Hosted sign-in / Custom URL) and a “SkellySpeak account: Not signed in” row come
  from the Settings panel.
- **F7 Four paragraphs of fine print** at the same weight as the action: costs,
  payments, free software, and voice and microphone (`:54-57`). The microphone note
  only matters at the first recording.
- **F8 Three bottom buttons of equal weight:** Continue (disabled until connected),
  Back and Set up later (`:60-63`). After a successful sign-in, nothing points to
  the next step.

### Empty conversation — `conversation/session/ConversationStart.tsx`, `ConversationChoices.tsx`, `CoachChoices.tsx`, `conversation/ConversationPage.tsx`

- **F9 Up to eleven controls start the conversation:** Let Lucía start, Say hola,
  four Practice-selection buttons, up to three topic cards, Custom topic, and the
  composer.
- **F10 Choice-looking buttons start an AI request on click.** Every
  Practice-selection button and topic card begins a partner-first conversation
  immediately (`ConversationStart.tsx:85`, `onChooseTopic` → `start`). Difficulty
  and Grammar practice beside them are ordinary settings. Both kinds share the
  `scene-card` look.
- **F11 Contradictory labels.** “Let the persona decide” sits under the label “Let
  the coach decide” and does the same as “Let Lucía start” (`CoachChoices.tsx:12-13`).
- **F12 Practice selection depends on recorded experience,** which a first-time
  learner does not have. Its explanation lives in an info tip (“retry effort”).
- **F13 “All partners” opens the conversation list,** filtered to the current
  partner (`ConversationPage.tsx:575` `onSwitchPartner` → `setHistoryOpen`, with
  `contactChats` at `:535`). “Edit persona” opens the profile editor. Neither lists
  partners.
- **F14 “Customize…” opens the Conversation Prompt Creator,** a second copy of the
  same choices plus YAML and the prompt preview (`ConversationPromptCreator.tsx`).
  It is also in Conversation settings. A power tool sits at the same level as the
  primary choices.
- **F15 Emoji glyphs:** content glyphs on topic cards (☕), and ✎ on Custom topic
  (`ConversationChoices.tsx:41`).
- **F16 An empty coach pane takes roughly a third of the window** on desktop before
  there is anything to coach.
- **F17 The composer is a start path that does not say so** (“Write in Español…”).
- **F18 The partner’s authored identity is unused.** `content/languages/*.yaml`
  gives each default partner an occupation, city, current situation, interests and
  manner; the start card shows a name and an emoji.

## Proposal

### 1a Choose a language

- The screen is a window-height frame with three parts: the heading pinned at the
  top, the language list scrolling in its own recessed well, and an action bar
  pinned at the bottom. Continue is always on screen and never moves. Chosen over
  auto-scrolling, which moves the page under the pointer, and over a top button,
  which comes before the choice (F2).
- One tap chooses the language to start with; cards are single-choice radio
  items with a check mark state and no corner control. Other languages are added
  later from Browse languages, which already manages membership (F1, F2).
- Each card shows its own name, a greeting, and the name in the interface language
  only when it differs (F3).
- The action bar has four fixed slots on one row at every width: the chosen
  language (greeting and name), its variety (a menu, or the name when there is
  only one), “Explain in”, and Continue. Nothing appears or disappears, so the row
  never changes shape (F2, F4).
- App language becomes a compact control in the header, defaulting to the device
  language as now (F4).
- The partner introduction moves to the first conversation (F5).

### 1b Sign in

- One primary action: Sign in with Google (F6).
- “Use your own server” and “Costs and free software” are collapsed disclosures
  with the existing copy. The microphone note moves to the first recording (F7).
- After sign-in: a confirmation row with the account and “Use another account”, and
  Continue becomes the next step. Back is a text link above the title; “Set up
  later” stays as a secondary button (F8).
- Access routes, credentials, validation and errors stay in `SettingsAccess`. It
  gains a first-run presentation that folds the route choice into “Use your own
  server”; there is no second implementation.

### 1c Start the first conversation

- One reading order: partner → topic → options → start (F9).
- Topic chips select; they do not start. Default “Lucía chooses” replaces “Let the
  persona decide” / “Let the coach decide” (F10, F11).
- One start button on the card, “Lucía starts”. The learner-first path is the
  input below: with the [voice input](voice-input.md) panel, the empty stream
  points at the microphone with “Press the microphone to start”, and Type opens a
  text box (F9, F17). The start card carries no instruction of its own; the earlier
  “or start yourself below” was removed with the other static copy.
- The three voices are introduced by colour: the partner card and avatar ring in
  the partner colour, the folded coach tab in the coach colour, selections in the
  “you” colour.
- Options, collapsed and summarised on one line (“Beginner · Any time”):
  Difficulty, Time frame (was Grammar practice), Skill focus (was Practice
  selection; shown once there is recorded practice), and Prompt details… (was
  Customize…) (F12, F14).
- Partner card with occupation and city from the authored persona. “About Lucía”
  opens the existing profile dialog; “Change partner” opens the existing partner
  picker (F13, F18; needs [A5](README.md#deferred-native-ai-content-or-state-model-work)).
- Topic chips are text: the target-language label, with the translation under it
  (F15).
- The coach follows the three widths ([Stage 4](04-shell-and-modes.md#three-widths)):
  open beside the conversation at Full, showing only its Ask box until there is
  coaching; an edge tab at Compact; a header button at Narrow (F16).
- Partner facts (occupation, city) appear in the learner's explanation language
  (decided; content and prompt work in A5 and A12).

## What does not change

- Native commands and payloads: onboarding still saves languages and completes
  through `useOnboardingStore`; access uses the existing `SettingsAccess` commands;
  starting sends the same `startConversation` action with the same
  `ConversationStartConfig`. Topic, difficulty, time reference and recommendation
  mode keep their meanings.
- Content, rewards, evidence and statistics.

## Implementation sketch, after approval

- `LanguageSetup.tsx`, `styles/features/settings/onboarding.css`: single-choice
  cards, footer, header app-language control.
- `OnboardingSetup.tsx`, `SettingsAccess.tsx`: first-run presentation of the same
  access component.
- `ConversationStart.tsx`, `ConversationChoices.tsx`, `CoachChoices.tsx`,
  `styles/features/conversation/start.css`: topic radio chips, Options disclosure,
  one start button, skill focus hidden until evidence exists. The Prompt Creator
  keeps reusing `ConversationChoices`, so its behaviour must be checked there too.
- `ConversationPage.tsx`: Change partner opens `PersonaPicker`; the coach follows
  the width tiers (build step 3). The empty conversation's input is the voice
  panel's empty state (build step 4); `ComposerInput.tsx` needs no start-specific
  label.
- Partner facts on the card wait for A5 (facts in the explanation language); until
  then the card shows the name and avatar, as today.
- All seven interface dictionaries for new and changed strings.
- Tests: “choosing a topic does not start the conversation”, single-choice first
  run, sign-in confirmation state, the language bar's four slots; update existing
  `ConversationStart`, `OnboardingSetup` and `ConversationChoices` tests.
- Verification: UI tests, `previews:check`, `styles:check`, localization checks,
  and a fresh-workspace walkthrough in the running app (language → sign in →
  start, and Set up later).

## Implemented (build step 6)

2026-09-28, branch `ux-design-pass`, uncommitted.

- **One reading order.** The start card is the partner, the topic, the Options row
  and one start button, at most 40rem wide, with no instructions of its own
  (`session/ConversationStart.tsx`, `styles/features/conversation/start.css`).
- **Partner card,** in the partner colours: the avatar in a partner-coloured ring,
  and the name.
  - “About {name}” opens the existing profile dialog.
  - “Change partner” opens the chat header's partner menu. `PersonaPicker` gained
    `open` and `onOpenChange`. It moves focus to the current partner when it
    opens, and back to its toggle on Escape.
  - Occupation and city wait for A5.
- **Topic chips select; only the start button starts.** “{name} chooses” is the
  default. Each built-in topic shows its target-language name, its romanization
  where there is one, and its translation when that differs; the glyphs are gone.
  “Your own topic” opens the existing dialog, and using a topic selects it; the
  chip then shows the text. The choice goes with whichever start follows. The
  page already sent the start configuration with the learner's own first message.
- **Options** fold to one line that states their values (“Beginner · Any time”).
  Open, they show segmented choices for Difficulty (all five levels) and Time
  frame (was Grammar practice; “Any time” was “No preference”). Below them,
  “Prompt details…” (was Customize…) opens the Conversation Prompt Creator.
- **Skill focus** (was Practice selection) appears once the language has recorded
  experience, or when a focus is already set. Its info tip keeps each mode's live
  preview. A focus shares the configuration's topic slot (`TopicChoice`):
  - choosing a focus shows “{name} chooses” as the topic;
  - choosing a topic clears the focus;
  - the summary line names a focus that is set.
- **One start button,** “{name} starts”.
- **The coach** on an empty conversation already showed only its tabs and Ask box
  at Full. Compact's edge tab and Narrow's button came with the width work.
- **Shared pieces:**
  - `session/StartChoices.tsx` (the topic chips, the option rows and the summary)
    replaces `ConversationChoices.tsx` and `CoachChoices.tsx`.
  - The Prompt Creator shows the same pieces unfolded, with Skill focus always
    offered.
  - The segmented choice is a shared control,
    `components/controls/SegmentedChoice.tsx` (`.segmented` in `buttons.css`, and
    a SegmentedChoice card in the design system). The voice panel's Recording
    settings use it too.
- **Removed from the card:**
  - “Say {greeting}”: the microphone below is the learner's start.
  - “All partners”: it opened the conversation list (F13).
  - The topic glyphs.
  - The labels “Let the coach decide” and “Let the partner decide”.

**Where this differs from the reviewed page:**

- Topic chips are toggle buttons (`aria-pressed`) in a labelled group, like the
  app's other choice buttons, rather than radio buttons.
- Skill focus has a “No focus” choice for clearing it.
- The authored starter greeting (“Say hola”) was not shown anywhere for a while.
  *Settled at Jon's third look: it is in the voice panel's prompt; see below.*

**Changed the same day at Jon's review: every start is one press.** Selecting a
topic and then pressing start took two clicks. This reverses “topics select, then
one Start” (first review); F10 is answered instead by making the topics look like
actions.

- **The partner box** is shorter, with a large “{name} starts” beside the name. In
  the narrow layouts it takes its own row under the name.
- **“Or pick a topic”**: each topic is an action button with an arrow at its end,
  and starts the conversation. Topics saved for later are listed after the
  built-in ones and start the same way. “{name} chooses” is gone from the card,
  because the partner's own start is exactly that.
- **“Or your own topic”** is an open text field with its own Start (Enter works
  too) and a “Save for later” checkbox. A topic that is already saved is not
  saved again. The dialog remains in the Prompt Creator.
- **“…or send a message to begin”** closes the list, above the composer.
- **Options** are a panel of their own, under every start: a bordered bar with
  depth that names the current values. It eases open (0.32s, none under reduced
  motion) without moving any start, then scrolls itself into view if it opened
  below the fold. A topic set in Prompt details is named in its line, since the
  partner's start and the first message use it.
- The Prompt Creator keeps the selecting chips, including “{name} chooses”, for
  the configuration it applies.
- New strings: “Or pick a topic”, “Or your own topic”, “…or send a message to
  begin”.

**Open question (Jon): what the partner's start draws on.** Today:

- The partner's own start, with no skill focus, has no coach involvement. The
  opening prompt gets the partner's background and one of the authored opening
  situations, chosen per conversation (`conversation_prompt::system`).
- With a skill focus, the coach picks a skill from recorded experience and retry
  effort (`recommendations::capture`), and the partner's instructions gain that
  skill's guide.
- A topic replaces the opening situation with that subject. A first message from
  the learner is the first turn, with the same instructions.

Undecided: whether the partner's start should default to the coach's choice once
there is recorded practice.

**Changed again at Jon's third look, 2026-09-28:**

- **Options come first,** above the partner, still folded to one line. Opening
  them pushes the starts down, eased as before.
- **Your own topic** has no heading; the field's placeholder says “Enter your own
  topic…” and names it (its label is “Your own topic”). “Save for later” stays
  under it. “Or pick a topic” stays above the topics (kept from the previous round).
- **The greeting is back, in the voice panel.** In a new conversation, the empty
  face says “Say hola to start”, with the authored greeting and its romanization
  where there is one. A new `tr.rich` places the styled greeting wherever each
  language's sentence puts it; the localization tools check and count it like
  `tr`. The open question about `starterGreeting` is settled.
- **Target-language words scan apart:** a topic's name and the greeting are bold
  serif in `target-ink` (`.target-word`, `components/reading.css`), a new token:
  dark blue, or light blue in dark themes. Translations and romanization keep
  their style. Saved topics stay in the interface style, because they are the
  learner's own words in either language. The Prompt Creator's topic chips follow
  the same rule.
- **Selections are visible:** the chosen option of a segmented choice is filled in
  `interaction-fill` with `ink-on-fill` text, as Practice's comparison toggles
  already were. The voice panel's Tap / Hold / Auto matches.
- **Skill, coming soon.** Under Skill focus, a “Skill” select like Practice's
  Add practice cards (“Any skill”) is built but disabled, with “Coming soon” on
  hover. It waits for A14 in the [README](README.md#deferred-native-ai-content-or-state-model-work)
  (a practice target separate from the topic). The same change lets a topic start
  keep a skill focus; `BACKEND:` comments mark both places.

## Review

2026-09-27, Jon:

- **Agreed:** the first-run language step with one language, the sign-in screen,
  and the start screen (“nice and simple”), which includes select-then-start
  topics. The cleaned global row was liked too.
- **Changed:** Continue must not be missed when the list scrolls. Jon offered a top
  button, auto-scroll, or a scrolling list between a pinned heading and a pinned
  bar; the proposal now uses the pinned frame (1a above).
- **New direction:** use colour and depth to organise the app
  ([colour and depth](colour-and-depth.md)) and make Chat and Drill tangible tabs
  ([Stage 4](04-shell-and-modes.md)).

## Open questions

1. ~~Coach pane folded on an empty conversation?~~ Answered by the three widths
   (sixth review): open at Full with only its Ask box, an edge tab at Compact, a
   header button at Narrow.
2. ~~Persona facts: which language?~~ The learner's explanation language (fifth
   review); content and prompt work in A5 and A12.
3. Default topic label: the reviewed page uses “Lucía chooses” (the partner's
   name); kept unless changed.

## Deferred from this stage

- Content: persona facts need one language across content files (A5).
- Remembering last-used start options as defaults is a native preference (A7).
- Advancing automatically after sign-in depends on sign-in callback timing on each
  platform; keep an explicit Continue until that is checked.
