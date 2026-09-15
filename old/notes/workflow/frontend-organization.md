# Frontend reorganization (living document)

Status: **living work order**, updated as each stage lands. The Zustand state
migration is a **separate follow-up task**; its inventory lives in
[`state-migration-plan.md`](./state-migration-plan.md), which this reorganization
maintains but does not implement.

**Git:** agents never stage or commit. Every stage ends on a green tree and is
handed back for the user to commit.

## Rules adopted

1. Delete unreachable code transitively; Git history is the archive.
2. No path aliases — imports stay relative.
3. Vocabulary `app/ features/ ui/ platform/ domain/`; `domain/` is pure
   (no React, no Tauri); `ui/` holds shared primitives with no domain knowledge.
4. Living docs are updated; dated `workflow/reports/*` are frozen and never edited.
5. Boundary rules are enforced by a **failing** test; the dead-code check **warns**.
6. Path-locked files stay put unless the lock is changed in the same commit:
   `src/contracts.ts` (written by `src-tauri/src/bin/export-contracts.rs`),
   `src/assets/skill-catalogs/catalog.json` (`include_str!` in `src-tauri/src/coaching.rs`),
   `src/styles.css` (hardcoded in `scripts/check-styles.ts`).

## Baselines

| Checkpoint | `tsc --noEmit` | app test files | app tests | docs tests | `npm run build` | `styles:check` |
|---|---|---|---|---|---|---|
| Start of session | **1 error** | 86 passed, 1 suite failed | 419 | not reachable from root | **failed at tsc** | pass |
| After Stage 0 | clean | 86 | 419 | 28 | pass | pass |
| After Stage 1 | clean | 72 | 373 | 28 | pass | pass |
| After Stage 2 | clean | 74 (72 app + 2 `src/architecture`) | 378 passed, 6 skipped | 28 | pass | pass |
| After Stage 3 | clean | 75 | 390 passed, 5 skipped | 28 | pass | pass |
| After Stage 4 | clean | 75 | 394 passed, 1 skipped | 28 | pass | pass |
| After Stage 5 | clean | 74 | 393 passed, 0 skipped | 28 | pass | pass |
| After Stage 6 | clean | 74 | 393 passed, 0 skipped | 28 | pass | pass |

## Stage 0 — repaired the gates

- `src/components/WaveformStrip.test.tsx`: `getContext` is overloaded and ends with
  the WebGPU signature, so a bare `vi.spyOn` inferred `GPUCanvasContext`. The spy is
  now narrowed to the 2D signature the component calls. The test's assertions are
  unchanged.
- `vite.config.ts`: `skellyspeak-docs/**` added to `test.exclude`, so the root suite
  is the app. Previously the root run pulled in the docs project's test, which needs
  that project's own install.
- `vitest.docs.config.ts` (new) + `package.json` `docs:test`: the docs suite runs
  under its own config (node environment, no app setup files), mirroring how
  `scripts/**` is driven by `npm run logs:test`.
- `.github/workflows/ci.yml`: runs `npm run docs:test` after
  `npm ci --prefix skellyspeak-docs`, so the docs coverage that the old root run
  provided is preserved rather than dropped.

## Stage 1 — deleted unreachable code

46 files, 2795 lines removed. Reachability is computed from `src/main.tsx` (plus
`src/test/setup.ts`, which vitest loads by config) and iterated to a fixed point, so
files that only became unreachable after a first deletion are caught too.

| Group | Files |
|---|---|
| Orphans with no importer at all | `Disclosure`, `PausedBanner`, `PersonaModal`, `PersonaSummary`, `Pronunciation`, `RunsView` |
| Retired graph workspace, reachable only from its own test | `dev/DevPanel`, `dev/PanelBoundary`, `dev/RunDetails`, `dev/RequestReader`, `dev/activity`, all of `graph/` (5 files), `hooks/useAiActivity`, `lib/gate`, `lib/actor`, `lib/useDragSize` |
| Unmounted lesson surface | `panes/LessonContent`, `panes/LessonEditor`, `panes/LessonProgress`, `panes/SkillPracticeBoard`, `panes/TopicExplanation` |
| `lib` modules whose only importer was their own test | `conversation`, `media`, `normalize`, `quota`, `secrets`, `personaLabel` |
| Tests of the above | 14 test files |
| Manual dev harness, unreferenced by `index.html` and `vite.config.ts` | `reward-preview.tsx` |

