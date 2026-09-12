# Zustand migration plan (living document)

Status: **living plan**, maintained while the frontend reorganization runs. This is
not a dated handoff and is not frozen like `workflow/reports/*`. Update it as the
reorganization lands, so that by the time the reorganization is finished this
document is a complete, evidence-backed work order.

The store implementation itself is a **separate follow-up task**. Nothing in this
document is implemented by the reorganization; the reorganization only moves files
and deletes unreachable code, and must leave behavior identical.

## The criterion this codebase already wrote for itself

Before proposing a dependency, note that the repository already decided this
question in writing. `src/platform/ipc/store.ts` is a deliberate 51-line observable
primitive built on `useSyncExternalStore`:

> No Zustand or Redux, deliberately: at two stores, a dependency would buy an API
> rather than a capability. See the note in `gate.ts` for when that stops being
> true. — `src/platform/ipc/store.ts`

The criterion itself was written in the retired pipeline gate, whose note read:

> If a third or fourth store appears — or one needs selectors to avoid
> re-rendering on unrelated fields — that is the point to reach for Zustand.
> At this size a library would be an API, not a capability.

That file was unreachable code, and the reorganization deleted it. The criterion is
preserved here, and `src/platform/ipc/store.ts` now points readers at this document
instead of at a file that no longer exists.

**The inventory below proposes five stores, several of which need selectors.**
That exceeds the documented threshold on both counts. The Zustand migration is
therefore not a stylistic preference — it satisfies a criterion the codebase set
for itself, and this document is the evidence that the criterion is now met.

## What exists today

| Mechanism | Where | Consumers |
|---|---|---|
| Hand-rolled observable store | `src/platform/ipc/store.ts` (`createStore`/`useStore`) | `platform/diagnostics/faults.ts` |
| React contexts | 10 `createContext` calls across `src/` | see inventory |
| Window event buses | `skellyspeak-settings-saved`, `skill-evidence-changed` | see inventory |
| Component `useState` in the shell | `app/AppShell.tsx` | app-wide |

The hand-rolled store now has exactly **one** live consumer (`faults.ts`). The second
consumer it was extracted for was the pipeline gate, which was unreachable code and has
been deleted — so the count that justified sharing the primitive no longer holds, which
is itself part of the case for moving to a real store library.

## Target shape

```
src/state/          one store per concern
```

Rules (add these to the boundary test when `state/` lands — the rule is inert
until the folder exists):

- Stores may import `platform/` and `domain/`.
- `ui/` and `domain/` may **not** import `state/`. This rule already exists in
  `src/architecture/boundaries.test.ts`; it is skipped until `src/state/` appears,
  then enforces itself.
- Store actions that fail set error state in the fault store. No swallowed
  promises, no silent fallbacks — this matches `platform/diagnostics/faults.ts`, whose header
  already states that reporting a fault is the only acceptable error path.
- No persistence middleware. Settings persist through Rust, which owns them.

## Inventory

Each row is a candidate store. "Evidence" is the current mechanism; "Hazard" is
what the migration can get wrong.

### 1. `settingsStore`

| | |
|---|---|
| Today | `app/AppShell.tsx` `useState` (`settings`, `settingsVersion`, `savingLanguage`) + a window event bus |
| Bridge | `platform/ipc/tauri.ts` dispatches `skellyspeak-settings-saved`; `app/AppShell.tsx` listens and refetches |
| Direct IPC callers of `getSettings`/`saveSettings` | `app/AppShell.tsx` (7 sites), `features/guided/GuidedPage.tsx` (3), `features/settings/SettingsModal.tsx` (4), `platform/skill-evidence.ts` (1) |
| Consumers of `settingsVersion` | `GuidedPage` (reload key), `skills.ts` evidence scope, `useSkillEvidence` staleness gate |
| Target | store with `load`, `save`, and a revision/version field; **delete the window event** |
| Hazard | `GuidedPage.tsx:331-340` holds a **second copy** of settings and writes it via its own `toggleSetting`. The comment at `GuidedPage.tsx:440-441` claims it is "a second VIEW of one variable, not a copy" — it is literally a separate `useState` plus a refetch. Two writers of one Rust-owned record is the strongest single argument for this store. `SettingsModal` also owns a draft/persisted autosave model that must not be duplicated. |
| Tests | `platform/ipc/settings-contract.test.ts` (30 tests) asserts `getSettings`/`saveSettings` behavior directly against `platform/ipc/tauri`. Those contracts must survive the move to a store. |

