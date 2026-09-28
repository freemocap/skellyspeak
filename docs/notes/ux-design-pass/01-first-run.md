# Stage 1 — first run to first conversation

Status: **settled after seven reviews, 2026-09-27. Not implemented.** Steps 5
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