Accompanying edits:

- Removed 4 now-unresolvable `vi.mock` paths (`App.navigation.test.tsx` ×2,
  `GuidedPage.conversation.test.tsx`, `LogsOverlay.boundary.test.tsx`). The
  `LogsOverlay` boundary test also loses its `DevPanel` mock and the two assertions
  that only checked that mock; its real invariant — no native graph work — is unchanged.
- `lib/store.ts` pointed readers at the note in `gate.ts` for when Zustand becomes
  justified. That criterion was captured into `state-migration-plan.md` **before**
  deleting `gate.ts`, and the pointer now names that document.
- `lib/faults.ts` described sharing its observable primitive with "the pipeline gate",
  which no longer exists.

### Deferred to Stage 5 (reachable, but with zero consumers)

`TopicNotesProvider` + `TopicNotesContext` + `lib/topic-notes.ts` are still mounted by
`GuidedPage` but nothing reads them, and `DraftAssistanceContext` has no consumers.
They are not unreachable, so reachability does not remove them; they need a small edit
to `GuidedPage`. Best done in Stage 5 when that file moves.

### Method note

The first derivation of the deletion set produced 67 files and wrongly included
`pages/SkillsPage.tsx` and everything behind it. Cause: a bug in the ad-hoc extraction
command that mislabelled dynamic `import()` edges in flat directories, dropping
`App.tsx → ./pages/SkillsPage`. A count assertion plus a sanity list of known-live
files caught it before anything was deleted. **Stage 2's `import-graph` module must be
a real tested module, not a shell pipeline**, precisely because this failure mode is
silent and catastrophic.

## Stage 2 — tooling

| Artifact | Purpose |
|---|---|
| `scripts/import-graph.ts` | The shared resolver: extracts every relative and bare specifier, resolves it against a repository-wide file and directory index, builds the edge graph, and walks reachability from `src/main.tsx` + `src/test/setup.ts`. Also a CLI (`npm run graph`). |
| `scripts/refactor-move.ts` | Map-driven move codemod (`npm run move`). Rewrites each moved file's own relative imports *and* every importer's path to it, for static, type-level, dynamic, `vi.mock`/`vi.importActual` and `new URL(..., import.meta.url)` forms. Reports by default; `--write` applies. |
| `src/architecture/boundaries.test.ts` | Boundary rules that **fail**. Rules whose layer does not exist yet are skipped, so the suite tightens by itself as `domain/`, `ui/`, `platform/`, `features/` and `state/` appear. |
| `src/architecture/dead-code.test.ts` | **Warns** (never fails) about production modules no entry point reaches, and asserts the walk still reaches a curated list of modules — the guard against the tool itself silently collapsing. |

Verification that the tooling works, not just that it exists:

- The boundary rule **fails** on an introduced violation. A throwaway `src/lib/__probe.ts` importing `../components/InfoTip` produced
  `new violations of "shared modules do not reach up into presentation": ["src/lib/__probe.ts -> src/components/InfoTip.tsx"]`.
- The dead-code check **warns and passes**, naming `src/lib/__probe-dead.ts` while the suite stayed green.
- The codemod was rehearsed on a real Stage 4 move (`src/pages/skillTree.ts` → `src/domain/skills/skillTree.ts`): 14 specifiers across 12 files, correct in both directions — importers re-pointed, and the moved file's own `../assets/...` imports re-depthed.
- The `--write` path was applied end to end on a throwaway probe: file moved, importer rewritten to `../domain/probe/__mv-probe`, parent directories created.

Five defects were found and fixed while building this, each of which would have caused silent damage:

