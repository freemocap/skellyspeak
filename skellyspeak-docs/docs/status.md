---
sidebar_position: 5
title: Status
---

# Status — where SkellySpeak actually stands

Honest inventory, last reconciled against the code **2026-09-01**. Frame:
**what works, what's rough, what doesn't exist.** Every claim is checkable
against the code.

## Verdict in three sentences

The core loop — greet → converse with a streamed tutor reply → async grammar
analysis + private coaching → observer quietly steering via plan/profile —
is **implemented and coherent**, with unusually mature LLM-error handling
for a PoC (schema inlining, corrective retries, per-section degradation,
non-overlapping observer, no silent fallback paths). The app is
**single-user, single-pairing-at-a-time** across four symmetric languages,
runs on Windows desktop and Android, and has unit tests plus a three-job CI
workflow. What it still lacks: conversation persistence, onboarding, any
vocabulary/SRS layer, iOS — and, most pressingly, any real observability
into the eight model calls a single turn now makes.

## What works end-to-end

| Capability | Evidence |
|---|---|
| Guided conversation with streaming replies | `commands.rs::guided_turn`, `GuidedPage.requestTurn` |
| Async analysis (reply + LEARNER tokens/translation, mechanics, scaffolds) with per-section degradation | `commands.rs` analysis spawn |
| **Language pair switching** — en-US ⇄ fr-FR ⇄ es-ES ⇄ ar, any native language, registry served to the UI over IPC (`get_languages`); documents archived on switch; full conversation reset + fresh greeting in the new language; **dialect = preset dropdown + free-text combobox** injected into every prompt; **Absolute zero level** (PRE-A1) with true-beginner survival mode | `languages.rs`, `commands.rs::save_settings`, `components/DialectField.tsx`, `prompts.rs::persona_block`, `GuidedPage` pair-change effect |
| **Arabic (Levantine)** — RTL script, ALA-LC romanization alongside glosses (skellysubs IP) — the scheme now comes from the language registry rather than hardcoded prompt text, and applies to learner tokens as well as tutor tokens; unvocalized typing convention; Whisper gets a target-language-only context hint (recent turns) because hint language leaks into transcripts; RTL token rendering via `row-reverse` lines (flex order overrides bidi) | `languages.rs` (direction + romanization fields), `GuidedToken.romanization`, `transcribe_audio(prompt)`, `.rtl-line`/`.wroman` UI |
| **Unified right panel** — Coach / Analysis tabs (one pane, both views); coach thread persists inside the Coach tab; analysis Q&A chat removed | `components/panes/CoachAnalysisPanel.tsx` |
| **Mobile mode = window mode** — window below 860px switches to tabbed single-surface layout (bottom nav: Chat ⇄ Coach/Analysis); desktop shrinks into it for testing | `GuidedPage` matchMedia effect, `.mobile-nav` |
| **Voice I/O** — cloud TTS playback via OpenRouter gpt-audio-mini (cached, OS-voice fallback), mic with 20s-silence auto-stop, **live scrolling waveform**, optional auto-send; 🔊 replay; configurable shortcuts | `commands.rs::speak_text`, `components/WaveformStrip.tsx`, `lib/speech.ts`, `lib/keyboard.ts` |
| **Learner interrogation** — your own messages get tokenized + translated; click/drag/dblclick/right-click/press-and-hold on learner AND tutor words | `LearnerTokensOut`, `TokenSpan`, `word_insight` command, `WordInsightModal` |
| **Interactive coach thread** — persisted private side-chat with the coach; analysis Q&A input | `coach_ask`, `coach_thread.json`, Coach pane input |
| Observer pass, non-overlapping, plan/profile persisted + learner-visible drawer | `commands.rs:262-351`, `observer.rs` |
| Anti-repetition (taught ledger + 20-card ring) | `observer.rs::directives_block`, `commands.rs:483-496` |
| Structured output: schema-constrained on every attempt, corrective retries, no degraded path | `ai.rs::structured_validated` |
| Stories: generation, validation, tap-gloss, per-level cache | `commands.rs:558-619`, `StoriesPage.tsx` |
| Voice input → Whisper STT → composer (not auto-send) | `GuidedPage.toggleMic`, `commands.rs::transcribe_audio` |
| Steer row (level → CEFR in every prompt, topic → directives) + per-token tap-to-reveal help | `hooks/useSteering.ts`, `commands.rs::guided_turn`, `chat/TurnView.tsx` |
| **Run tracing** — every AI call produces one `Run` (operation, actor, turn lineage, model profile, timings, time-to-first-token, token usage, full attempt chain, outcome), streamed live on a trace bus | `ontology.rs`, `trace.rs`, `ai.rs` chokepoint, `components/RunsView.tsx` |
| **Generated execution graph** — `turn_plan.rs` declares what a turn does and what each step actually depends on; `graph.rs` *generates* the picture from it. Structure derived, position authored. Live Graph view (lazy-loaded React Flow) lights nodes as runs land | `turn_plan.rs`, `graph.rs`, `commands.rs::get_graph`, `components/graph/AgentGraph.tsx` |
| **Reconciliation** — the declared graph diffed against recorded runs: undeclared operations, unexercised nodes, and **contradicted edges** (a dependent that started before its dependency finished). Rendered as a fidelity banner and red edges | `trace::reconcile`, `commands.rs::get_reconciliation` |
| **Window capture for UI review** — screenshots the real Tauri window rather than a mocked browser view | `scripts/shot.ps1` |
| **Observability panel in three shells** — resizable desktop dock (persisted height), pop-out OS window (built in Rust, label-routed), and a third mobile swipe surface (chat ⇄ coach ⇄ inside), all sharing one `DevPanel` | `components/dev/DevPanel.tsx`, `LogsOverlay.tsx`, `DevWindow.tsx`, `commands.rs::open_dev_window` |
| Logging across the IPC boundary (console + file + webview) | `lib.rs` log plugin, `lib/log.ts` |
| Settings persistence incl. mic device selection | `settings.rs`, `SettingsModal.tsx` |

