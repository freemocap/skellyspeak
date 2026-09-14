# Handoff: SkellySpeak workspace redesign (Practice · Learn · Review)

## Overview
An architecture pass on SkellySpeak's UI: one spine (Practice / Learn / Review, sharing one rail–sheet–study frame) and five laws (three surfaces, six type roles, two densities, one job per colour, three shapes of depth) replacing five competing elevations, a fine-grained type scale, and depth scattered across a dock, a well, an overlay and a dialog. It also specs four new/relocated surfaces: the empty-conversation entry point, lesson creation, the persona editor (+ a new "Mystery partner" type), and Settings — all grounded in the app's real current contracts (`UI-SURFACES.md`, the actual components below), not invented from scratch.

## About the Design Files
The bundled file (`SkellySpeak-System.dc.html`) is a **design reference built in HTML** — a single scrollable document containing the system rules and every redesigned screen as static, non-interactive mockups. It is not production code and should not be shipped or copied verbatim. The task is to **recreate these designs in the actual SkellySpeak codebase** (React + the existing Rust/Tauri backend), using the real components and CSS custom-property system already in `src/`, per the file-by-file notes below.

## Fidelity
**High-fidelity.** Exact hex colours, type sizes/weights/line-heights, spacing, and layout structure are final. Copy shown on buttons/labels is close-to-final but not contractual. Two things are explicitly **not** finished and need product/eng decisions before build (flagged inline below): the Mystery-partner data model, and where the guess-quiz popover physically mounts.

## Screens / Views

### 1. Global shell & navigation (the spine)
**Purpose:** Replace the current header (tab strip + separate Skill-tree button) and the chat/break split with one three-zone frame reused by every mode.

**Layout:** A 48px-tall top bar (logo 24×24 + wordmark, a 3-way segmented control "Practice / Learn / Review" in a `background:#dcd3be` track with 3px inset padding, right-aligned hosted/XP/settings buttons) sits above a row with three flex children: a 200px fixed **rail**, a flexible **main** sheet (`flex:1 1 58%`), and a **study pane** (`flex:1 1 32%`, `min-width:320px`). Row padding 12px, column gap 12px, outer horizontal padding 16px.

**Components:**
- Mode switch: height 32px, `border-radius:6px`, active state `background:#fffdf8`, inactive `transparent`; active text colour is the destination mode's ink (Practice `#1f4785`, Learn `#8a4e0a`, Review `#0e5c53`) — the only place a "mode colour" appears.
- Rail: 200px, `flex:none`, vertical list of 40–44px rows, `gap:4px`. Active row gets a 1px border in the domain's tint; hover/idle rows are borderless.
- Main sheet: `background:#fffdf8`, `border:1px solid #dcd3be`, `border-radius:12px`, `box-shadow:0 1px 2px rgb(0 0 0/12%), 0 8px 24px rgb(0 0 0/8%)`.
- Study pane: flat `background:#dbd4c5` (light) / `#131416` (graphite — **no gradient**, a previous draft used one and it was removed), `box-shadow:inset 0 2px 8px rgb(0 0 0/16-20%)`, same corner radius.
- Every pane header (main and study alike) is 40px tall, 16px horizontal padding, 1px bottom border, containing an 11px uppercase mono meta label and right-aligned 32px-tall controls. This one header rule replaces `.chat-head`, `.break-head`, `.coach-thread-head` and the ad-hoc control strip.

**Hover/active/focus:** Buttons use a 1px border colour shift on hover (no shadow growth); the mode switch has no hover state beyond cursor, matching a tab, not a link.

### 2. Practice mode (conversation)
**Purpose:** 1:1 replacement for the current `.split` chat/break layout in `GuidedPage.tsx`, restyled under the spine — same data, same actions.

**Layout:** Rail = partner list (see "Partners rail" below). Main = the existing conversation stream + composer. Study = `CoachAnalysisPanel`, now with a 2–3-way tab row (**Coaching / Evidence**, plus **Persona** only for a Mystery partner) instead of the current collapsible dock.