1. The first version scanned the repository root, descended into `node_modules`, and double-prefixed paths.
2. It captured only *relative* specifiers, so bare imports (`react`, `@tauri-apps/*`) were invisible — which the domain-purity and "only platform touches Tauri" rules depend on.
3. `new URL('../../', import.meta.url)` was reported as a broken path. Directory references needed directory awareness and trailing-slash normalization.
4. The codemod appended `.ts` to extensionless specifiers (`../../pages/skillTree` → `...skillTree.ts`), which `tsc` rejects under bundler resolution. Caught by rehearsing a real move before applying anything.
5. `npm run move -- <map> --write` silently drops `--write` — npm consumes it — and reports a move it never made. The script now prints `mode: APPLY` or `mode: REPORT ONLY` before anything else, and its header says to pass the flag to `node` directly.

## Stage 3 — `App.tsx` is now a six-line entry point

`src/App.tsx` went from **425 lines to 6**: it composes the skill-navigation provider
and the shell, and nothing else. `app/AppShell.tsx` (271 lines) holds the app-wide
state and the page composition, which is the layer the Zustand task will drain.

| New file | Lines | What it was inside `App.tsx` |
|---|---|---|
| `app/AppShell.tsx` | 271 | the `Application` component: all app state, the data effects, page composition |
| `app/navigation.ts` | 2 | the `Page` union |
| `app/shell/TopBar.tsx` | 89 | the topbar: contacts toggle, wordmark, surface tabs, action cluster |
| `app/shell/PageBoundary.tsx` | 28 | the render-crash boundary class |
| `app/shell/FaultBar.tsx` | 25 | the fault strip, now returning `null` when there is nothing to show |
| `app/shell/MoreDialog.tsx` | 21 | the narrow-window overflow menu |
| `app/shell/MobileNav.tsx` | 17 | narrow-window surface navigation |
| `app/shell/NotTauriNotice.tsx` | 11 | the "run it with `npm run tauri dev`" notice |
| `app/shortcuts/useTextSizeShortcut.ts` | 36 | the reading-size keyboard listener and the native View-menu listener |
| `app/shortcuts/useSettingsShortcut.ts` | 24 | the configurable Settings shortcut |
| `app/shortcuts/useReloadShortcut.ts` | 17 | the reload shortcut |
| `features/settings/LanguagePickers.tsx` | 37 | the target- and explanation-language `<select>` blocks that were inline JSX passed as props |

Two kinds of change were made deliberately:

- **State stayed put.** Settings, AI access, faults, navigation and skill evidence are
  still local state in `AppShell`; migrating them is the separate Zustand task. Only
  *components* and *pure side-effect adapters* moved, so the store work is not done twice.
- **Two callback identities were stabilised.** `settingsChanged` and `changeFontSize`
  became `useCallback` so the extracted shortcut hooks can depend on them without
  re-subscribing a window listener on every render. Neither reads component state, so
  the closure is not a behaviour change.

Also removed: an orphaned comment block about `PausedBanner`, the component deleted in
Stage 1. It described a paused-pipeline banner that no longer exists.

**The manual app run is a user check, not something this agent can perform.** There is no
GUI to click through here. What compensates: `src/App.navigation.test.tsx` renders the
real `App` — so the real `AppShell`, `TopBar`, `MobileNav`, `MoreDialog`, `FaultBar`
and `PageBoundary` — with only the pages and modals mocked, and it asserts the mobile nav
labels, the draft surviving surface switches, the More dialog, and the AI panel opening
and closing. The new `app/shortcuts/shortcuts.test.ts` adds 11 cases for the extracted
listeners, which previously had none. `useReloadShortcut` is deliberately not covered:
jsdom makes `window.location.reload` non-configurable, and adding an injection seam to
production code purely for a test is not worth it — the predicate is covered by
`lib/reload.test.ts`, and the test file says so.

One boundary rule silently **activated** here: `src/features/` now exists, so
"features are independent of one another" runs instead of skipping. Skipped rules went
from 6 to 5.

## Stage 4 — `lib/` is gone

The move codemod did the work: **71 files moved, 221 specifiers rewritten across 103
files**, and `src/lib/` no longer exists. `tsc` was clean on the first run after the move.

