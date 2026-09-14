You are implementing a design pass on the SkellySpeak React/Tauri app. Two reference files sit in `design_handoff_workspace_redesign/` — read both before touching code:
- `README.md` — full spec: every screen, exact tokens, component-by-component notes, real file names.
- `SkellySpeak-System.dc.html` — the visual reference (open in a browser). Sections 01–06 are the system rules, 07 is the current app rebuilt as a baseline, 08–18 are every redesigned/new screen.

## What this is
An architecture pass, not a repaint: one spine (Practice / Learn / Review, sharing one rail–main–study frame) and five laws replacing five competing surface elevations, a ~10-size type scale, inconsistent density, six accent colours doing too many jobs, and depth scattered across a dock/well/overlay/dialog. It also adds: a cleaner empty-conversation entry point, lesson creation folded into the Learn rail, a fuller persona editor with a new "Mystery partner" type, and a restyled Settings — all against the app's real current contracts, not invented.

## Ground rules
- Don't break existing state, props, or backend contracts. This is restyling + relayout of real components (`GuidedPage.tsx`, `ConversationStart.tsx`, `CoachAnalysisPanel.tsx`, `TranscriptionInspector.tsx`, `NewPersonaDialog.tsx`/`PersonaProfileDialog.tsx`, `SkillsPage.tsx`, `SettingsModal.tsx`/`SettingsAccess.tsx`, `PracticeDivider.tsx`, `ChatHistory.tsx`) — reuse their existing handlers/data, don't rewrite their logic.
- Inline-styled mockup → real CSS custom properties. Every colour/size in the reference maps to a token; alias old tokens to new values in `tokens.css` rather than hardcoding new hex values into components.
- Flag, don't silently resolve, the two open decisions below — ask before assuming.
- Ship in the order below; each step should be independently mergeable.

## Order of work
1. **`tokens.css` alias pass.** Collapse `--card`/`--dock`/`--quiet`/`--chip` → one "sheet"/"well" pair (see README's surfaces table); collapse the ~10 font sizes to six named roles (display/title/reading/body/ui/meta). No component changes yet — this alone should visibly quiet the app.
2. **One pane-header rule.** Unify `.chat-head`, `.break-head`, `.coach-thread-head` and the settings control-strip into a single 40px header pattern (16px padding, 11px uppercase mono meta label, 32px controls, right-aligned). Delete the bespoke variants.
3. **Fold the coach dock into the study pane.** `CoachAnalysisPanel` gains a real tab row (Coaching / Evidence, + Persona for Mystery partners) instead of a collapsible dock. Drop the dock's own resizer — `PracticeDivider` (chat↔study) stays the only draggable edge. Watch for the flexbox auto-min-size trap: any nested flex column here needs explicit `min-height: 0` or its last child (the coach input row) silently clips under `overflow:hidden`. Route corrections to a hairline note under the message (`border-inline-start: 2px solid #c78a2f`) instead of the badge that currently overlaps the bubble.
4. **Lesson as a mode, not a dialog.** Move `LessonDialog`'s content into the main pane with a step spine (Objective → Examples → Exercise → Quiz → Practice) above it; move its topic-picking step into the Learn rail's "+" (4 categories from `UI-SURFACES.md`: Practical situations / Grammar / About the language / Reading, + suggestions + custom topic). Saved lessons list unchanged.
5. **Empty state.** Restyle `ConversationStart.tsx`: composer stays pinned and is always the first path; above it, one "or" group with "Let ⟨partner⟩ start" (primary, one-tap, calls existing `onStart`/`startConversation` with dealer's-choice topic) + a secondary topic `<select>` defaulting to "Any topic", then "Take a lesson". No new state — same `StartChoice` contract.
6. **Partners rail.** Rename "Contacts" → visually just the rail label change; add each row's target language as an 11px mono sub-line under the name in `ChatHistory.tsx`'s row renderer.
7. **Review mode.** Merge `SkillsPage` into the Review mode's main pane. Add the branching skill-tree visual above the existing linear domain bars — branch depth keyed off each domain's credited-observation count (same numbers `SkillEvidenceRecord` already computes). **Check `TreeCamera.tsx` first** — it may already do radial/branch layout and just need new visual parameters instead of a new renderer.
8. **Inspect recording.** Restyle `TranscriptionInspector` under the shared dialog shell. If real waveform/FFT/mel data isn't wired yet, gate the panel on data presence — do not fabricate a plausible-looking placeholder plot; an empty/loading state is correct, a fake spectrogram is not.
9. **Persona editor.** Add to `NewPersonaDialog`/`PersonaForm`: a "Surprise me" action that randomizes every field (respect `personaLimits.ts`), a Standard/Mystery type toggle, and personality as multi-select chips. Mystery mode needs the field-state model in decision (a) below before it can actually gate anything.
10. **Settings.** Restyle `SettingsModal`/`SettingsAccess` under the shared dialog shell (left mini-nav + scrollable content). No behavioural changes — Hosted/API keys/Custom URL tabs and Reading's Appearance + conversation-width controls are real, existing functionality.
11. **Colour audit.** Grep for every use of the six domain accents and the old generic "--accent*" tokens; domain colours may only mean domain/evidence identity from here on. One interaction ink for links/borders/focus. Amber only where a correction exists. Red only where a request failed.
12. **Narrow layout + graphite theme** last, once desktop light is settled — same three zones in one column with a bottom mode bar; same tokens, palette-swapped, no new component structure.

## Two decisions, now settled
(a) **Mystery-partner field reveal state — confirmed.** A correct guess pays ordinary XP immediately (same pool as everything else — a separate "curiosity" currency was tried and dropped, not worth the bookkeeping). The value stays hidden until a separate "Reveal" tap. Ship the third state per field (`hidden | guessed_unrevealed | revealed`) in the persona schema.
(b) **Guess-quiz popover primitive — confirmed.** Ship as a `DetailDialog` (the app's existing modal primitive) for v1. No new positioning logic. Revisit a lighter anchored popover only if `DetailDialog` feels heavy in practice.

## Tokens (condensed — full tables in README.md)
Surfaces: ground `#e8e2d4`/`#141517`(dark), sheet `#fffdf8`/`#24262a`, well (flat, no gradient) `#dbd4c5`/`#131416`.
Type roles: display (Newsreader 24/1.2), title (sans 18/1.35/600), reading (Newsreader 20/1.55 — all target-language text), body (sans 15/1.6), ui (sans 13/1.45/500), meta (mono 11, uppercase, 0.14em tracking).
Density: chrome rows 40px/interior 12/gap 8/controls 32(44 touch); content interior 16/gap 16/section 24. Spacing ramp: 4·8·12·16·24·40 only.
Colour: six domain accents (Social #e08a2e, Questions #d9564f, Statements #3d7bd6, Opinions #c0519b, Descriptions #7d5bd4, Situating #1e9c8e) for domain/evidence only; interaction ink #1f4785; amber #c78a2f/#8a4e0a = correction exists; red #922c2a/#bd3038 = request failed.
