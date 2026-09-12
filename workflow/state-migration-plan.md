# Zustand migration plan (living document)

Status: **work order**, ready to build from. The frontend reorganization it was written
alongside is complete and committed; this document describes the state as it now stands,
not as it was mid-move.

The stores themselves are a **separate task**. Nothing here is implemented yet: `state/`
currently holds the same hand-rolled `createContext` + `useSyncExternalStore` code as
before, moved into place. This document is the only place the migration is planned.

## Why Zustand

Decided: the shared state moves to Zustand.

The repository previously declined it — "at two stores, a dependency would buy an API
rather than a capability" — and named its own threshold for revisiting: *a third or fourth
store, or a store needing selectors to avoid re-rendering on unrelated fields*. The
inventory below is **six stores**, several of which need selectors, so the threshold is
met. That hand-rolled primitive is **replaced, not kept alongside** — see step 1.

## What exists today

| Mechanism | Where | Consumers |
|---|---|---|
| Hand-rolled observable store | `platform/ipc/store.ts` (`createStore`/`useStore`) | `platform/diagnostics/faults.ts` — one |
| React contexts | **8** `createContext` calls across `src/` | see inventory |
| Window event buses | `skellyspeak-settings-saved`, `skill-evidence-changed` | see inventory |
| Component `useState` in the shell | `app/AppShell.tsx` (138 lines) | app-wide |

The hand-rolled store has exactly **one** live consumer. The second it was extracted for
was the pipeline gate, which was unreachable code and is gone.

## Target shape

`src/state/` — one store per concern. The directory exists; these rules are already
enforced by `src/architecture/boundaries.test.ts`, which runs every rule unconditionally:

- Stores may import `platform/` and `domain/`.
- `ui/` and `domain/` may **not** import `state/`.
- Store actions that fail set error state in the fault store. No swallowed promises, no
  silent fallbacks — this matches `platform/diagnostics/faults.ts`, whose header already
  states that reporting a fault is the only acceptable error path.
- No persistence middleware. Settings persist through Rust, which owns them.

### Where stores start

**One `initStores()` called from `main.tsx`** — after `loadLanguages()`, before the first
render. It performs the initial settings read, the connection refresh and the fault
subscription. A failure there reports through the fault store and leaves the app on its
existing "could not open SkellySpeak" path.

Rationale: today three `AppShell` effects each own a load. Without a single start, every
component that reads a store would trigger its own initial fetch — the same race
`AppShell`'s own comment warns about, multiplied by the number of consumers.

## Inventory

Ordered by build sequence. "Hazard" is what the migration can get wrong.

### 1. `faultStore` — build this first

| | |
|---|---|
| Today | `platform/diagnostics/faults.ts` — already a module-level store with `reportFault`/`useFaults`/`subscribeFaults`/`dismissFault`/`dismissAllFaults` |
| Target | Zustand store with the same module-level surface |
| Why first | Small, mechanical, and it is the pattern every later store copies. Every other store's failure path depends on it, so it must exist before them. |
| Hazard | Two consumption paths exist on purpose: `useFaults()` for React and `subscribeFaults()` for non-React callers, which fires immediately with the current list. Both must keep working. `reportFault` also logs through `logDiagnostic` **before** publishing, and dedupes identical `reportUnhandledError` faults. |
| Also in this step | **Delete `platform/ipc/store.ts`** once nothing imports it. Two ways to build a store is the problem this migration exists to remove. |
| Where it lives | Not in `state/`. Eleven modules across `app/`, `features/` and `platform/` report into it, and one of them — `platform/audio/reward-sounds.ts` — is itself in the platform layer. Moving the sink above that layer would force platform to import upward, which the boundary rules forbid. It stays at the bottom, beside the logger it writes through. |
| Status | **Done.** Converted to Zustand in place; `platform/ipc/store.ts` and its test are deleted. |

### 2. `settingsStore` — the biggest payoff

| | |
|---|---|
| Today | `app/AppShell.tsx` `useState` (`settings`, `settingsVersion`, `savingLanguage`) + a window event bus |
| Bridge | `platform/ipc/tauri.ts` dispatches `skellyspeak-settings-saved`; `AppShell` listens and refetches — **delete the event**; the store's `save` refetches |
| Direct IPC callers | `AppShell` (7 sites), `features/guided/GuidedPage.tsx` (3), `features/settings/SettingsModal.tsx` (4), `platform/skill-evidence.ts` (1) |
| Revision consumers | `GuidedPage` (reload key), the evidence scope, the skill-evidence staleness gate |
| Target | store with `load`, `save` and a revision field |
| Hazard | `GuidedPage` holds a **second copy** of settings and writes it through its own `toggleSetting`. Two writers of one Rust-owned record is the strongest single argument for this store. `SettingsModal` separately owns a draft/persisted autosave model that must not be duplicated. |