```text
src/platform/ipc/          tauri, native, workspace, store, window, reading-size
src/platform/diagnostics/  log, faults
src/platform/audio/        speech, audio-volume, reward-sounds
src/platform/              skill-evidence, updater, playback-lifecycle, topic-notes
src/domain/skills/         skills, skill-domains, skill-index, skillDemo, skill-rewards,
                           practice-statistics, message-evidence, skillTree
src/domain/language/       i18n/ (index + 5 locale files), sentences, source-token,
                           token-spacing, conversation-view, turns
src/domain/audio/          audio-settings, browser-recording, waveform
src/domain/reward/         reward-anchors, reward-pulse, reward-trails
src/domain/input/          keyboard, font-size, reload
src/domain/update/         semver        src/domain/access/  providers
src/ui/Markdown.tsx        src/app/shell/back.ts
```

### The rule that made this possible: platform is I/O, domain is pure

A first measurement showed the skill cluster could not be pure: **seven skill modules
transitively depended on `tauri.ts`** through one hub, `skills.ts`, because
`getSkillEvidence` reads settings over IPC. That single edge would have forced
`message-evidence`, `practice-statistics`, `skill-domains`, `skill-index`,
`skillDemo` and `skill-rewards` into `platform/` — turning it into the same kind of
dumping ground `lib/` was.

Measuring the consumers settled it: **only two files import the IPC functions.** The hub
was split in place — `src/domain/skills/skills.ts` keeps the snapshot types and the credit
arithmetic, `src/platform/skill-evidence.ts` keeps the four functions that cross IPC.
Pure-eligible modules went from **17 to 24**, and `platform/` stayed a boundary rather
than a bucket.

Two more couplings were repaired the same way rather than preserved:

- Both `browser-recording.ts` and `useMicRecorder.ts` imported the `WaveSource` type
  from the `WaveformStrip` **component**. The type moved down to `domain/audio/waveform.ts`;
  the component now imports it from there.
- The boundary rule "only platform touches Tauri" activated the moment `platform/`
  existed, and failed with three offenders. Rather than allowlist them, each got a real
  door: `platform/ipc/window.ts` (`currentWindowLabel`), `platform/ipc/reading-size.ts`
  (`onReadingSizeAction`), and `appVersion`/`openDownloads` on `platform/updater.ts`.
  `main.tsx`, `useTextSizeShortcut.ts` and `SettingsModal.tsx` now call those.

`i18n.ts` (599 lines, five ~112-line dictionaries) was split into
`domain/language/i18n/index.ts` (47 lines) plus `dict.ts` and `locales/{en,fr,es,ar,zh}.ts`.
The file was CRLF, so the splitter detects and preserves the original line ending — a
naive `split('\n')` also failed to find the block terminators.

### Result: the allowance list is empty

All eight allowlisted violations are gone, and **four rules activated** as their layers
appeared: domain purity, ui purity, "only platform touches Tauri", and "platform does not
reach up". Six rules now run where five did; one remains skipped, waiting on `src/state/`
in the Zustand task.

Two defects were caught by the gates while building this:

1. Adding `appVersion` to `SettingsModal` collided with a local `useState` of the same
   name — `tsc` reported the import as unused and the call as "not callable on type
   String". Renamed to `loadAppVersion`.
2. The dead-code guard's own `CRITICAL` list still named `src/lib/{tauri,faults,store}.ts`
   and failed. The guard is doing what it was written for: it refuses to pass while it is
   referencing modules that no longer exist.

## Stage 5 — the tree is now the target shape

**112 files moved, 213 specifiers rewritten.** `src/components/`, `src/hooks/` and
`src/pages/` no longer exist.

```text
src/
  main.tsx  App.tsx  contracts.ts  types.ts  styles.css
  app/          AppShell, navigation, shell/ (TopBar, FaultBar, MobileNav, MoreDialog,
                PageBoundary, NotTauriNotice, UpdateBanner, back is in platform),
                shortcuts/ (3 hooks + keyboard/font-size/reload live in domain/input)
  features/
    guided/     GuidedPage, chat bubbles, coach + analysis panes, contacts, rewards,
                composer, history, the guided hooks
    skills/     SkillsPage, TreeCamera, skills.css, the skill detail/progress views
    settings/   SettingsModal, SettingsAccess, FactoryReset, DialectField, pickers
    activity/   LogsOverlay, LiveActivity
  state/        useSkillEvidence, useSkillNavigation
  ui/           the shared primitives: TargetText, TokenSpan, DetailDialog, InfoTip,
                ErrorDetails, ActivityIndicator, ToolbarIcon, WaveformStrip,
                ReadingPreferences, Markdown, and the viewport/overlay hooks
  platform/     ipc/, diagnostics/, audio/, skill-evidence, updater, playback-lifecycle, back
  domain/       skills/, language/, audio/, reward/, input/, update/, access/
  architecture/ the boundary and dead-code tests
```

