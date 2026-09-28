SkellySpeak is a convivial tool for learning languages through welcoming conversations, useful assistance and understandable progress. The interface stays calm: a cool neutral ground, pale identity colours for places and voices, and one accent for everything you can press, so the conversation — and the learner's evidence of progress — stands out.

## Content fundamentals

- **Voice: a patient, honest companion.** Plain, warm, never hype. Say what is true and no more: "No reviewed replies for this skill yet. Missing evidence is not a failure." Never claim proficiency, streaks or scores the data doesn't support.
- **Address the learner as "you"; the app never says "I".** The partner and the coach are characters; the chrome is not. "How your message came across", "Start a conversation", "Keep going".
- **Sentence case everywhere** — buttons, titles, menu items: "Explore skill map", "Delete this conversation". Short verbs on buttons ("Send", "Review", "Retry failed").
- **Punctuation:** a real ellipsis for work in progress ("Saving…", "Generating a partner…"); a middle dot `·` to join metadata ("3 XP · Questions"). No exclamation marks in chrome; no emoji in the interface.
- **Target-language text is sacred.** Never truncate, restyle or translate it silently; translations and glosses sit beside it in `ink-3`, smaller.

## Visual foundations

### Colour

- **A cool neutral ground.** Build screens from `bg` (the ground), `sheet` (the raised chat surface), `bar` (the top bar, a touch darker than the ground, so the active tab and its page read as one), `chrome` (panel tabs) and `field` (inputs). Borders are `line`; quiet dividers `line-soft`. The cool palette is the default and the values documented here; a warm palette is a learner preference over the same roles.
- **Text:** `ink` for primary copy, `ink-2` for labels and supporting copy, `ink-3` for metadata, glosses and placeholders. All three hold 4.5:1 on `sheet`, `chrome` and `bg` in both themes.
- **One accent.** `interaction-ink` is the only interaction colour: links, active tabs, selection, XP, the focus ring. Primary buttons fill with `interaction-fill` and `ink-on-fill` text. `interaction-mark` and `interaction-line` mark your choices: a selected card's edge, a ready control's border. Never introduce a second accent.
- **Identity colours mark places and voices, one meaning each:** `partner-*` for your partner, `coach-*` for the coach and the Chat tab (Chat and its coach share one green), `practice-*` for the Practice tab and its cards, `progress-*` for XP, skills and rewards, and `recording-*` for the microphone while it records. Each has a `-mark` for small saturated marks (tab edges, dots, avatar rings), a `-tint` for pale areas, a `-line` for borders and an `-ink` for text. Pale for areas, strong for marks: most of the screen stays neutral, and the colour always comes with a word or icon. Identity colours never fill a button.
- **Red means recording.** The microphone is blue while it is ready. While it records, the control fills with `recording-fill`, takes a `recording-mark` outline and a `recording-glow`. Errors keep the danger family; recording never borrows it.
- **The chat is warm vs cool.** The partner's bubbles are warm (`bubble-partner-bg` / `bubble-partner-line`), the learner's are cool (`bubble-learner-bg` / `bubble-learner-line`). Keep that split anywhere the two voices appear.
- **Status is three families: success, warning and danger.** Each has an `-ink` for text, a `-line` for borders and marks, and a `-tint` to sit behind the ink (`success-ink` on `success-tint`, and so on). The same families cover system state (a failed request) and the coach's judgments (a correction). Always pair the colour with a word or icon.
- **Skill domains are data colours, not status.** The six domains (Social, Questions, Opinions, Statements, Descriptions, Situating) each get a fill `d-*` for marks (map nodes, bars, dots) and an ink `di-*` for text. Never use a domain hue to mean good/bad, and never set text in a `d-*` fill colour.
- **Destructive actions** are outlined in `danger-line` with `danger-ink` text and fill with `danger-fill` on hover or confirm. The fault bar at the top of the app has its own always-dark `fault-bar-*` colours.
- **Dark theme** is graphite, not black: same roles, lighter inks. `interaction-fill` stays the same deep blue in both themes.