**Components:**
- **Partners rail** (was "Contacts"): each row is icon (20px circle, partner accent colour) + two-line label — name (13px/600) over language (11px mono, `#5c564b`). This is the one content change beyond restyling: add the language sub-line to whatever renders `ChatHistory`'s contact rows.
- **Message bubbles:** partner bubble `background:#fff4e3` flat (was a gradient — flatten it), `border:1px solid #cbb28e`, `border-radius:12px 12px 12px 4px`. Learner bubble `background:#f3eee1`, `border:1px solid #dcd3be`, `border-radius:12px 12px 4px 12px`. Bubble text is always Newsreader 20px/1.55 (the "Reading" type role) regardless of reading-preference font-size setting — that setting should scale this role, not switch families.
- **Corrections** (replaces the floating amber XP badge that currently overlaps the bubble in `MessageFeedback`/`InlineXpBadge`): a plain-text line **below** the bubble it describes, `border-inline-start:2px solid #c78a2f`, `color:#8a4e0a`, 13px, tappable, opening that turn's entry in the Coaching tab. XP is not shown on the bubble at all — it's counted in the study pane.
- **Message actions:** Translate · Explain · Read aloud as plain text buttons (13px, `color:#1f4785`, no border/background), left-aligned under the bubble, same order every time.
- **Composer:** unchanged mechanically (`ComposerInput`, mic, send) — height 44px, `border-radius:12px`, Newsreader 17px. Only the visual chrome (border colour, radius, the Record button's outline style) changes.
- **Empty state** (`ConversationStart.tsx`): replace the current starter-card layout with: composer (unchanged, pinned at bottom — it is always the first path) and, centred in the empty message area, a 320px-wide column — meta label "Start the conversation" → row of [**Let ⟨partner⟩ start**, 44px, `border:1px solid #1f4785`] + [topic `<select>`, 128px wide, defaulting to "Any topic"] → an "or" divider (two 1px lines + 11px mono "or") → **Take a lesson** button (44px, neutral border). "Let ⟨partner⟩ start" calls the existing `startConversation(opening)` / `onStart` with the dealer's-choice topic; the topic select is a secondary, optional refinement of that same call — not a second step. `onLesson` is unchanged. Partner-first sends create no learner message and show the same pending/paused/failed states already specced in `UI-SURFACES.md` — only the trigger's visual weighting changes (one primary composer, two secondary buttons under "or"), not the state machine.
- **Mystery partner — Persona tab (new):** a third study-pane tab, purple ink (`#7d5bd4`/`#0e5c53` for confirmed). Body is a list of rows, one per hidden attribute (job, personality, where-from, age, interests): each row shows either the real value + "✓ revealed", or "?" (locked, dashed border), or "? · guessed correctly · +N XP" with a **separate** "Reveal" text-button. **Decision needed from product/eng:** a correct guess pays XP immediately but does *not* auto-populate the value — the player must tap Reveal separately. This needs a third state per field (`hidden | guessed_unrevealed | revealed`), not just a boolean, and that third state doesn't exist anywhere in the app today. Below the rows: a dashed amber system-nudge card (dismissible, appears after ~8 turns, suggest a per-conversation dismissal flag) and a persistent **"I think I know them"** button. Tapping it (or the nudge) opens a small multiple-choice popover — real value + 2–3 plausible distractors — scoped to one field at a time. **Decision needed:** whether that popover is a `DetailDialog` (consistent with the app's existing modal primitive) or an anchored inline popover (matches the mockup, lighter-weight, but is a new primitive). Recommend `DetailDialog` for v1 to avoid building new popover-positioning logic, then revisit.

**⚠ Known flexbox trap:** the study pane is a column flex item whose children include a fixed-minimum block (the dock/tab content). If you give the study pane `overflow:hidden` without also setting `min-height:0` on it, its automatic min-size will default to its content's min-content height and silently clip the last child (we hit exactly this with the coach-dock's send button during this pass — fixed by adding `min-height:0` to the pane itself, letting the inner scrollable region absorb the overflow instead). Set `min-height:0` on every nested flex column here.

### 3. Learn mode (lesson as a first-class mode)
**Purpose:** Move `LessonDialog` out of a modal and into the main pane as Learn mode's content, with lesson creation folded into the rail instead of a separate step.

**Layout:** Rail = saved/in-progress lessons (grouped "In practice" / "Saved", same row style as Partners). Main = lesson content with a step spine. Study = same `CoachAnalysisPanel`, scoped to the lesson.

**Components:**
- **Step spine:** a horizontal row of 20px circles (done = filled teal `#1e9c8e` with a ✓, current = filled amber `#c78a2f` with the step number, upcoming = 1px outline) connected by 1px lines (teal if both neighbours are done, amber into the current step, neutral after). Steps: Objective → Examples → Exercise → Quiz → Practice.
- **Objective/Examples/Exercise:** plain content blocks — Newsreader 24px/1.2 lesson title, 15px/1.6 body, a bordered example card with Newsreader 20px target text + 12px mono phonetic line + 13px translation.
- **Quiz:** each question is its own bordered card; multiple-choice options are full-width buttons (Newsreader 17px), correct/selected gets a teal border + tint; an inline explanation (13px) appears below on answer, colour-coded teal/correct.
- **Handoff footer:** 1 line of body copy + a single filled button "Try it in chat →" (`background:#1f4785`) — replaces the dialog's implicit close-on-practice; this now triggers the existing `onPractice` callback and a mode switch to Practice instead of a dialog unmount.
- **Lesson creation (replaces the chooser step):** expands in place of the rail's "+", not a new dialog: 4 category pills (Practical situations / Grammar / About the language / Reading — from `UI-SURFACES.md`'s real categories), 3 suggestion rows for the active category, a custom-topic input + Create button. Wire to whatever currently backs `LessonDialog`'s topic-suggestion step.