### The rules found real problems, and were obeyed rather than relaxed

- **"features are independent" fired immediately.** `features/guided/GuidedPage.tsx`
  imported three components from `features/contacts/`. Tracing the consumers showed
  contacts had **exactly one consumer** — the guided surface — so it was not an
  independent feature at all. The five files moved into `features/guided/`, and the
  `features/contacts/` folder is gone. It becomes its own feature when it owns a surface
  of its own.
- **`back.ts` could not stay in `app/shell/`.** `ui/useOverlayLayer.ts` imports it, and
  `ui/` may not reach up into `app/`. It is browser history/popstate integration with no
  React and no Tauri, so it moved to `platform/back.ts`, where every layer may use it.

### Zero-consumer providers removed

Stage 1 could not delete these: they were *reachable* (mounted by `GuidedPage`) but had no
consumers. With the file open anyway, they went: `TopicNotesProvider.tsx`,
`platform/topic-notes.ts`, its test, and `DraftAssistanceContext` — along with the two
now-dead locals in `GuidedPage` (`bestScaffolds`, `chipsForUI`) and a stale `vi.mock`.

### `state/` exists — a deliberate deviation, recorded

The agreed plan put `state/` in the Zustand task. It is here a stage early, holding
`useSkillEvidence.ts` and `useSkillNavigation.tsx` — the two pieces of *shared* state that
more than one feature consumes. The alternatives were worse: `ui/` would have been a lie
about what they are, and `features/guided/` would have made `features/skills` and the
profile overlay depend on another feature.

**This is not Zustand.** `state/` currently contains the same hand-rolled
`createContext` + `useSyncExternalStore` code as before, moved. The follow-up task
replaces the implementations in place. Creating the folder also activated the last
skipped rule, so the invariant the store work must keep is now enforced.

### Rules updated

`shared modules do not reach up into presentation` was removed: `lib/`, `hooks/`,
`components/` and `pages/` are all gone, so it could never fire again. It was replaced by
**`features do not reach up into the shell`**, which guards the `app → features`
direction. Seven rules now run and **none are skipped**.

## Stage 6 — docs and dead CSS

**Living docs.** Zero stale `src/` paths remain. `skellyspeak-docs/docs/architecture.md`
gained a "Frontend layout" section stating the layer table and the direction each layer
may import, plus the three paths that are fixed by files outside `src/`
(`contracts.ts`, `assets/skill-catalogs/catalog.json`, `styles.css`). `overview.md` and
`workflow/README.md` were repointed, and `workflow/README.md` no longer describes six
worktrees — work happens in a single tree now. Dated `workflow/reports/*` were left
untouched, as agreed.

One documentation-truth problem surfaced rather than a path rename: `overview.md`
documented a persona template library with *Duplicate & edit*, and its component
(`PersonaModal`) was unreachable code deleted in Stage 1. `UI-SURFACES.md` already
records that lifecycle as deferred, so the section now says so plainly and names what
does exist — the persona IPC in `platform/ipc/tauri.ts` and the contact profile dialog.
No surface consumes the persona IPC today.

**Dead CSS.** `styles.css` went **2255 → 1536 lines** — 719 lines, 32%. Names are
protected in two ways: anything matching a fragment the source composes at runtime
(`s-${state}`, found by scanning for template-literal prefixes) and anything owned by a
dependency (`react-flow__*`). A scan confirmed **no class name is built by string
concatenation**, so template literals were the only composition pattern to guard.

The first pass was **not exhaustive**: it deleted a rule only when *every* class in the
selector was unused, so a dead class sharing a rule with a live one survived. A review
caught this. The prune now works per **selector part** — `.live, .dead` keeps `.live`,
and `.dead .live` goes entirely because the ancestor can never exist — which removed a
further 65 rules and 84 selector parts.