### Type

- **IBM Plex Sans** is the interface (`type-hero` 30 → `type-meta` 11). Controls sit at `type-ui` 13px/500; default copy at `type-body` 15px.
- **Newsreader (serif)** is for reading: target-language text at `type-reading` 20px, and the learner's own messages. Serif means "language you are learning".
- **Target-language words among interface text** (a topic's name, the greeting to say) are also bold in `target-ink`: `.target-word` in `reading.css`. The learner can scan the language being learned apart from explanations; translations beside them keep the interface style.
- **IBM Plex Mono** is for data: counts, model names, timings, YAML (`mono-meta`, `mono-ui`).
- Reading text scales with the learner's text-size and the script (Arabic is set larger); never hard-code its size.
- Headings are weight 600; body 400. Under 860px wide, `type-display`, `type-title` and `type-reading` step down (21 / 16 / 17px).

### Space, shape, depth

- **Every length is a token.** Stylesheets may not hard-code colours, font sizes, weights, line heights (`leading-*`), spacing (`space-*`), border widths (`border-width*`), radii, durations or layers; `npm run styles:check` enforces it.
- **Spacing is one ordered scale** (`space-1` 2px … `space-13` 40px) that the app multiplies by a density factor (tight .75 by default). Use steps, never raw pixels, so density settings keep working.
- **Dense by default.** SkellySpeak is chat-first and compact: modest padding (`space-4` × `space-6` in a bubble), no airy hero sections.
- **Radii:** `radius-md` buttons and fields, `radius-lg` cards, `radius-xl` chat bubbles, the composer frame and dialogs, `radius-pill` chips. A chat bubble has one small corner (`radius-sm`) on the speaker's side — bottom-left for the partner, bottom-right for the learner.
- **Depth says what a surface is for:** raised is where you work, recessed is what you pick from or refer to, floating is what needs an answer now.
- **Depth is quiet** and a learner preference: `shadow-surface` lifts the chat off `bg`, `shadow-floating` carries dialogs, popovers and rewards, `shadow-sm` lifts bubbles and cards, `shadow-recessed` sinks the coach below the ground. Dialogs sit on `scrim`; drawers and destructive confirmations on `scrim-strong`. Prefer borders to shadows inside a surface.
- **Controls** are `control-height` (32px compact / 40px standard) and never below `touch-target` 44px on touch screens.
- **Focus:** one ring everywhere: `focus-width` (2px) solid `focus-ring`, offset 2px, from the global rule. Components don't restyle it; only rings that would be clipped move inside (negative offset). Never remove it with `outline: none`.

### Motion

Short and functional: 80–200ms transitions with an ease-out curve; a blinking caret while the partner streams; a brief receipt when XP is earned. Nothing loops for decoration. Respect reduced-motion.

## Iconography

- Icons are a small hand-drawn set of 24×24 line icons (see the Icons group): 1.7px round-cap strokes, no fills except the half-disc in `appearance`. In the app they draw in `currentColor` at 17px.
- Pair icons with a text label or an accessible name; icons alone only in the top bar and toolbars.
- No emoji, no third-party icon library. If you need a new icon, draw it in the same stroke style.

## Logo

- The SkellySpeak mark is a teal skull with red sparkles and a speech bubble saying hello in many languages. Use the PNG as supplied (Logos group) — never recolour, crop, or redraw it.
- In the app it sits at 28×28px at the left of the top bar, decorative (empty alt) beside the product name. Below 600px the name folds away; the mark stays at every width.

## Components

Every component page shows the real application markup and stylesheet (`components/bundle.css` is the app's own cascade), rendered statically: hover, focus and popovers don't run in the previews. Build with the shared classes and components named on each page instead of restyling: `.btn`, `.panel-tab`, `.form-row` / `.field`, `.msg.chat-message`, `.coach-card`, `.detail-dialog`, `.error-details`, `.activity-indicator`, `.info-tip`.