### 2. `sessionStore` (AI access / hosted sign-in)

| | |
|---|---|
| Today | `app/AppShell.tsx` `useState` (`connection`, `startingHostedSignIn`) + `refreshConnection`/`startHostedSignIn` callbacks |
| Evidence | `refreshConnection` and `startHostedSignIn` in `app/AppShell.tsx` |
| Consumers | `app/shell/TopBar.tsx`, `GuidedPage` via `accessConfigured`/`accessStarting`/`onStartHostedSignIn` props |
| Target | store; the access-state prop-drilling through `AppShell` should disappear |
| Hazard | `startHostedSignIn` performs a two-step IPC sequence with an `expectedRevision`; the store action must keep the same ordering and the in-flight guard. |

### 3. `faultStore`

| | |
|---|---|
| Today | `platform/diagnostics/faults.ts` — already a module-level store with `reportFault`/`useFaults`/`subscribeFaults`/`dismissFault`/`dismissAllFaults` |
| Evidence | `platform/diagnostics/faults.ts` store, re-exported to `app/AppShell.tsx` |
| Target | nearly mechanical: this is already the right shape, built on the primitive being replaced |
| Hazard | Two distinct consumption paths exist on purpose: `useFaults()` for React and `subscribeFaults()` for non-React callers, which fires immediately with the current list. Both must keep working. `reportFault` also logs through `logDiagnostic` **before** publishing, and dedupes identical `reportUnhandledError` faults. |
| Note | This is the reference implementation for the other stores — migrate it first. |

### 4. `navigationStore`

| | |
|---|---|
| Today | `app/AppShell.tsx` `useState` ×9 (`page`, `mobileSurface`, `moreOpen`, `progressOpen`, `skillsOpened`, `settingsOpen`, `settingsBusy`, `devOpen`, `historyOpen`) **plus** `state/useSkillNavigation.tsx` (a `useReducer` + context) |
| Evidence | shell state in `app/AppShell.tsx`; `skillNavigationReducer` in `state/useSkillNavigation.tsx` |
| Consumers | `NavigationContext`: RewardBadge, RewardPresentation, ProgressSummary, GuidedPage, SkillsPage |
| Target | store; keep `skillNavigationReducer` as a pure function and reuse it |
| Hazard | `app/AppShell.tsx` registers an Android-back overlay when mobile + skills page, and disables swipe while any overlay is open. Both are derived from this state and must survive. |

### 5. `skillEvidenceStore`

| | |
|---|---|
| Today | `state/useSkillEvidence.ts` (`loaded`, `error`, `revision`, `saving` + a mount-scoped polling/subscription effect) → `SkillEvidenceContext` |
| Second mechanism | `platform/skill-evidence.ts` subscribes to the `skill-evidence-changed` **window** event, dispatched from `features/guided/useConversation.ts:75` |
| Consumers | 6 production files (chat + panes + profile) |
| Target | store; **delete the window event** and the context |
| Hazard | Staleness gating is subtle and must be preserved exactly: `useSkillEvidence.ts:9` discards a snapshot whose `scope` ≠ `settingsVersion`, and `app/AppShell.tsx` additionally nulls it when `snapshot.target` ≠ `settings.target_language`. The effect also single-flights with a dirty flag and a ticket counter. |

### 6. Settings-adjacent singletons (decide during migration)

| Concern | Today | Notes |
|---|---|---|
| Text size | driven by `settings.text_size`, written by `changeFontSize` in `app/AppShell.tsx` plus the keyboard and native-menu listeners in `app/shortcuts/useTextSizeShortcut.ts` | a setting, not separate state → belongs in `settingsStore` |
| Shortcuts | `settings.shortcuts` + `app/shortcuts/useSettingsShortcut.ts` | a setting → `settingsStore` |
| Reload shortcut | `app/shortcuts/useReloadShortcut.ts` | pure side effect, no state — stays in `app/shortcuts/`, not a store |

