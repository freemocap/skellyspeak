# Build plan — first batch

Status: **agreed 2026-09-27; steps 1 and 2 committed on branch
`ux-design-pass`; steps 3 and 4 implemented, uncommitted; step 5 next.** Part of
the [UX design pass](README.md).

The design decisions below are settled in the stage notes and the review page
(`/tools/design-pass-preview.html`). This note turns them into ordered, reviewable
changes and lists what must survive them.

## Decided, and in this batch

- **Vocabulary** ([README](README.md#vocabulary)): Chat and Practice tabs; card,
  reference, attempt and match in Practice; partner; Add to Practice; Add cards;
  Auto-send; Tap, Hold and Auto; Detect attempts. Follow-on renames: “Practice XP”
  → “XP”, “Practice progress” → “Progress”, “Practise this in conversation” → “Use
  this in a conversation”, and Progress's assessed-message “attempt” → “assessment”.
- **Colour and depth** ([colour-and-depth.md](colour-and-depth.md)): six identity
  colours on the cool neutral palette; side panels and edge tabs neutral with a
  2px coloured edge; no surface wash; the live-microphone red replaces the magenta
  recording accent; the cool palette's beige `--chip` and `--track` fixed (T3).
- **Three widths and tabs** ([04-shell-and-modes.md](04-shell-and-modes.md)):
  Full, Compact and Narrow; tabs at the top at Full and at the bottom otherwise;
  the coach and cards side panels open beside, as a drawer, or as a sheet.
- **Voice panel** ([voice-input.md](voice-input.md)): one component for Chat and
  Practice; microphone icon only, calm blue when ready and red with a red outline
  and glow while recording; one arrow and one sentence in the empty stream; Tap,
  Hold and Auto under the pad; one control row; Chat's draft with its own Send;
  Chat's Auto shows “Coming soon”; Practice keeps Detect attempts and today's
  recording settings.
- **First run** ([01-first-run.md](01-first-run.md), 1a and 1b): one-language
  choice in a pinned frame with a four-slot bar; sign-in with one primary action.
- **Conversation start** (1c): partner card, topic chips that select, Options on
  one line, one start button, no static copy.

## Preserve: nothing is removed

Each step moves, restyles or regroups existing behaviour. Removing any capability
needs its own explicit decision. The mockups leave out parts that are not being
redesigned yet; those parts stay as they are. Checked against the source on
2026-09-27.

**Practice** (today's Drill, `ui/src/features/drill/`):

- Reference playback (“Hear it”, to become “Play reference”) and voice speed.
- The reference and attempt comparison: both spectrograms, Fit / Same scale /
  Align words, time direction, scrubbing with the playback cursor, word timing
  overlays and word-by-word pairs.
- The attempt report: the match and its states (exact, not scored, low
  confidence, different script, no speech), length, speaking time, pace, pauses,
  and the normalisation note.
- The card summary across recent attempts: best, latest, last three, and the word
  most often different.
- Attempt history and selection, deleting an attempt, and Clear attempts (was
  “Clear takes…”). Queued attempts keep processing after Stop; the queued and
  ignored counts move next to the attempt list.
- Card analysis (the shared grammar explanation).
- Previous, Next and Random card, on the Practice stage.
- The card list: selecting a card, and deleting a card with its attempts.
- Add cards: lengths, chat lines, skill, topic, difficulty and count, and the
  candidate review (Keep, From your chats, Already in your cards). Add to Practice
  from chat messages.
- Recording: Tap, Hold and Auto (today's Live), Detect attempts (today's “Auto
  detect takes”; off keeps listening without making attempts, and can change
  mid-session), the level meter with its draggable threshold, microphone choice,
  and the settings for the pause that ends an attempt, the silence that stops
  listening, and the shortest sound kept.
- Recording storage limits, microphone errors with their details, and the phone
  attempt history.

**Chat:** translation, word by word, word help, analysis, feedback and scores,
edit and resend, recording inspection, Add to Practice, rewards and XP, reply
help, the coach panel's Coach and Experience tabs, AI activity links, error
details and retries, conversation settings and export, partner picker, profile and
new partner, conversation history.

**First run:** resumable onboarding, Set up later, device-language defaults, and
every access route with its validation and errors.

**Inspection views** keep their technical terms, including AI activity's request
“attempts”.

## Steps

Each step is one reviewable change, verified before the next starts.

1. **Vocabulary and copy.** Interface strings in all seven dictionaries, tests
   that match on text, and the `LiveRecording` region label. No layout change.
   Internal identifiers such as `practiceView = 'drill'` and the `live` mode stay,
   so stored data is untouched. *Implemented 2026-09-27; see
   [translations-step-1.md](translations-step-1.md).*
2. **Tokens and colour.** Role tokens for light and dark in `tokens.css`; live red;
   T3; brand book and token usage notes; `npm run design-system`. *Implemented
   2026-09-27; see [colour and depth](colour-and-depth.md#implemented-build-step-2).*
3. **Shell: widths, tabs, side panels.** A width-tier hook that keeps today's
   “mobile” behaviour for Compact and Narrow; a 400px breakpoint in the style
   checker (A13); top and bottom tabs with the mode band; Conversations into the
   chat header and the theme toggle into Settings; one side-panel component holding
   today's coach tabs and today's phrase list as cards. *Implemented 2026-09-27;
   see [Stage 4](04-shell-and-modes.md#implemented-build-step-3), including where it
   differs from the reviewed page.*
4. **Voice panel.** One component replacing the looks of `ComposerInput` and
   `RecordDock`; recording logic stays in `useMicRecorder`, and Practice keeps every
   control listed above. *Implemented 2026-09-27, with Jon's requests during the
   step (Chat spectrogram, resizable panes, the Inspect recording button removed);
   see [voice input](voice-input.md#implemented-build-step-4).*
5. **First run** (1a, 1b).
6. **Conversation start** (1c). Partner facts on the card wait for A5; until then
   the card shows the name and avatar, as today.

Later stages, not this batch: Chat's bubbles, help surfaces and coach content
(Stage 2); the Practice comparison and report layout (Stage 3); Progress and
Skills as a destination and the navigation-state cleanup (Stage 4); T1; the
native and AI items A2–A13 in the README.

## Verification, per step

- `npm test`; `npm run build`, which runs the diagnostics and dictionary checks
  first; `npm run localization:test`; `npm run styles:check`;
  `npm run design-system:check`; `npm run previews:check`.
- The review page and the production preview fixtures at Full, Compact and
  Narrow, light and dark, and in a right-to-left language.
- The desktop app for each step's flows (see answer 3). First run is replayed
  with Settings → Restart onboarding; no workspace data is reset.
- No commits unless asked; each finished step is reported with its checks.

## Answers (2026-09-27: yes to all)

1. **Order:** the six steps as listed.
2. **Translations:** drafted for all seven languages and listed for review by
   native speakers.
3. **Running app:** Jon's dev build stays running from this checkout and reloads
   with each edit; each step is reported with what to try there.
4. **Branch:** `ux-design-pass`, nothing committed until asked.
5. **T1:** out of this batch; its own focused pass
   ([font coverage note](../language-font-coverage-2026-09-20.md)).
6. **Phones:** phone widths in the browser during the batch; real phones at the
   end.

## Step results

**Step 1, vocabulary (2026-09-27).** 115 English messages became 110 in all seven
dictionaries (1,381 → 1,366 messages); 69 source and test files use the new
wording, plus the tour, the design-system preview and two hand-written
design-system notes. Checks: `npm test` 1,382 passed; `npm run build` passed,
including the dictionary and source checks; `npm run localization:test` passed;
`npm run localization:audit` reports 0 removal candidates; `npm run styles:check`,
`npm run previews:check` and `npm run design-system:check` passed after
regenerating the design-system bundle. Browser: the Practice tour demo, the
Progress report in English, Arabic, German and Mandarin, the onboarding language
step, the partner menu, and the New conversation button in three languages.

**Step 2, colour tokens (2026-09-27).** Identity token families for light and dark;
the recording family replaces the magenta accent and the danger colours on the
recording controls; cool light is the base palette with its own chip and track
(T3); the brand book, token usage notes and generated design system are updated.
Checks: `npm test` 1,382 passed; `npm run styles:check`, `npm run previews:check`
and `npm run design-system:check` passed. Browser: computed tokens compared before
and after for light and dark with no palette, cool and warm (only the intended
changes); the chat microphone and the Practice record button measured idle and
recording in light and dark; the Practice demo screenshot while recording; the
review page reads the production tokens.

**Step 3, shell, widths and side panels (2026-09-27).** Width tiers; Chat and
Practice tabs at the top and at the bottom; the place colour on the top bar's band;
Conversations in the chat header; the theme toggle only in Settings; the coach's
edge, edge tab, drawer and sheet; the Cards panel, edge tab, drawer and sheet.
Three strings that were no longer used were removed from all seven dictionaries
(1,366 → 1,363 messages). Checks: `npm test` 1,382 passed, including new tests
for the chat header's Conversations button, the phone coach and Escape, the top
bar's tabs and the Cards panel; `npm run build`, `npm run localization:test`,
`npm run localization:audit` (0 candidates), `npm run styles:check`,
`npm run previews:check`, `npm run design-system:check` and the architecture tests
passed. Browser: the conversation preview at 1120, 430 and 375px (tabs, band,
header buttons, coach drawer and sheet opening and closing, folded edge tab); the
Practice demo at full width (Cards panel), 430px (drawer) and 375px (sheet); the
real app shell switching tabs and band colour.

**Step 4, voice panel (2026-09-27).** One `VoicePanel` behind Chat's composer and
Practice's recorder, as recorded in
[voice input](voice-input.md#implemented-build-step-4), with Jon's requests during
the step:

- “Practice cards” for the plural labels; a single one stays “card”.
- The spectrogram in Chat, from the recording's own live analysis. This adds two
  native commands, `mic_spectrogram` and `mic_push`, plus `live_view.rs`.
- Vertical resizing for Chat's recording panel and for Practice's reference,
  attempt, attempt list and recording panel.
- The “Inspect recording” button above the Chat panel removed.

Strings: +5 and −1, giving 1,367 messages. Draft translations are listed in
[translations-step-1.md](translations-step-1.md#added-in-step-4).

UI checks: `npm test` 1,386 passed, including new tests for:

- the grips and their stored heights;
- the Chat stream with a spectrogram;
- the single recording's spectrogram polling;
- phone copies alongside the WAV;
- the removed button.

These also passed: `npm run build`, `npm run contracts`, `npm run localization:test`, `npm run localization:audit` (0 candidates), `npm run styles:check`, `npm run previews:check`, `npm run design-system:check` and the architecture tests.

Native checks:

- `cargo fmt --check` passed, and the new native tests pass.
- `cargo test --lib`: 673 passed and 1 failed. The failure is
  `practice_feedback::guidance_updates_reach_capture_without_erasing_experience`.
  It copies every entry of `content/shared` and stops at an empty, untracked
  folder, `content/shared/letter-inventories`; it is unrelated to this step.
- `cargo clippy --lib --tests -D warnings` stops on an existing
  `single_element_loop` in `configuration/latin_language_tests.rs`, and reports
  nothing in this step's code.

Browser:

- The Chat fixture at 961 and 529px: the recording face (waveform over the
  spectrogram), the red pad under hover, and dragging the grip.
- The Practice fixture at 540px (stacked: three grips, and the attempt list
  growing to all seven takes) and at 1280px (the reference and recording grips;
  the attempt grip hidden).

Not yet checked: a real recording in the desktop app, and phones.