### 3. `sessionStore` (AI access / hosted sign-in)

| | |
|---|---|
| Today | `AppShell` `useState` (`connection`, `startingHostedSignIn`) + `refreshConnection`/`startHostedSignIn` |
| Consumers | `app/shell/TopBar.tsx`, `GuidedPage` via `accessConfigured`/`accessStarting`/`onStartHostedSignIn` props |
| Target | store; the access-state prop-drilling through `AppShell` disappears |
| Hazard | `startHostedSignIn` is a two-step IPC sequence with an `expectedRevision`; the store action keeps the same ordering and in-flight guard. |

### 4. `skillEvidenceStore`

| | |
|---|---|
| Today | `state/useSkillEvidence.ts` (`loaded`, `error`, `revision`, `saving` + a mount-scoped polling/subscription effect) → `SkillEvidenceContext` |
| Second mechanism | `platform/skill-evidence.ts` subscribes to the `skill-evidence-changed` **window** event, dispatched from `features/guided/useConversation.ts` — **delete the event** |
| Consumers | 6 production files |
| Hazard | Staleness gating is subtle and must be preserved exactly: a snapshot whose scope ≠ the settings revision is discarded, and the shell additionally nulls it when `snapshot.target` ≠ the target language. The effect single-flights with a dirty flag and a ticket counter. Both become selectors, not removed conditions. |

### 5. `navigationStore` (the shell)

| | |
|---|---|
| Today | `AppShell` `useState` ×9: `page`, `mobileSurface`, `moreOpen`, `progressOpen`, `skillsOpened`, `settingsOpen`, `settingsBusy`, `devOpen`, `historyOpen` |
| Target | store holding which surface and which dialog is open |
| Hazard | `AppShell` registers an Android-back overlay when mobile + skills page, and disables swipe while any overlay is open. Both are derived from this state and must survive. |

| ~~6~~ | ~~`skillNavigationStore`~~ **done** | `NavigationContext`, `SkillNavigationProvider` |

| | |
|---|---|
| Today | `state/useSkillNavigation.tsx` — a `useReducer` + context over `{ sequence, selected, mapRequest }` |
| Consumers | `PracticeContext` readers, `RewardBadge`, `RewardPresentation`, `ProgressSummary`, `GuidedPage`, `SkillsPage` |
| Target | its own store; `skillNavigationReducer` stays a pure function and is reused |
| Why separate from the shell store | Which page and which dialog are open is unrelated to which skill is selected. One store would re-render every dialog on a skill click. |

## Contexts that stay contexts

Reviewed and deliberately **not** migrated. Each is genuinely subtree-scoped; a global
store would make them worse.

| Context | Why it stays |
|---|---|
| `ReadingPreferencesContext` | per-subtree reading preferences passed down intentionally |
| `ReadingContext`, `ReadingSentenceContext` | `TargetText` internals |
| `RewardInspectionContext` | `RewardPresentationProvider` owns a workspace/animation scope, not app state |
| `ActiveSurfaceContext` | one boolean scoped to a subtree |
| `SkillEvidenceContext` | **Kept**, contrary to this plan's first draft. `ProgressSummary` provides it with **its own** `snapshot` prop so the components inside it render the profile's global snapshot rather than the app-level one the store holds. Removing it would have silently changed what `ConversationMap` displays inside that overlay. The *app-level* value is what moved to the store; the context is now only the subtree override. |

## `PracticeContext` — dissolves

`features/guided/PracticeContext.ts` is a live context that appeared in neither table.
Its fields are `chatId`, `selectionVersion`, `selected` and `select`, and `select` already
calls the skill-navigation reducer — it is a *projected view* of the skill-navigation
state for the active conversation, not independent state.

Decision: it dissolves into `skillNavigationStore`, read through a selector. The selector
must carry the gate the provider applies today (`selected` is only reported when its
target matches `settings.target_language`) and the `chatId` scope, so no consumer has to
re-implement either.

## Removed by the reorganization

Already gone; listed so the inventory is not read as counting them:
`DraftAssistanceContext`, `TopicNotesContext` + `TopicNotesProvider` +
`platform/topic-notes.ts`. They reached only unreachable code.