That exposed a second problem: collapsing `A, .dead` onto a selector another rule already
used produced **three duplicate selectors**, which `styles:check` rejects. The prune now
**merges** those, moving the earlier rule's remaining declarations into the later one —
the position where the cascade already gave them precedence, so nothing changes. Verified
by hand: `.nav-item.active` lost only an exact duplicate, and `.conversation-title small`
and `.trans` kept every declaration.

The check is now permanent rather than a one-off: `scripts/prune-styles.ts` exposes
`analyseStyles`, the dead-code test warns from it, and `npm run styles:dead` reports while
`npm run styles:prune` fixes. It currently reports **0 unused classes**.

Verified by `npm run styles:check`, the full suite, the production build, and
`skellyspeak-docs`: `docusaurus build` generates static files successfully.

**Not verifiable here:** that the app still *looks* right. CSS removal cannot be proven
by a test suite; the pruned stylesheet needs a visual pass in `npm run tauri dev`.

## Review follow-up

An independent review of the finished work produced eight items. Six were real and are
fixed; three claims were checked and did not hold.

**Fixed**

| Item | Change |
|---|---|
| Worktree text still in living docs | `workflow/README.md` (two places) and `README.md` now describe a single working tree |
| Stale/historical comments in moved code | `AppShell` cited `(lib/i18n)`; its settings comment narrated a past race; both rewritten to state the current rule |
| Hardcoded fake UI state | `const aiBusy = false` fed a `busy` class that could never apply. Removed from `AppShell` and `TopBar` — behaviour identical, and the dead `.inside-btn.busy` rules went with it |
| Silent skip path in the boundary test | `activatesWith` made a rule `it.skip` when its folder was missing; every folder exists now, so a future deletion would have quietly disabled a rule. Removed — all seven rules always run |
| Unexplained swallowed rejection | `platform/ipc/tauri.ts` settings queue now says why the tail swallows: sequencing only, the rejection still reaches the caller |
| Dead CSS survived the prune | Per-selector-part pruning plus duplicate merging, and a permanent check (above) |

**Checked and not a defect**

- `platform/playback-lifecycle.ts` **must** stay in `platform/`: it imports
  `@tauri-apps/api/window` and `@tauri-apps/api/event`, and the "only platform touches
  Tauri" rule enforces exactly that.
- `ProgressSummary` has **two** consumers, not one — `AppShell` and
  `features/guided/ConversationProgress`. Moving it to `features/profile/` would create a
  cross-feature violation, which the features-independence rule forbids.
- The two "swallowed rejections" in `ContactProfile` and `DifficultySelect` are correctly
  owned. `ContactProfile` sets its error at `ContactProfile.tsx:39` and renders it with a
  retry button at `:58`; `useConversationDetails` sets the error at `:44` that
  `ConversationHeader` displays. The `catch` only stops a `void`-ed promise from
  rejecting unhandled.

**Acknowledged:** "425 → 6" describes the entry point, not the slimming. The app-wide
state did not disappear — it moved into `app/AppShell.tsx`, which is the layer the
Zustand task drains. That is where the real reduction happens.

## Integration with the parallel speech and contact work

A second agent worked in this tree while the Zustand migration was finishing; its work
landed on top of it. It was reviewed for alignment rather than merged blind.

**What it did.** Cloud speech playback left the platform layer.
`platform/audio/speech.ts` is playback *authority* only — 28 lines, `registerSpeechPlayback`,
`setPlaybackAllowed`, `setVoiceVolume`, and no audio of its own — while
`features/guided/speech-player.ts` creates, plays and releases one utterance from a
`SpeechAudioState`. The JS-side synthesis cache, in-flight sharing and language-pair scope
cache are gone because synthesis is a core command now (`read_speech_audio`):
`useMessageSpeech` polls the contract and plays what comes back. The OS-voice path
(`speakSmart`, `ttsAvailable`, `speechSupported`) is deleted with its tests, and
`SettingsModal`'s OS-voice-only toggle went with it. Separately, the static persona list
(`Persona`, `PersonaList`, `listPersonas`) left `platform/ipc/tauri.ts`; contacts are
generated through one structured call, `generateContact` → `generate_contact`
(`lib.rs:459`, registered at `lib.rs:836`).

