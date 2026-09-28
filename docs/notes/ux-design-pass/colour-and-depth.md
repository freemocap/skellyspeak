# Colour and depth

Status: **settled after the seventh review; tokens implemented 2026-09-27 (build
step 2, see [Implemented](#implemented-build-step-2)).** The colours are applied to
screens in later steps. Part of the [UX design pass](README.md); applies to every
stage. Review page section A: `/tools/design-pass-preview.html#dp-colour`, which
now reads the production tokens.

## Why

Jon's review of the first proposal: the app reads as colourless, and with this
much going on, colour and depth should help people orient. Learning a language
is taxing, so the interface around it should be calm and predictable: surfaces
that say what they are, places that look like places, and full control on
request rather than on screen.

## Current use of colour (observed)

- The default appearance palette is cool (`DEFAULT_APPEARANCE.palette = "cool"`
  in `ui/src/generated/contracts.ts`): grey ground, white sheets, one blue
  accent. The comment in `tokens.css` still says warm is the default.
- Warm and cool mark partner and learner bubbles only. In the dark theme partner
  bubbles are neutral grey by an existing decision, to keep reading aids clear.
- Colours are borrowed across meanings. The Progress pill uses the partner-bubble
  colours with the warning amber for its star (`styles/shell/layout.css:324-328`).
- In the cool palette `--chip` and `--track` stay warm beige (`#dbd4c5`,
  `#e2dac6`) against a grey ground, because the cool override does not set them.
  The Chat/Drill switch background is `--chip`.
- Chat and Drill have no colour of their own; the switch is a grey pill.

## Proposal: six identity colours

Each colour has one meaning. `mark` is for small saturated marks (tab edges,
dots, avatar rings); `tint` for pale surface washes; `line` for borders; `ink`
for text.

| Role | Means | Light mark · tint · line · ink | Dark mark · tint · line · ink |
| --- | --- | --- | --- |
| You | Your messages, your choices, every control you press | `#3d74c9` · `#e4edfb` · `#a9bfe3` · `#1f4785` | `#6fa3ea` · `#213350` · `#41618f` · `#9cc0f2` |
| Partner · Chat | Your partner, what they say, the Chat tab | `#e08a3c` · `#fff0df` · `#e8bf8a` · `#8a4f12` | `#f0a35e` · `#3a2e22` · `#8a6238` · `#f3bd85` |
| Coach | Help with your messages and with replying | `#3f9a6a` · `#e6f3eb` · `#9fd0b3` · `#22613f` | `#6cc995` · `#1f3329` · `#3f7d5a` · `#8fdcb0` |
| Practice | The Practice tab and its cards | `#7a5cd6` · `#eeeafc` · `#c3b3ef` · `#4e3590` | `#a58cf0` · `#2b2645` · `#6a58a8` · `#c3b1f5` |
| Progress | XP, skills and rewards | `#d9a21b` · `#fdf3d6` · `#e8c766` · `#7a5600` | `#f2c14e` · `#352d17` · `#8a7430` · `#f2cd6b` |
| Live microphone | The microphone is on and recording | `#d92d3a` · `#fde8e9` · `#f0a3a8` · `#a01d28` | `#f04a56` · `#3b1c20` · `#9e3d45` · `#ff9aa2` |

“You” reuses the existing interaction blue and learner-bubble hues, so blue keeps
meaning “you and what you can press”.

Contrast, computed with the WCAG formula: every ink is at least 5.6:1 on the
light sheet, ground and its own tint, and at least 6.8:1 in the dark theme.
Primary text on each tint is at least 11:1. Live microphone, added after the voice-input review: ink 7.8:1 (light) and 7.5:1 (dark)
on the sheet; the white icon on the live pad is 4.8:1 (light) and 3.6:1 (dark). It
replaces the magenta `--recording-accent`, so the microphone has one colour. The
ready microphone uses the “you” colours (tint surface, line outline, ink icon), so
red appears only while recording.

### Rules

1. **One meaning per colour.** A colour never stands for two roles.
2. **Blue stays the only action colour.** Identity colours mark places and voices
   and never fill a button, so “what can I press” is always blue.
3. **Pale for areas, strong for marks.** Large surfaces get tints; saturated colour
   is limited to small marks. Most of the screen stays neutral.
4. **Colour always comes with a word or icon.** Tabs, pills and cards are labelled.
5. **Existing meanings stay.** Success, warning and danger keep their families and
   words. Skill-domain colours stay inside progress data.
6. **Dark partner bubbles stay neutral** (existing decision); the partner colour
   moves to the partner card, the Chat tab and the surface edge.

### Depth roles

Depth already exists as tokens; this assigns each level a meaning.

| Level | Means | Tokens |
| --- | --- | --- |
| Ground | Behind everything | `--bg` |
| Raised | Where you work: the conversation, the Practice stage, the setup sheet | `--sheet`, `--shadow-surface` |
| Recessed | What you pick from or refer to: lists, the coach pane, inspectors | the `--coach-surface` recipe, `--shadow-recessed` |
| Floating | What needs an answer now: dialogs, menus, the pinned Continue bar | `--shadow-floating` |

## Collisions to watch

- Coach sage is near the social-domain green; success is cyan.
- Practice violet is near the descriptions and opinions domains.
- Partner apricot ink is near the warning ink.

Each pair appears in different places (surfaces and tabs against data marks and
status messages), and status always carries a word or icon. Check real screens
at each stage before adopting.

## Design-system change

The brand book says: “The interface stays calm and neutral so that the
conversation — and the learner's evidence of progress — carries the colour”, and
“One accent … Never introduce a second accent.” This proposal keeps one accent
for actions and adds identity colours for places and voices. Proposed wording:
“The interface stays calm: a neutral ground, pale identity tints for places and
voices, and one accent for everything you can press.”

## Adoption

1. ~~Add the role tokens to `tokens.css` for light and dark, and fix `--chip` and
   `--track` for the cool palette.~~ Done in build step 2.
2. ~~Update the brand book text and token usage notes in `docs/design-system/`;
   regenerate token values with `npm run design-system`.~~ Done in build step 2.
3. Apply per stage: first run and the mode tabs first, then Chat (coach pane,
   feedback marks, reply help), Practice, and Progress.

## Implemented (build step 2)

2026-09-27, branch `ux-design-pass`, uncommitted.

**Token names.** Roles map to token families in `ui/src/styles/foundations/tokens.css`:

| Role | Tokens |
| --- | --- |
| You | the interaction family, plus the new `interaction-mark` (#3d74c9 / #6fa3ea) and `interaction-line` (#a9bfe3 / #41618f); tints use the existing `interaction-tint` |
| Partner · Chat | `partner-mark`, `partner-tint`, `partner-line`, `partner-ink` |
| Coach | `coach-mark`, `coach-tint`, `coach-line`, `coach-ink` (beside the existing `coach-surface`) |
| Practice | `practice-mark`, `practice-tint`, `practice-line`, `practice-ink` |
| Progress | `progress-mark`, `progress-tint`, `progress-line`, `progress-ink` |
| Live microphone | `recording-mark`, `recording-fill`, `recording-tint`, `recording-line`, `recording-ink`, `recording-glow` |

- “You” is not a separate family. It would duplicate the interaction blue, which
  the token sheet forbids (one name per meaning). The live microphone is named
  `recording-*`, because `live` was the old name of the Auto mode.
- `recording-fill` is new: in the dark theme white on the bright red mark is only
  3.6:1, so the filled control uses #d23543 (4.9:1). In light, fill and mark are the
  same red.
- `--recording-accent` (magenta) is removed.

**Recording states.** The chat microphone and the Practice record button used the
danger (error) family while recording. They now use the recording family: a red fill,
a red outline on the Practice button, and a glow. The Practice glow breathes;
reduced motion keeps it still. The idle Practice button lost its magenta outline and
is plain blue. Errors, missing words and discard keep the danger family.

**T3 and the base palette.** Cool light is now the `:root` base and warm is the
`[data-palette='warm']` variant, declared before the dark theme so dark still wins.
The cool palette gained its own `chip` (#dadee3, `ink-3` 4.9:1 on it, the same as
warm) and `track` (#dde1e6). Measured in the browser before and after, across light and dark with no palette,
cool and warm:

- Light with cool: only `chip`, `track` and the `reply-tray` mix derived from track changed.
- Light with no palette: now cool.
- Light with warm, and every dark combination: unchanged.

The design system now documents the cool light values, and its icons draw in the cool
`ink`.

**Contrast.** Every identity ink is at least 5.6:1 on light surfaces and its own tint,
and at least 7.4:1 in dark. As non-text marks on a light sheet, partner (2.7:1) and progress (2.3:1)
are below 3:1. That is acceptable only because a mark always comes with a word or
icon (rule 4); a mark must never be the only way to tell something.

## Review

2026-09-27, Jon: go ahead with colour, and keep the base cool and neutral so the
colours have room. The cool palette stays the default; T3 (beige `--chip` and
`--track` in the cool palette) becomes part of adoption step 1. The five hues are
the starting point and may be tuned when applied to real screens.

## Review, sixth pass

2026-09-27, Jon: the coach sage and especially the Drill violet were too strong as
whole panels and washes. Changed: side panels and edge tabs are neutral with one
coloured edge (the side facing the work), the mode keeps its tab and top band but
the surface wash is gone, and the attempt list is neutral. In Practice the target
card keeps the violet tint, so the strongest violet marks what you are practising.

## Review, seventh pass

2026-09-27, Jon: the ready microphone should be a neutral blue that turns red only
while recording, and the coach panel's green edge was too thick. Changed: the
ready pad uses the “you” tint, line and ink; the coloured edges on side panels and
edge tabs use `--border-width-strong` (2px) instead of `--border-width-thick`.