### 4. Review mode (skill map)
**Purpose:** Replace the standalone `SkillsPage` route with Review-as-a-mode; keep both existing evidence readings side by side rather than picking one.

**Layout:** Rail = language switcher + partner/variety filters (existing `SkillsPage` filter controls, restyled to the rail row style). Main = domain list. Study = source-message evidence for the selected domain (existing `SkillDetailContent`/`SkillEvidenceRecord` data).

**Components:**
- **Skill tree (new, above the bars):** an SVG radial tree, root at bottom-centre, one trunk branch per domain at an even angular spread, colour = domain accent. **Branch depth is driven by the domain's credited-observation count**, not a separate "level" field: 0 observations → dashed 1-node stub; 1+ → depth 1; 6+ → depth 2; 12+ → depth 3 (tune thresholds to real data distribution — these are placeholders). This should read directly off the same evidence counts `SkillOverview`/`SkillEvidenceRecord` already compute — it is a second renderer over existing numbers, not a new metric. **`TreeCamera.tsx` already exists in the codebase** — check whether it already does radial/branching layout before building a new SVG generator; this spec may just be new visual parameters on an existing system.
- **Domain bars (unchanged data, restyled):** one row per domain — 15px label, an 8px-tall track (`background:#e8e2d4`) filled to the domain's proportion, and a right-aligned 11px mono count ("14 independent · 3 assisted"). A domain with zero observations renders as a dashed-border row with no bar and the literal text "Not enough evidence to estimate" — never a zero-width bar.
- **Evidence panel (study, unchanged behaviourally):** estimate + uncertainty + review-due line, then source message cards (Newsreader 17px quote + 11px mono attribution + "Exclude this attempt" link) — this is `SkillEvidenceRecord`'s existing data, restyled to the pane-header/card rules above.

### 5. Inspect recording dialog
**Purpose:** Restyle `TranscriptionInspector` under the same dialog shell as every other dialog, and make the visualisations metrologically real instead of decorative.

**Layout:** One of the app's 4 justified dialogs (scrim `rgb(31 28 23/55%)`, sheet `box-shadow:0 12px 35px rgb(0 0 0/40%)`). Two columns: a wide left column (waveform → STFT → log-Mel → word-alignment strip → transport controls, all sharing one horizontal time axis) and a 280px right column (selected-word metadata).

**Components:**
- **Waveform:** true per-pixel-column min/max peak envelope of the sample buffer (not a drawn shape) — `#1f4785` on white, centre zero-line in `#dcd3be`.
- **STFT magnitude:** linear-frequency spectrogram straight from a windowed FFT (25ms Hann, 512-pt), dB-mapped, 80dB floor. This is "what the signal is."
- **Log-Mel features:** the *same* FFT bins pooled through an 80-band mel filterbank, log-scaled, peak−8-decade clamp — this is literally the tensor a Whisper-class model consumes, i.e. "what the model sees." Show both — they are two stages of one pipeline, not two illustrations of the same thing. Caption the pipeline in one mono line: `samples → 25ms Hann → 512-pt FFT → 80 mel filters → log₁₀ + clamp 8 decades → model input → tokens`.
- **Word alignment strip:** boxes positioned by *actual* start/end time as a percentage of total duration (not evenly spaced), each showing the word + its segment logprob; a word with no returned timing renders as an empty dashed box, never an evenly-spaced guess.
- **Right column:** original vs. aligned timing, segment logprob, no-speech probability, token IDs — exactly the fields `UI-SURFACES.md` says the route returns, nothing invented.
- All three plots must be computed from the same signal/segment data so they can never visually disagree — if the real waveform/FFT/mel pipeline isn't wired yet, gate the panel on data being present rather than fabricate a plausible-looking placeholder.

### 6. Persona editor dialog
**Purpose:** Give `NewPersonaDialog`/`PersonaProfileDialog`/`PersonaForm` a complete sheet (identity, personality, voice, type) plus a generate-everything shortcut, under the same dialog shell.