**Aligned, and checked rather than assumed**

- **Layering holds.** `features → platform` is the allowed direction and the one used;
  `platform/audio/speech.ts` imports nothing and cannot reach upward. The boundary test,
  the import graph (0 unresolved, 0 unreachable) and the dead-code check all pass.
- **The module-level state is the right kind.** `let active` (platform) and `let current`
  (the player) are resource handles owned by an imperative audio subsystem that no
  component renders. The rule is *state a component renders lives in a store*, not *no
  module state anywhere*; no store was duplicated or bypassed by this work.
- **Coverage moved instead of vanishing.** The deleted `speech-playback.test.ts` covered
  lifecycle suspension, live volume, mute-by-ending and exclusivity. The same four are
  covered for the surviving implementation in `speech-player.test.ts`, which also says in
  a comment why it restores module state by hand.
- **Nothing of the Zustand migration was reverted.** `AppShell` is still composition only,
  the overlay store, the store-backed evidence and the direct store tests are intact, and
  the suite is 75 files / 402 tests.
- **Not a defect:** the `/** */` and `///` doc-comment split (55 against 491) predates this
  work and is spread over 40 files. Not worth a churn pass; new code follows `///`.

**Left as is, deliberately:** `speech-player.ts`'s `PlaybackHandle` is a superset of
platform's `ActiveSpeechPlayback` and satisfies it structurally, so registration is
type-safe without the feature importing the platform interface. If a second playback kind
appears, promote the interface into `platform/audio/speech.ts` and import it.

## Outstanding

- **Visual verification.** The dead-CSS prune, the regroup and the speech rewrite cannot be
  proven by the test suite. Run `npm run tauri dev` and check Guided, Skill tree, Settings,
  the AI activity panel, the mobile nav, the font-size and settings shortcuts, one fault,
  and — since the speech rewrite — speaking a reply, changing voice speed and the voice
  volume, and backgrounding the window mid-utterance (playback must end, not resume). The
  persona editor and the Generate persona control have not been opened in the running app.
- **Persona generation is not in operation tracking.** It dispatches outside the turn graph,
  so a generation does not appear in AI activity. The design it needs is written up in the
  decisions below; it is the first item of the next chunk of work.
- **The generation request itself is untested.** `apply_generated_persona` covers everything
  after a completion arrives, including both failure outcomes, but nothing drives the HTTP
  call or a stubbed provider.
- **Nothing is committed.** Git is read-only for agents; the change set sits in the
  working tree.

## Persona and contact: current decisions

Recorded after the reorg agent signed off, when the persona/contact work was completed.

- **Naming is two concepts, and "partner" is gone.** A **persona** is the authored
  personality (`PersonaDetails`: name, age, location, occupation, background, current
  situation, interests, opinions, interesting facts, manner, quirks, vibe, avatar). It owns
  the "persona" wording in the UI: the right-pane tab, the profile editor, the generation
  control, and the `PersonaProfile*` components. A **contact** is the container that points
  at one persona and owns its conversations and statistics. It owns the list-entry and
  history wording: the drawer chooser, the conversation list, the mobile nav. A
  case-insensitive search for `partner` or `relationship` returns nothing in
  `src-tauri/src` or `src`. Tables are `personas` and `contacts`; the conversation
  column is `contact_id`.
- **One persona per contact.** `contacts.persona_id` is unique, and `DeleteContact`
  removes the persona row, so the cascade takes the contact and its conversations with it.
- **One schema, no upgrade path.** `schema.sql` is the whole schema at `user_version` 11.
  The five `*-schema.sql` upgrade files and every version branch in `Store::open` are
  deleted. An empty file is created at the current version, a file at exactly that version
  opens, and anything else is refused with a storage error naming Factory Reset, leaving the
  file untouched. Covered by `an_empty_workspace_opens_at_the_one_supported_version` and
  `any_other_schema_version_is_refused_without_modifying_the_file`.
- **Persona limits are defined once**, in `src-tauri/src/persona.rs`, and read by both
  `persona::validate` and `persona::output_schema`. Vibe is 2–4 emoji; lists are bounded,
  nonempty, single-line and distinct; the generation schema sets `minLength` and
  `uniqueItems` from the same constants.
