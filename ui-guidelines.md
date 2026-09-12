# Interaction rules

- Open directly into a usable chat. Create defaults automatically; never require a
  title, partner form or tutorial completion before composing.
- Preserve the reference voice-first composer: inline text, prominent Record/Stop
  and Send. Keep Lesson/Analysis with a docked Talk to your coach beside the chat.

- AI and Profile are toolbar surfaces. AI supports a resizable dock and separate
  window. Keep account and token details in Settings → AI access.
- Settings uses searchable section navigation and compact controls. Preferences
  save automatically, including API keys, models and conversation practice settings.
  Show pending/error state and finish pending writes before closing. Clicking the
  backdrop dismisses modals; clicks inside the panel do not. Credential validation
  uses a compact green check/red X with accessible labels and error detail, not a
  validation button.
  Saved credentials have no reveal control; password inputs mask replacement keys.
  The saved-key status icon becomes a red X on hover or keyboard focus. Clicking
  opens a confirmation; deletion requires a separate Delete key action.
  Keep the feature inventory in `UI-SURFACES.md` current as functionality ships.

- Use a dark navy shell and analysis pane, a light paper chat canvas, blue accents,
  compact controls and the SkellySpeak logo. Chat is the primary surface.
- The toolbar opens a partner chooser in place of chat history. Desktop uses
  adjacent chat and lesson/analysis panes; narrow windows use Chat and Lesson tabs.
- Flowers belong only to evidence visualization in the analysis pane. Do not use
  flower branding, decorative garden landing pages or lifestyle marketing copy.

- Contacts and conversations are the primary navigation vocabulary. Difficulty,
  composing help, coach proactivity, translation, pronunciation and romanization
  belong to a conversation. Difficulty is a compact dropdown immediately beside
  Native in the language row. Other practice controls stay in the gear panel,
  closed by default.
- Keep useful content central and secondary controls compact. Do not display invented
  progress, flowers or statistical samples as learner data.
- Show pending writes and errors. Preserve unsaved form input on failure. Confirm
  deletion with its concrete scope; archive remains a separate reversible action.
- Use native form semantics, visible focus, accessible names and touch-sized actions.
  Every hover interaction requires a keyboard/touch equivalent. Support narrow
  windows, enlarged text, long names and RTL text.
- Avatars are static mathematical shapes with persistent recipes. No generated
  imagery, faces or animation. Visual recipes cannot change domain progress.
- Suggestions, when implemented, sit in a compact tray above the composer; insertion
  is distinct from word inspection and never sends automatically. Only Understand
  the exchange collapses. All reading surfaces respect conversation preferences.
- Inspect the real application at desktop and narrow widths; unit tests alone do
  not establish visual or native-device correctness.

## Copy and density

- Use plain functional labels. No marketing copy, slogans, promotional headings,
  saccharine encouragement or filler. Do not add phrases such as “Your keys,
  together,” “Connect directly,” “Your endpoint,” or “Make it yours.”
- Name the action, setting or state. Add explanation only when needed to operate
  a control or understand its consequences. Do not repeat tab labels as headings.
- Keep settings compact: adjacent related inputs, restrained padding, short helper
  text and collapsed secondary details. Preserve readable text and usable targets.
- AI access lives in Settings, with Hosted sign-in / API keys / Custom URL tabs.
  Each tab includes a radio indicator. Activating a tab selects the AI route;
  the selected panel and indicator reflect the persisted choice.
  Credential edits and sign-in never change the active route.
  Render these as page tabs joined to their content panel, not segmented buttons.
  OpenRouter and Groq key inputs stay together, before model preferences.
  Do not add an API-key or custom-endpoint button to the application toolbar.

### Conversation header density acceptance

- Difficulty reuses the language selects’ exact class, height, padding and font.
  Its selected option names the value; the accessible name is Difficulty. Do not
  add a heading, slider, stop labels, bold selection layout or vertical padding.
- Give the controls strip its own existing chrome surface and visible boundary
  against the paper conversation canvas, without increasing its geometry. Use
  common region and contrast to separate controls from message content (see
  [NN/g visual-design principles](https://www.nngroup.com/articles/principles-visual-design/)).
- Keep Learning, Native and Difficulty in one compact row at the reference
  approximately 590px chat-pane width, including the real adjacent header actions.
  Use constrained columns so long option lists cannot force Difficulty below the
  language controls. At narrow widths keep the three selects together; header
  action buttons may move below. Accessible language names remain available when
  compact visual labels are hidden.
- Measure header height and each select’s height at both widths, inspect a review
  image and compare the header’s share of the chat canvas. No overflow alone does
  not establish acceptable density. Fixtures must include the actual surrounding
  controls and width constraints, the complete registry option lists and a long
  option stress case; a one-option or full-width isolated control is insufficient.

## CSS ownership and verification

- `src/styles/` is the stylesheet root. `index.css` is the import manifest and the
  only sheet `src/main.tsx` loads; every other sheet is owned by one surface. Add a
  rule to the file that owns the component, never to `index.css`, and never append a
  second definition of the same selector group in the same media scope — including
  in a different file, which `npm run styles:check` rejects.
- Shared element defaults cover typography, focus and basic controls. Shared
  selector groups are intentional reuse, not a place to assign component geometry.
  Theme selectors must not unintentionally defeat component colors or states.
- Do not use `!important`. The resizable coach dock height is measured in the
  component and applied to that element, so media rules own the resulting
  desktop/mobile geometry rather than a shared custom property. Custom properties
  written from TypeScript are declared with their defaults in `tokens.css`; add a
  new one there, with the writer named in the comment, rather than leaving the
  contract implicit.
- Prefer 4/8/12/16px spacing for new compact controls and panels. Choose 8–12px
  interior spacing before increasing it; keep touch targets usable independently
  of surrounding padding. Do not shrink all existing controls mechanically.
- Use existing surface, text, border and accent variables. Introduce semantic
  tokens for recurring new roles, rather than repeated literal colors.
- Remove unused component selectors with the component. Check dynamic class names
  and shared selector groups before removing anything based on a text search.
- Run `npm run styles:check`, `npm run build` and `npm test`. The style check rejects
  exact repeated selector groups within the same at-rule scope, repeated properties
  within a rule and `!important`. It does not detect all overlapping selectors,
  shorthand conflicts, unused rules or visual defects.
- Review desktop/narrow layout, keyboard focus, reading scale and light/dark surface
  contrast in the running app. Automated source checks do not replace that review.

## Compact conversation surfaces

Conversation chrome summarizes Learning, Native and difficulty; editable selectors
live in the expandable gear controls. Keep gear and new-chat actions on the same
row on mobile. The dark Coach pane has XP and Persona tabs; no Analysis tab.
Conversation XP attributes existing credit to that conversation. Language progression
uses the same map over all selected-language evidence. Maps start expanded on mobile.
Static explanatory copy belongs behind an accessible information control (hover,
keyboard focus or tap), not permanently visible paragraphs. Keep dynamic feedback,
errors and explicitly requested development placeholders visible and concise.