## Window event buses

| Event | Dispatched | Subscribed | Disposition |
|---|---|---|---|
| ~~`skellyspeak-settings-saved`~~ | — | — | **Deleted** with step 2. 0 references. |
| ~~`skill-evidence-changed`~~ | — | — | **Deleted** with step 4. 0 references. The conversation calls `skillEvidenceStore.reload()` directly, which a listener cannot miss by not having attached yet, and which needs no unsubscribing. |
| `skellyspeak-check-update` | `SettingsModal` (2 sites) | `UpdateBanner` | **keep** — an imperative command, not state |
| `diagnostic-bridge-failed` | `platform/diagnostics/log.ts` | `main.tsx` | **keep** — platform level |
| `unhandled-ui-error` | `platform/diagnostics/log.ts` | `main.tsx` | **keep** — platform level |

## Decisions already made

1. **`settingsVersion` goes away.** Consumers key off the settings store's revision.
2. **`GuidedPage` keeps no copy of settings.** It reads the store; the second writer and
   its `toggleSetting` disappear.
3. **`SettingsModal` keeps its local draft** and saves through the store's action. The
   draft/persisted autosave behaviour is unchanged.
4. **The 30 tests in `platform/ipc/settings-contract.test.ts` stay contract tests** of
   `platform/ipc`. New tests cover the store actions; they do not replace these.
5. **`progressOpen` is shell navigation state** (`navigationStore`), like `moreOpen` and
   `devOpen`. `ProgressSummary` itself stays in `features/guided` — it has two consumers,
   and the features-independence rule forbids moving it behind another feature.
6. **`platform/skill-evidence.ts` stops reading settings.** It takes the target language
   as an argument; the store passes it. That removes a store → platform → store cycle.

## Test changes made by the migration

Recorded so a reader can tell an assertion that moved from one that was weakened.

| Test | Change |
|---|---|
| `GuidedPage.conversation.test.tsx` | The `page()` helper no longer takes or passes `settingsVersion`, and `beforeEach` seeds the store with `load()` the way startup does. The test *"settings refresh and empty conversation hydration do not send an automatic greeting"* used to drive a refresh by re-rendering with a new prop and assert `getSettings` call counts — a count that described the *old* ownership, since the page no longer fetches. It now drives `useSettingsStore.getState().refresh()` and asserts the revision moved, the new value arrived, and no greeting command was sent. The intent is unchanged and the assertions are stronger: a call count cannot tell whether the page *used* the value. |

## Test requirements

Zustand stores are module-level singletons: state written by one test is visible to the
next. Each store **exports its initial state and registers a reset** with
`domain/store-resets.ts` as its module loads; `src/test/setup.ts` calls
`resetRegisteredStores()` in `afterEach`.

Registration rather than a list of imports in test setup, for two reasons found the hard
way while converting the fault store:

- Importing the stores from `setup.ts` loads them, and everything they depend on, **before
  a test file's `vi.mock` calls take effect**. The fault store reaches
  `@tauri-apps/api/core` through the logger, so every test that mocked that module bound
  to the real one — 64 failures from one import.
- Naming a store's exports from a shared helper breaks any test whose `vi.mock` factory
  returns a partial module: importing `useFaultStore` from a mock that only provides
  `reportFault` throws. A mocked store never loads, so it never registers, so there is
  correctly nothing to reset.

Importing only `domain/store-resets.ts` — which has no imports of its own — has neither
hazard.

## Order of work

| Step | Store | Deletes |
|---|---|---|
| ~~1~~ | ~~`faultStore`~~ **done** | `platform/ipc/store.ts` |
| ~~2~~ | ~~`settingsStore`~~ **done** | the `skellyspeak-settings-saved` event, `GuidedPage`'s settings copy, `SettingsModal`'s direct writes and the `onSettingsChanged` prop |
| ~~3~~ | ~~`sessionStore`~~ **done** | the access-state prop-drilling |
| ~~4~~ | ~~`skillEvidenceStore`~~ **done** | the `skill-evidence-changed` event; `platform/skill-evidence.ts`'s settings read |
| ~~5~~ | ~~`navigationStore`~~ **done** | nine `useState`s and the callback plumbing into the chrome |
| ~~6~~ | ~~`skillNavigationStore`~~ **done** | `NavigationContext`; `PracticeContext` stays, by decision |

Each store is one commit-sized change that ends green. **Completion target: `AppShell`
under 100 lines** (from 268), holding composition only.