## Contexts that stay contexts

Reviewed and deliberately **not** migrated. Each is genuinely subtree-scoped, not
app state — moving them into a global store would make them worse.

| Context | Consumers | Why it stays |
|---|---|---|
| `ReadingPreferencesContext` | TargetText, SavedGlossText, AnalysisContent, GuidedPage | per-subtree reading preferences passed down intentionally |
| `ReadingContext` | TargetText internals | same |
| `ReadingSentenceContext` | TargetText internals | same |
| `RewardInspectionContext` | TurnView, SkillRewards, RewardPresentation | `RewardPresentationProvider` owns a workspace/animation scope, not app state |
| `ActiveSurfaceContext` | `useOverlayLayer` | one boolean scoped to a subtree |

## Contexts and events that the reorganization deletes outright

These reach only code that is already unreachable from `main.tsx`, so they need no
store — confirming this is what makes the store project smaller:

| Item | Why |
|---|---|
| `DraftAssistanceContext` | only consumers are `SkillPracticeBoard` and `TopicExplanation`, both dead |
| `TopicNotesContext` + `TopicNotesProvider` + `platform/topic-notes.ts` | only consumer is `TopicExplanation` (dead) |

## Window event buses

| Event | Dispatched | Subscribed | Disposition |
|---|---|---|---|
| `skellyspeak-settings-saved` | `platform/ipc/tauri.ts` | `app/AppShell.tsx` | **delete** — replaced by `settingsStore` |
| `skill-evidence-changed` | `features/guided/useConversation.ts` | `platform/skill-evidence.ts` | **delete** — replaced by `skillEvidenceStore` |
| `skellyspeak-check-update` | `SettingsModal.tsx` (2 sites) | `UpdateBanner.tsx:47` | **keep** — an imperative command, not state |
| `diagnostic-bridge-failed` | `platform/diagnostics/log.ts` | `main.tsx` | **keep** — platform level |
| `unhandled-ui-error` | `platform/diagnostics/log.ts` | `main.tsx` | **keep** — platform level |

## Open questions for the store task

1. Does `settingsStore` own the `settingsVersion` counter, or is the counter derived
   from a revision the store already holds? Two consumers use it as a reload key.
2. Does `GuidedPage` keep any local copy of settings once the store exists, or does
   it read the store directly? This decides whether the second writer disappears.
3. Is `ProgressSummary` (opened from the topbar) part of `navigationStore`, or does
   it keep `progressOpen` local to the shell?
4. `platform/skill-evidence.ts` reads settings to build an evidence request. Does that
   call move behind the store, or keep taking settings as an argument?
5. Do the 30 tests in `platform/ipc/settings-contract.test.ts` stay contract tests of
   `platform/ipc`, or become store tests?

## Progress log

| Date | Change |
|---|---|
| Stage 0 | Criterion text captured here from `lib/gate.ts` before its deletion. `lib/store.ts`'s dangling pointer to `gate.ts` recorded as a Stage 1 fix. |
| Stage 3 | References repointed from `App.tsx` to `app/AppShell.tsx`. Line numbers replaced with symbol names, which survive the remaining moves. Shortcut listeners now live in `app/shortcuts/`, so items 6 below are already isolated for the store sweep. |
| Stage 4 | All paths repointed through the `lib/` → `platform/`+`domain/` move. Two facts changed shape: the settings bridge dispatcher is `platform/ipc/tauri.ts`, and the `skill-evidence-changed` subscription moved into `platform/skill-evidence.ts` when the skills hub was split. |
| Stage 5 | Paths repointed again through the `components/`+`hooks/`+`pages/` regroup. `state/` now exists and holds the two shared-state modules the stores will replace in place: `state/useSkillEvidence.ts` and `state/useSkillNavigation.tsx`. It contains no Zustand code. |