**Layout:** 620px dialog. Header (title + "Draft · not saved" + close). Body: avatar (72px circle placeholder) + name input + "Surprise me — fill the whole sheet" button, then Type, Personality, Voice/Language/Level. Footer: Cancel + filled Create.

**Components:**
- **Surprise me:** one action that randomizes every field below it (name, personality chips, voice, avatar) — respect whatever field constraints already exist in `personaLimits.ts`.
- **Type — Standard / Mystery (new field):** a 2-way segmented control, same visual as the mode switch. Selecting Mystery should surface a short inline note (amber-tinted) naming which fields will be hidden — don't silently change behaviour.
- **Personality:** multi-select chips (30px tall, pill), selected state teal border + tint. **Decision needed:** what the chip vocabulary is (the mock uses Warm/Curious/Blunt/Playful/Formal as placeholders) and how many can be selected — check whether `PersonaForm.tsx` already has a personality field to extend rather than replace.
- **Voice/Language/Level:** three equal-width `<select>`s, 36px tall, existing options data.

### 7. Settings dialog
**Purpose:** Restyle `SettingsModal`/`SettingsAccess` under the shared dialog shell — no behavioural change, this section is real current functionality, not new.

**Layout:** 720px dialog, left mini-nav (160px, section list) + scrollable right content. Content shown: **AI access** (Hosted / API keys / Custom URL as underline tabs, 32px tall, active tab gets `box-shadow:inset 0 -2px #1f4785`; a signed-in row shows a green status dot + email + Sign out) and **Reading** (Appearance as a 3-way Dark/Light/System segmented control identical in style to the mode switch; Conversation width as the existing draggable-divider control, restyled — keep the existing drag/keyboard-arrow/Home-End/double-click-reset behaviour, this is `PracticeDivider`'s existing contract, just restyled).

### 8. Narrow / mobile layout
**Purpose:** Same three zones, one column. No mobile-specific components invented.

**Layout:** Rail collapses to a drawer behind a ☰ button in a 48px header. Main and study become two full-width surfaces; a bottom mode bar (56px min-height rows, 44px+ hit targets) replaces the top segmented control as the only navigation, with the current mode getting a 2px top border in its ink colour. This maps onto the existing `isMobile`/`mobileSurface` state in `GuidedPage.tsx` — the bottom bar's three items are Practice/Learn/Review instead of today's chat/panel toggle.

### 9. Graphite (dark) theme
**Purpose:** Confirm the same three-surface, five-law system holds with one palette swap — no component should need dark-specific structure.
**Values used in the mock:** ground `#141517`, sheet `#24262a`, well `#131416`/`#101113` (flat, no gradient), borders `#343a41`/`#454b53`, ink `#f0f1f3`, muted `#a3a8af`/`#d3d6da`, interaction ink `#6fa3ea`, amber `#f0a957`, red `#f07a72`. These are new — reconcile against whatever dark-mode tokens `tokens.css` already defines under the "Living Spectrum" system rather than introducing a second dark palette.

## Interactions & Behavior
- **Mode switch** (Practice/Learn/Review): swaps rail + main + study content; does not remount the app shell. Should be a router-level or top-level state change, not three separate pages with independent chrome.
- **Pane divider drag:** unchanged — reuse `PracticeDivider.tsx` exactly (drag, focus + arrow keys, Home/End to limits, double-click to reset). Only the divider's visual affordance changes.
- **Correction tap:** scrolls/switches the study pane to Coaching, focused on that turn's entry. No navigation away from the conversation.
- **"Let ⟨partner⟩ start":** calls existing `startConversation`/`onStart`; topic select is read at call time, not a separate step. No new async flow.
- **"I think I know them" / system nudge:** opens the guess popover scoped to one undecided field; nudge auto-dismisses on any guess and can be manually dismissed (✕) without penalty; store the dismissal per-conversation so it doesn't reappear every render.
- **Guess submit:** correct → award XP immediately (reuse the existing XP/reward pipeline — `SkillRewards`/`RewardBadge`), field flips to `guessed_unrevealed`; incorrect → no state change, no penalty, retry any time. "Reveal" flips `guessed_unrevealed → revealed`.
- **Lesson step spine:** clicking a past (done) step navigates back to it without losing quiz/exercise answers already given; clicking ahead is disabled past the current step.

## State Management
- `mode: 'practice' | 'learn' | 'review'` — top-level, likely replaces separate route entries.
- `studyTab: 'coaching' | 'evidence' | 'persona'` — persona only valid/shown for a Mystery partner.
- Persona: add `type: 'standard' | 'mystery'` and, for mystery, a per-field state map `{ job, personality, from, age, interests }: 'hidden' | 'guessed_unrevealed' | 'revealed'` plus which XP has already been paid per field (idempotency — don't re-pay on reveal).
- Lesson creation draft: `{ category, topic }` — local to the rail's expanded "+" state, not global.
- Everything else (messages, corrections, XP totals, evidence counts, settings values) is existing state, only re-rendered under new styling.

## Design Tokens

**Surfaces (collapse the current 8 down to 3 roles):**
| Role | Value (light) | Value (graphite) | Replaces |
|---|---|---|---|
| Ground | `#e8e2d4` | `#141517` | `--bg`, `--chrome`, `--track` |
| Sheet | `#fffdf8` | `#24262a` | `--sheet`, `--card`, `--field` |
| Well (inset) | `#dbd4c5` flat | `#131416` flat | `--dock`, `--quiet`, `--chip` — **no gradient** |

**Type roles (six, replacing the current ~10-size scale):**
| Role | Spec |
|---|---|
| Display | Newsreader 24px / 1.2 — mode & lesson titles only |
| Title | Sans 18px / 1.35 / 600 — section heads |
| Reading | Newsreader 20px / 1.55 — target-language text everywhere, scales with the reading-size preference |
| Body | Sans 15px / 1.6 — explanation prose |
| UI | Sans 13px / 1.45 / 500 — every control label |
| Meta | Mono 11px, `letter-spacing:0.14em`, uppercase — pane labels, counts, state |

**Density:** chrome rows 40px / interior 12px / gap 8px / controls 32px (44px on touch). Content interior 16px / block gap 16px / section gap 24px / bubble padding 12·16. Spacing ramp: 4·8·12·16·24·40 — no other values.

**Colour:** six domain accents (Social `#e08a2e`, Questions `#d9564f`, Statements `#3d7bd6`, Opinions `#c0519b`, Descriptions `#7d5bd4`, Situating `#1e9c8e`) used **only** for domain/evidence identity. One interaction ink (`#1f4785`) for every link, button-border and focus state. Amber (`#c78a2f`/`#8a4e0a`) means "a correction exists," never decoration. Red (`#922c2a`/`#bd3038`) means "a request failed," never emphasis.

## Assets
- `skellyspeak-logo.png` — already in the repo at `public/skellyspeak-logo.png`; the mock just uses it at 24–28px instead of a text mark.
- Fonts: IBM Plex Sans (400/500/600/700), IBM Plex Mono (400/500/600), Newsreader (400/500, incl. italic) — via Google Fonts in the mock. Check what `index.html`/`tokens.css` currently load and reconcile rather than double-load.
- Icons: the mock's small dialog/gear/reload/profile glyphs were pulled from the real `ToolbarIcon.tsx` SVG paths — reuse that component rather than the inline unicode glyphs (▾ ✓ ↑ etc.) used as placeholders elsewhere in the mock for things that don't have a real icon component yet.

## Files
Design reference: `SkellySpeak-System.dc.html` (this folder) — sections 01–06 are the system rules, 07 is the current app rebuilt from source (baseline), 08–18 are every redesigned/new screen in order matching the numbered sections above.

Real source files this maps onto:
- Shell/spine: `src/app/AppShell.tsx`, `src/app/shell/TopBar.tsx`, `src/styles/layout.css`
- Practice: `src/features/guided/GuidedPage.tsx`, `ChatHistory.tsx`, `TurnView.tsx`, `MessageFeedback.tsx`, `InlineXpBadge.tsx`, `ConversationStart.tsx`, `ComposerInput.tsx`, `src/styles/conversation.css`
- Study pane / coaching: `CoachAnalysisPanel.tsx`, `CoachDock.tsx`, `CoachEntry.tsx`, `LiveCoachReview.tsx`, `PracticeDivider.tsx`, `src/styles/coach.css`
- Learn: `LessonDialog.tsx`, `src/styles/lesson.css`
- Review: `src/features/skills/SkillsPage.tsx`, `SkillOverview.tsx`, `SkillDetailContent.tsx`, `SkillEvidenceRecord.tsx`, `TreeCamera.tsx`
- Inspector: `TranscriptionInspector.tsx`
- Persona: `NewPersonaDialog.tsx`, `PersonaProfileDialog.tsx`, `PersonaForm.tsx`, `PersonaPicker.tsx`, `personaLimits.ts`
- Settings: `src/features/settings/SettingsModal.tsx`, `SettingsAccess.tsx`
- Tokens/type/primitives: `src/styles/tokens.css`, `typography.css`, `primitives.css`