## Progress log

| Date | Change |
|---|---|
| Review pass 3 (state items) | A second review raised six state items. Five changed code: the `reportFault` comment states today's rule instead of narrating the old one; `skill-evidence.ts` keeps its read bookkeeping (`read`, `inFlight`, `queued`) in the store closure rather than in public state, so the store exposes only what a consumer reads — `snapshot`, `scope`, `error`, `saving`; `useSkillEvidence()` is read-only and the shell alone keeps evidence read; `*.tsbuildinfo` is ignored; and `frontend-organization.md` now lists the contact rewrite's defects. The sixth was answered, not changed: audio volumes are applied by the settings subscription in `state/init.ts`, which reports a failure and leaves the record alone. **Trap recorded:** that bookkeeping is closure state, so the `__mocks__/zustand` reset does not clear it. It is safe only because the *we already have it* test in `load` reads public state first (`snapshot.target` and `scope`), which a reset store does clear; making idempotence depend on the closure alone would leak one test's read into the next. |
| Reorganization | This document was maintained through all six stages, which repointed every path and recorded the criterion before the file holding it was deleted. |
| Step 6 | `state/skill-navigation.ts` holds the selection, with `skillNavigationReducer` kept pure and applied by the store. `SkillNavigationProvider` and its context are **deleted** — the state is global now, so there was nothing left to provide — and `App` is a one-line composition. The hook keeps its `{ state, select, explore }` shape (memoised), so all five consumers changed only their import path. **`PracticeContext` stays**, for the same reason `SkillEvidenceContext` did: `ProgressSummary` provides its own selection to its subtree. `AppShell` finished at **90 lines**, with `SurfaceHost` taking the surface composition. |
| Step 5 | `state/navigation.ts` owns the nine shell values plus `goHome`, `openPractice`, `openSkills`, `toggleDev`, `openSettings`/`closeSettings` and the rest. `TopBar`, `MobileNav` and `MoreDialog` **read it directly**, so the ~14 callback props the shell threaded into its own chrome are gone; `TopBar` takes three props now and `MobileNav` takes none. `Page` and `MobileLocation` moved here too, because `state/` must not import upward from `features/` for a type — `app/navigation.ts` is deleted. Three extractions came with it, each cohesive rather than metric-driven: `app/shortcuts/useAppShortcuts.ts`, `app/shell/ProfileOverlay.tsx`, and the two language pickers now read the store themselves instead of taking five props each. `AppShell` 193 → **138 lines**. |
| Step 4 | `state/skill-evidence.ts` owns the snapshot, its scope revision, the error and the saving flag. The single-flight/dispose/ticket logic moved verbatim into `start`, which returns the reader `reload()` calls. **The `skill-evidence-changed` window event is deleted**; `useConversation` calls `reload()` directly. `platform/skill-evidence.ts` stops reading settings and takes the target as an argument, so the platform layer is no longer a second reader of the settings store. `SkillEvidenceContext` **stays** — see the contexts table. `state/useSkillEvidence.ts` is now a thin store-backed hook with an unchanged public shape, so no consumer or consumer test changed; only the hook's own test was rewritten, driving `reload()` where it used to capture a subscription callback. |
| Step 3 | `state/session.ts` holds `connection` and `starting` with `refresh` and `startHostedSignIn`. The two-command sequence and its `expectedRevision` are unchanged; the in-flight guard moved from a `useCallback` closure (which also changed identity on every flip) to `get().starting`. **Three props are gone from `GuidedPage`** — `accessConfigured`, `accessStarting`, `onStartHostedSignIn` — so the page reads the store. `initStores` now starts both stores and skips either that already holds a value, which is what makes the shell's second call a no-op. `AppShell` 226 → 193 lines. Green: `tsc` clean, 73 files / 385 tests, `build` completes. |
| Step 2 (part 3) | `SettingsModal` writes through the store's new `save(draft, baseline)` action, which writes, re-reads and adopts the result — so the modal no longer hands a fresh value to the shell, and its `onSettingsChanged` prop is **deleted**. The open-time read and the AI-access refresh go through `reload()` and `refresh()` respectively, preserving which one counts as a change. **The `skellyspeak-settings-saved` window event is deleted** (dispatch and listener): 0 references remain. Three modules now touch `getSettings`/`saveSettings` — the store, `platform/skill-evidence.ts` (step 4's concern) and the contract test. **Step 2 complete.** `AppShell` 268 → 226 lines. |
| Step 2 (part 2) | `GuidedPage` reads the store: its own `useState<Settings>`, its mount-time fetch and its `toggleSetting` are gone, replaced by `settings`, the store's `revision`, `savingPreference` and the `setPreference` action. The `settingsVersion` **prop** is deleted; `revision` replaces it, and the `AppShell` → `GuidedPage` prop disappears. Switching conversations calls a new non-bumping `reload()`: the record describes the active conversation's scope, so a chat switch re-reads it, but that is not a settings write and must not move the revision that `GuidedPage` reads as "a save has landed". |
| Step 2 (part 1) | `state/settings.ts` created with `load`/`applySaved`/`refresh`/`setLanguage`/`changeTextSize` and a `revision` that bumps **only on writes**, because `GuidedPage` reads it as "a save has happened since mount". `state/init.ts` adds one `initStores()`, called from `main.tsx` before the first render and again (idempotently) by the shell so an entry point that renders `<App/>` directly still loads once. `AppShell` reads settings, revision and the language-saving flag from the store: **268 → 236 lines**. `GuidedPage`, `SettingsModal` and the `skellyspeak-settings-saved` event are unchanged so far — the event still carries their writes to the store. Green: `tsc` clean, 73 files / 385 tests, `build` completes. |
| Step 1 | `faultStore` converted to Zustand in place; `platform/ipc/store.ts` and `store.test.ts` deleted. Established the store-reset registry after two import-order failures. Green: `tsc` clean, 73 files / 385 tests, `build` completes, 0 unreachable modules. |
| Review follow-up | Corrected: the boundary rule is enforced rather than inert; the removed contexts are stated in the past tense; step order fixed to faults-then-settings; `initStores()` and the store-reset requirement added; `PracticeContext` added with a decision; the six open questions replaced with decisions; the store.ts deletion made explicit. |
| Review pass 2 (a): correctness | A caught fault is **published before** the durable log, and a rejected log is reported as its own fault — waiting for the sink swallowed the fault it was meant to show, which reverses a behaviour a test had been pinning. The shortcut binding is **derived** from the store, so editing it in Settings takes effect at once instead of at the next start. An audio-volume failure records a fault and leaves the record alone rather than blanking every preference. `TopBar` reads the navigation store per field instead of subscribing to all of it. `initStores` is called once, from `main.tsx`, and its idempotency guards are deleted. The silent `if (!isTauri) return` guards are gone from `session.refresh` and `skillEvidence`; the startup decision lives in `init.ts` alone. |
| Review pass 2 (b): store shape | The compatibility wrappers are **deleted**: `useSkillNavigation()`, `useFaults`, `subscribeFaults`, `dismissFault`, `dismissAllFaults`. The five skill-navigation consumers select the fields they use, and the fault tests read `useFaultStore` directly. `skillEvidenceStore` has no module-level state left: `request {id, target, revision}` replaces the `start()` closure and its disposer, `load(target, revision)` is idempotent, `reload()` queues at most one trailing read while a different language supersedes at once, `save()` reloads, and `selectSkillSnapshot(state, target, revision)` is the single selector that replaces the two staleness masks. `TopBar`, `ProfileOverlay`, `SurfaceHost` and `SkillsPage` call `useSkillEvidence()` themselves, so `AppShell` computes and passes no evidence. `settingsStore`: `reload()` merges into `load()` (one read action, documented as the active conversation's scope), `applySaved` folds into a private `adopt`, and every preference edit goes through one `update(change, faultContext)` — `setLanguage`, `setPreference` and `changeTextSize` are now one-liners. `navigationStore` holds one `overlay: 'more' \| 'profile' \| 'settings' \| 'activity' \| null` instead of four flags, with `showOverlay`/`toggleOverlay`/`closeOverlay`; `settingsBusy` is documented as the modal's own state and `newChatAction`'s lifetime (register, or register `null` to disable the button) is stated. `sessionStore`'s `starting` is `signingIn`. Direct store tests added for settings, session and skill evidence (faults, navigation and skill-navigation already had them). |
| Review pass 2 (c): two behaviour changes from one overlay field | `goHome` and `openPractice` now close the settings modal as well, which they previously left open — it cannot be reached while a modal `<dialog>` is up, so nothing observable changes. The swipe gate in `SurfaceHost` is now `overlay === null`, so a swipe no longer moves the practice surface while the language-profile overlay is open; the old gate listed three of the four overlays and missed that one. |