## Known issues / tech-debt inventory

Ranked roughly by "will bite us next."

### R1 · CEFR handling — **SHIPPED including PRE-A1, adaptive remains open**
The steer row offers Absolute zero (PRE-A1) → A2/B1/C1 into every prompt.
PRE-A1 activates a true-beginner survival mode in the persona: one new
phrase per reply, modeled answers, sub-six-word sentences, a 1-10 counting
and greetings core. Fine-grained/adaptive leveling (driven by
`Profile.level_notes` evidence) remains future work.

### R2 · Contract drift: TS `Settings` missing `observer_model` — **FIXED**
TS type now mirrors the Rust struct and the Settings modal exposes the
observer model; saving no longer silently resets it.

### R3 · Testing/CI — **green**
Unit tests exist (8 Rust + 12 vitest covering the pure functions that bit
us, plus an `#[ignore]`d model-bench harness for LLM candidate evaluation)
and `.github/workflows/ci.yml` runs frontend / Rust / docs jobs. All three
job commands pass as of 2026-09-01 (A1). Still missing: a lint config for
the frontend, and any test above the pure-function layer.

### R4 · Conversation history not persisted — **designed, folded into Observability**
Turns live only in React state. Continuity across restarts is carried solely
by plan/profile. Resolved by design in
[Observability](./observability#persistence): `session.json` for the turn log
and `runs.jsonl` for the trace, in the app config dir (**not** the webview's
`localStorage` — capacity, layer and durability all argue against it), with
an obvious archive-don't-destroy reset control on the main surface. Persisting
runs persists the conversation, so R4 and the trace store are one decision.

### R5 · README overstates key isolation — **FIXED**
Keys no longer travel to the webview at all: `get_settings` returns masked
values (`••••last4`), `save_settings` treats an unchanged mask as
"keep stored key", and `validate_key` resolves masks server-side.

### R6 · One language per install, documents not namespaced — **FIXED (archive + reset on switch)**
On a target/native language change, `save_settings` archives
`plan.json`, `profile.json`, and `coach_thread.json` with a timestamp and
resets the in-memory documents; the GuidedPage detects the pair change and
resets the conversation (turns, reveals, Q&A, coach thread) and fires a
fresh greeting in the new language. Archived files keep every old document
recoverable. Full multi-profile (instant switch-back) remains future work.

### R7 · Observer cadence & architecture — **audited Aug 31, healthy**

Verdict from the observer-thread interrogation: the observer is **alive and
not subsumed by the coach**. It runs every turn (non-overlapping, panic-safe
RAII guard), rewrites plan.json/profile.json, and its output feeds the
worker prompts via `directives_block` — including the newly chained dialect
overlay. The coach has *partially* superseded it (coach corrections will
feed the recast queue at bite 2, replacing the observer's error tracking),
but the observer still owns: session focus, recycle vocab, overload guard,
taught-ledger, and the Profile document. Known staleness vector: observer
model latency (up to ~2min for reasoning models) means the plan trails the
conversation by up to one turn by design — not a bug. The `learner_turns`
counter is dead (removed); `Profile.sessions` still never increments.

Watch-list: steering changes now fire both a scaffold regeneration and a
partner message; the steering effect is gated on settings load so the
greeting (which carries level/topic) is the first steered message and the
first settle never double-sends. Verified Aug 31 — double-greeting on cold
open fixed.

### R8 · `features` is dead weight — **REMOVED**
Field deleted from the Rust wire type, TS type, and the "Grammar spotted"
render block. (Habla·ES leftover; the mechanic cards fully supersede it.)

### R9 · Mobile — **Android SHIPPED**, iOS unscaffolded
Android builds + runs (emulator dev loop + sideload APK, see
[Platforms](./platforms)); manifest carries mic permissions, keyboard
resize fixed, STT format verified webm/opus. Open: iOS scaffolding
(needs Mac + Apple dev account; STT upload type must switch to mp4/aac).

### R10 · Reply `max_tokens: 600` can truncate
Streaming replies cap at 600 output tokens with a bump to 1200 only on the
reasoning-param retry path (`ai.rs:114,161`). Advanced-level replies or
longer greetings risk silent truncation. Consider raising or making it
level-aware.

### R11 · Frontend duplicates language data — **largely fixed**
Display names now come from the shared TS list; Rust remains the deep
authority (overlays, iso639). Full IPC-sourcing deferred until the ladder
adds a second language.

### R12 · Plaintext API keys
Keys sit in `settings.json` in the config dir (chmod-unguarded on Windows).
Acceptable for a PoC; the roadmap answer is OS keychain via a Tauri plugin
(`tauri-plugin-stronghold` or keyring crate), with plaintext as fallback.

### R13 · CSP is null — **FIXED**
Strict CSP in `tauri.conf.json` per Tauri docs (self + ipc + asset only —
the app loads no remote content).

### R14 · Assorted sharp edges — **partially fixed**
- Story cache restore only looks up the `beginner` slot regardless of last
  used level (`StoriesPage.tsx`). — **open**
- Desktop window no longer blocks at 900px: `minWidth` is 360 so the window
  snaps into the same mobile layout as phones (single column, collapsible
  panes) — makes desktop mobile-mode testing trivial.
- Analysis Q&A chat **removed** — the app has exactly two chats: the partner
  conversation and the coach thread. Analysis is a read-only breakdown pane.
- **Voice QA pass**: recording has an explicit ✕ cancel (discard, no
  transcription); any 🔊 click toggles playback with a ⏹ stop affordance
  (global speaking-state ring); speaker button restyled for contrast; the
  button now renders on mobile too (it was hidden by the mobile surface
  toggle); **"Always show romanization"** setting + romanization in the
  gloss popup alongside the translation.
- Steering changes (level/topic) now trigger a partner message: the partner
  acknowledges the new setting and re-opens the conversation with a fitting
  question. Rust `guided_turn(steering)` + frontend effect.
- **Prompt registry**: `Settings.prompt_overrides` plumbed (persisted
  BTreeMap, absent = default). Remaining: the Settings "Prompts" UI section
  with per-prompt edit + reset.
- Stale scaffold chips when generation fails — **fixed**: steering changes
  regenerate scaffolds via a dedicated `generate_scaffolds` command; failures
  surface as a visible ⚠ in the suggestion header (best-available fallback
  remains, now with visible cause).
- `localStorage.skellyspeak_target` can go stale vs. actual settings. — **open**
- Settings modal requests mic permission as a side effect of opening. —
  **fixed**: mic enumeration happens only when the Audio & Voice section is
  visited (the settings shell was also restructured into a two-column
  tree + search — see below).
- Mic auto-stop: **redesigned** — toggle on/off manually; recording
  auto-stops after 20s of silence (WebAudio RMS detection), not 10s wall-clock.
  — **fixed**
- Whisper model, Groq endpoint, upload mime: **centralized as named
  constants** (H5).
- `sanitize_reply` markers are Spanish/English-centric — **documented in
  [Future Work](./future-work) ladder notes** (H7).
- `transcribe_audio` builds a new reqwest client per call (fine at PoC scale).
- Story scaffolds: shape + emptiness now enforced at the schema level
  (`minItems`) — fixed by the flat-schema rework.
- Docs site config has placeholder URL / FreeMoCap footer — **open**
  (cosmetic).

## Audit 2026-08-30 — robustness & mobile pass (in progress)

Full audit findings; worked chunk by chunk, this table is the tracker.

| ID | Finding | Status |
|---|---|---|
| B1 | Observer `observer_running` flag stuck `true` forever if the observer task panicked → observer silently disabled permanently. Fixed with a panic-safe RAII guard. | ✅ |
| B2 | Tab switch (Guided↔Stories) unmounted GuidedPage and destroyed the conversation. Both pages now stay mounted; inactive page is `display:none`. | ✅ |
| B3 | Android back button exits app instead of closing topmost overlay. | ✅ lib/back.ts history-entry stack — opening an overlay pushes state, back closes topmost; wired into word popup, plan drawer, logs panel, Settings |
| M1 | iOS auto-zoom on focus: inputs < 16px font (`.field` 14px, Settings 13.5px). Fix: 16px inputs. | ✅ 16px on ≤860px viewports |
| M2 | Logs fab (fixed bottom-left) overlaps the composer on mobile. Re-dock. | ✅ docked beside the topbar gear |
| M3 | 🔊 button (absolute top-right of bubble) can overlap reply text. | ✅ `with-speak` reserves right padding |
| M4 | Gloss popups clip at viewport edges (x not clamped) — Stories + Guided. | ✅ shared `popupAnchor` clamps x |
| M5 | Plan drawer lacks safe-area bottom padding. | ✅ plus: the drawer had NO CSS at all (never styled) — full drawer styles added |
| M6 | Input semantics: chat input missing `lang` (keyboard predictions), `enterkeyhint`, autocapitalize tuning; Settings inputs need scrollIntoView on keyboard open. | ✅ `lang`/`enterKeyHint`/`autoCorrect`/`spellCheck` on chat input; focus-scroll on modal |
| M7 | Missing `overscroll-behavior: contain` on scrollers; no tap-highlight policy. | ✅ |
| P2 | Diagnostic logs (`[viewport]`, `[mic] peak`) at info level → downgrade to debug. | ✅ |
| S1 | CSP null → strict CSP per Tauri docs (we load no remote content; near-free). | ✅ strict CSP in tauri.conf.json |
| S2 | `get_settings` ships API keys to the webview → masked-keys + save-only. | ✅ masked round-trip: `••••last4`; unchanged masks keep stored keys; validation resolves masks |
| S3 | Keys plaintext on disk → keychain/stronghold later. | ⬜ future |
| H1 | Language lists duplicated (Rust, TS constants, ad-hoc display map in GuidedPage). Single source via IPC. | 🟡 display map now uses the shared TS list; full IPC sourcing deferred |
| H2 | GuidedPage duplication: empty-assistant literal ×2, normalizeDocs call sites ×3 → helpers. | ✅ `emptyAssistant()` + `normalizeDocs` moved to `lib/normalize.ts` |
| H3 | App.tsx dead `settings` value + `localStorage.skellyspeak_target` second source of truth. | ✅ dead state removed |
| H4 | GuidedPage ~990 lines → split components (optional refactor). | ⬜ |
| H5 | Hardcoded constants scattered: mic 10s auto-stop, Whisper model, Groq endpoint, webm mime. | ✅ named constants (MIC_* in GuidedPage, GROQ_STT_*/TTS_* in commands.rs) |
| H6 | `schema_dump` debug bin builds in all profiles — gate or delete. | ✅ moved to `examples/` |
| H7 | `sanitize_reply` markers es/en-centric — fold into future-work ladder notes. | ✅ documented in Future Work dialect notes |
| E1 | No unit tests for the pure functions that bit us: `inline_defs`, `normalizeDocs`, `token-spacing`, `groupSentences/splitSentences`. | ✅ 6 Rust tests (inline_defs regression, mask, migrate) + 12 vitest cases (`npm test`) |
| E2 | No CI: clippy + tsc + docs build gate. | ✅ `.github/workflows/ci.yml` (clippy -D warnings, cargo test --lib, vitest + tsc + vite, docs build) |
| D1 | status.md R-list drifted after the week's fixes — refresh at end of audit. | ✅ |

## What does not exist yet (explicitly)

- Any persistence of chat; any export
- SRS / vocabulary layer
- Cloud TTS: **shipped** (OpenRouter gpt-audio-mini, cached, OS fallback)
  (Web Speech API: 🔊 per bubble + auto-speak toggle); cloud quality upgrade
  is a fast-follow
- Installers for macOS/Linux (`bundle.targets: "all"` but never built or
  tested); iOS scaffolding
- Any test above the pure-function layer — no component tests, no IPC
  round-trip tests, no prompt regression tests
- UI chrome in Arabic — `lib/i18n.ts` localizes to en/fr/es only, so an
  Arabic native speaker gets English chrome around an Arabic conversation
- Onboarding (a first-run flow beyond the Settings modal)
- Telemetry (none, by design)

## Structural refactor (decomposition) — **PASS 1 SHIPPED**

*(see the table below — file sizes and next-pass targets)*

## Audit 2026-08-31 — AI hydration/trigger integrity pass (done)

Findings from the prompt/trigger audit and their resolutions:

| Finding | Fix |
|---|---|
| Dialect overlay never reached the main conversation (only scaffolds/stories) | `guided_turn` directives now chain `dialect → plan → topic` |
| `groupSentences`/`splitSentences` duplicated inside TurnView after extraction (drifted from lib version) | import from `lib/sentences` restored; single copy + unit tests apply |
| Word-spacing (`needsSpaceBetween`) logic lost in TurnView extraction — chat tokens rendered without proper spacing | restored via Fragment-based spacing in `renderTokens` |
| Coach thread state split across GuidedPage and panel → reload races | thread state now lives solely in `CoachAnalysisPanel`; GuidedPage bumps a `threadReload` counter after `coach_thread_clear` |
| Playback stop state could go stale (cloud TTS) | `audio.onpause` also clears the speaking state |

Remaining squishiness watch-list (verify on next use, not pre-emptively coded):
- greeting vs language-change effect ordering (both fire `requestTurn({greeting})`)
- steering debounce (300ms) may double-fire if level+topic change in the same tick


`GuidedPage` dropped from ~1,850 to ~1,100 lines; the extracted pieces:

| Piece | Lines | Contents |
|---|---|---|
| `components/chat/TurnView.tsx` | ~290 | memoized turn renderer, TokenSpan (click/drag/hold/dblclick interrogation), sentence grouping |
| `components/panes/CoachFeed.tsx` | ~100 | per-message coaching card + score meters |
| `components/panes/AnalysisContent.tsx` | ~140 | pinned-turn breakdown + Q&A thread |
| `hooks/useMicRecorder.ts` | ~140 | full mic lifecycle: permissions, capture, silence auto-stop, analyser, Whisper |
| `hooks/useSteering.ts` | ~65 | level/topic steering, persistent toggles, greeting guard |

**Next pass (same pattern, when these files are next touched):**
- GuidedPage remains ~1,100 lines — remaining extractable pieces: the plan
  drawer (render + refresh), the shortcuts hook, and the scaffold
  regeneration hook. Target: GuidedPage as pure state + layout.
- The plan-drawer section renderers repeat a render-list pattern that
  AnalysisContent now encapsulates — fold them on next touch.
- Shortcut logic (`useShortcuts`) and scaffold regeneration (`useScaffolds`)
  are the next two hooks to extract.


File sizes have crossed the threshold where single-file sections hurt:

| File | Lines | Pressure |
|---|---|---|
| `src/pages/GuidedPage.tsx` | ~1,600 | Chat stream, composer, coach pane, analysis pane, split-panel drag, shortcuts, mic, inspection — one god component |
| `src/components/SettingsModal.tsx` | ~580 | Registry-driven but rows embed full JSX; localize/validate logic inline |
| `src/lib/i18n.ts` | ~360 | Fine (data), grows one block per locale |

Planned decomposition (do when touching these files next, not before):

- `GuidedPage` → `components/chat/` (TurnView, TokenSpan, Composer, ScaffoldRow),
  `components/panes/` (CoachPane, AnalysisPane with Q&A), `hooks/` (useReveal,
  useShortcuts, useMicRecorder, useSteering). The token-interaction logic
  (click/drag/hold/dblclick) is the piece most worth isolating — it is shared
  by learner and tutor bubbles and will grow (word-insight hydration).
- `SettingsModal` → row components extracted from the registry; the registry
  itself is the right shape, the rows just need to stop embedding raw JSX.
- Duplication to collapse when splitting: the token-rendering closure appears
  per bubble; the plan-drawer section renderers repeat the same pattern.
- After the split, sweep for cross-file duplication (normalizeDocs callers,
  score meters, popup anchoring) and collapse into `lib/`.

## Audit 2026-09-01 — docs↔code reconciliation

The prose docs had drifted badly behind a week of fast commits. Overview,
Architecture, Ontology and the README were rewritten against the code; the
findings that are **code** problems, not doc problems, are listed here.

| ID | Finding | Severity | Status |
|---|---|---|---|
| A1 | **CI was red** — `cargo clippy --lib -- -D warnings` failed on three warnings. All three turned out to be symptoms rather than lint noise: the unused param was A2, and the never-read `direction`/`romanization`/`dialect_display` were dead precisely because the frontend duplicated the registry (A3). Fixed at the cause, not with `#[allow]`. `--all-targets` is clean too. | high | ✅ |
| A2 | **The language overlay was injected twice into the reply prompt** — the template interpolated both `{overlay}` and `{directives}`, and `directives` already begins with the overlay. `guided_reply_prompt` now takes `directives` only, the same single vehicle the mechanics and scaffolds prompts already used; the unused `target_language` param went with it. | med | ✅ |
| A3 | **Dialect selection silently did nothing off the preset list** — worse than first logged. `overlay()` dropped any unrecognized dialect id, so the drifted TS-only `es-CO` *and* **every free-typed custom variety** produced an empty dialect line, while `DialectField` advertises "…or type a custom variety". Fixed in two places: `overlay()` passes unknown dialects through verbatim via `dialect_display`, and the frontend's duplicate table is gone — `get_languages` serves the Rust registry, awaited once in `main.tsx` before first render. **H1 fully closed.** | med | ✅ |
| A4 | `Settings.prompt_overrides` is persisted but never read — no registry in `prompts.rs`, no UI. **Do not delete it** (reversing the initial call): it is the configuration surface for the agent workbench in [Observability](./observability), where agent id == prompt id. Build the registry in observability bite 2. | med | ⬜ → folded into Observability |
| A5 | `src/types.ts::Settings` omits `prompt_overrides`. Harmless today (object spread carries the unknown key) but the type is a lie — the same class of drift as R2. | low | ⬜ |
| A6 | Stale comments contradicting the code, in `ai.rs` (module doc advertising the removed prompted-JSON fallback; a 429 retry logged as `FALLBACK:`) and `settings.rs` (`tts_engine`/`tts_voice` still described as Groq PlayAI). | low | ✅ |
| A7 | Tracked junk in git: empty `ES` (stray shell redirect), empty `src/bench.rs` (orphan — the real bench is `src-tauri/src/bench.rs`), and `scratch--mic-waveform-visualizer-extract/`. | low | ⬜ |
| A8 | `Profile.sessions` still never increments (rendered in the Plan drawer as "0 sessions" forever). Carried over from R7. | low | ⬜ |
| A9 | Docs site deploy config still placeholder: `url: https://github.com`, FreeMoCap footer/Discord links. Carried over from R14. | low | ⬜ |

Doc-side corrections applied in the same pass (no code change needed):

- The **assist dial (0–3) no longer exists** — it was the centerpiece of
  Overview and Ontology and had been fully replaced by the steer row
  (level + topic) plus per-token tap-to-reveal. Both pages rewritten.
- Architecture claimed **six** IPC commands; there are **fourteen**. Table
  rebuilt, plus the `coach_done` / `coach_failed` channel events.
- Analysis is **five** parallel workers (the learner-tokens pass was
  missing), and the coach is a fourth agent role.
- Every line count in the module map was 2–3× low.
- Ontology's Settings table was missing `target_dialect`, `always_romanize`
  and `prompt_overrides`, listed `observer_model` twice, still carried the
  removed `features` field, and was missing `user_tokens` /
  `user_translation` / `errors` / `romanization`.
- Ontology said 10 target languages and 9 natives; there are 4, symmetric.
- README advertised a prompted-JSON fallback that the code explicitly
  refuses to have.

## Suggested order of battle (small bites)

1. ~~A1 / A2 / A3~~ — **done 2026-09-01.** CI green, reply-prompt overlay
   de-duplicated, language registry single-sourced over IPC.
2. **A4/A5/A7** — remaining hygiene: delete the dead `prompt_overrides`
   field, fix the TS `Settings` type, untrack the junk files.
3. ~~Observability bite 1~~ — **done 2026-09-01.** Agent registry, `Run`
   record, trace bus, Runs tab. Every AI call now has an identity, a turn
   lineage, timings, usage and a legible attempt chain.
4. ~~Observability bite 1.5~~ — **done 2026-09-01.** Honest ontology (two
   agents, not thirteen), the graph declared as data in `graph.rs`, and the
   live Graph view (D2/D3).
5. **[Observability](./observability) bite 2** — the prompt registry and
   `PromptRecord` provenance. **Current focus**, and the prerequisite for
   every learner-facing rung.
6. **Observability bite 3 = R4** — `session.json` + `runs.jsonl` + the reset
   control. Persisting runs persists the conversation, so these are one piece
   of work, not two.
7. **Observability bites 4–5** — the 💭 agent bubbles and the workbench. The
   first learner-facing half of the design.
8. **Coach bite 2** — coach corrections feed `plan.recurring_errors`
   mechanically. Cheap, and it retires the observer's weakest duty.
9. **Future Work bite 1** — the es-ES dictionary layer. Kills the biggest
   latency and consistency problem in the product — and bite 1 above is what
   will let us prove it actually did.
10. **R12 (keys in the OS keychain)** — before any distribution.
11. **iOS scaffolding** — after the STT mime fix (`platforms.md` §4).