- **Emoji recognition follows default presentation.** `emoji.rs` uses the
  `Emoji_Presentation` Unicode property with presentation selectors and flag pairs, so
  "↔", "▪", "⬀" and "☀" are refused while "↔️", "▪️" and "☀️" are accepted.
- **The starter persona is authored, never generated, and cannot panic.**
  `persona::starter` returns an error for an unknown language, and a test walks the language
  registry to prove every registered language has one that validates. Startup therefore
  never calls a model.
- **Credential identifiers are recorded outside the database, before the secret
  exists.** A factory reset must remove keychain entries even when the workspace cannot
  be opened, and the identifiers otherwise live in `ai_config` — the table a refused
  workspace cannot be read from. `Application::write_credential_with` appends each id to
  `<app data>/credentials.index` *before* the keychain write, so the id is durable before
  any secret can exist; the file holds identifiers only, never secrets, is append-only, and
  is erased with the data directory. `factory_reset` removes the union of that index and
  whatever an open database reports, so it is correct in both states.
- **A refused workspace opens a window.** `setup()` no longer aborts when `Store::open`
  fails: the reason is held on `Application` and `get_startup_state` reports it while every
  other command returns it, so the shell is never mounted against a missing store.
  `main.tsx` checks that command before initialising and renders the reason with a single
  Factory Reset button. That button cannot ask for a typed confirmation, because the app
  that would ask is the one that cannot start, so it names the action and carries the
  consequence in its tooltip; the in-app reset keeps its typed confirmation.
- **The reset treats the data directory as its subject and the rest as derived.** A failure
  to clear the data directory is reported and stops the reset. A failure to clear the cache
  or log directory is tolerated, because on Windows the running webview holds files inside
  its cache: failing there used to return before `app.exit(0)`, so a reset that had already
  erased the workspace reported the deletion and left the app open. Secrets and workspace
  data still fail loudly; only derived directories are best-effort.
- **The OS-voice option and its Settings control are removed, deliberately.** Native
  validation pins `speech_voice` to `alloy` (`languages.rs`) and the speech provider
  keeps its own voice allowlist, so the picker could only ever save one value and every
  other choice failed. `tts_engine` and the per-conversation voice picker are gone; the
  conversation's own `speechVoice` is preserved on write instead of being projected
  through the view.

- **The chat header owns the persona choice.** `PersonaPicker` shows the contact being
  spoken with — its persona's avatar and name — lists every contact for the target
  language, and ends with "+ New persona…". Choosing one opens that contact's most recent
  conversation, or gives them their first. Contact selection no longer lives in the history
  drawer, which now lists conversations for the current contact and offers New conversation.
  The Persona tab shows the persona being talked to and nothing that could overwrite it by
  accident; editing happens through Edit persona, which opens the existing dialog.
- **Creating a persona is one action, and generating is none.** `generatePersona(languageId,
  brief)` is one structured call that returns a validated `PersonaDetails` and persists
  nothing, so a discarded proposal costs the call and nothing else. `CreateContact {
  languageId, details }` is the single creation action: it validates, then creates the
  persona, the contact and their first conversation. The New Persona dialog offers writing,
  describing and Surprise me, and all three fill the same form, so review and Create are the
  same step for each. Cancel writes nothing.
- **The form's limits are generated, not copied.** `PERSONA_LIMITS` in `src/contracts.ts`
  comes from `persona.rs` through `npm run contracts`, and the form's messages match the
  store's wording, so a field that fails on blur reads the same as a create that fails on
  the wire.

**Left open: generation is not in operation tracking.** Generation supplies real, unique
`attempt` and `operation` identities because the grouped transport keys its batch by them,
but no row backs them, so a generation does not appear in AI activity. Doing that properly
means letting a turn exist without a conversation: `turns.conversation_id` is `NOT NULL`,
every operation kind must be declared in `PLAN` or `COACH_PLAN` and resolve dependencies in
`conversation_snapshot`, and `finish` would need a generation branch plus a frontend that
watches a turn rather than awaiting a command. That is a change to the execution model, not
a cleanup.
