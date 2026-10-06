import { getPracticeView, savePracticeView } from '../../platform/ipc/navigation'
import { isTauri } from '../../platform/ipc/tauri'
import { reportFault } from '../../platform/diagnostics/faults'
import type { AiViewSelection } from '../../generated/contracts'
import { create } from 'zustand'

/// Which surface and which dialog the shell is showing.
///
/// Shell state, not feature state: it decides what is on screen. The chrome reads
/// it and calls its actions directly rather than being handed a dozen callbacks,
/// which is why `Page` and `MobileLocation` live here — every layer that needs
/// them sits at or above this one.

/// The top-level surfaces the shell switches between: the guided practice
/// surfaces, and the Progress page (`skills`).
export type Page = 'guided' | 'skills'
/// Which practice surface the guided page is showing: the conversation, or the
/// drill. One replaces the other; they are never side by side.
export type { PracticeView } from '../../generated/contracts'
import type { PracticeView } from '../../generated/contracts'
export type WorkspaceMode = 'practice' | 'review'

/// Where the narrow-window layout puts the learner: the conversation or the
/// learning panel.
export type MobileLocation = 'chat' | 'panel'

/// The Progress page's tabs: skill points and levels, XP, and effort (the
/// counts of Understood, Fixes, Practice, Bot and Explore).
export type ProgressTab = 'skills' | 'xp' | 'effort'

/// The dialogs that sit over a surface.
export type Overlay = 'more' | 'settings' | 'activity' | 'languages'

interface NavigationState {
  aiInspection: AiViewSelection | null
  inspectAi: (selection: AiViewSelection) => void
  readingQuestion: string | null
  draftReadingQuestion: (question: string | null) => void
  page: Page
  practiceView: PracticeView
  setPracticeView: (view: PracticeView) => void
  restorePracticeView: () => Promise<void>
  mode: WorkspaceMode
  setMode: (mode: WorkspaceMode) => void
  mobileSurface: MobileLocation
  /// The contacts drawer. Owned here because its control sits beside the
  /// wordmark while the conversations it lists belong to the guided page.
  historyOpen: boolean
  /// The dialog over the surface, if any.
  ///
  /// One field rather than a flag per dialog: they are exclusive — opening one
  /// replaces whatever was showing — and one field cannot be in the state two
  /// flags can, both true at once.
  overlay: Overlay | null
  languageInfo: string | null
  showLanguageInfo: (language: string) => void
  /// Whether the Progress page has ever been opened. It is mounted lazily and
  /// then kept mounted, so this is not the same as `page === 'skills'`.
  skillsOpened: boolean
  /// The Progress page's open tab.
  progressTab: ProgressTab
  /// Whether Practice has ever been opened. Like the Progress page it is mounted
  /// lazily and then kept mounted, so this is not the same as `practiceView`.
  drillOpened: boolean
  /// The settings modal has unsaved work. The modal owns this; the shell carries
  /// it so the settings shortcut can ask before closing a modal with edits in it.
  settingsBusy: boolean
  /// What the "+" button invokes. The conversation page registers it, because
  /// only it knows how to start a new one; it registers `null` when there is no
  /// conversation to start, and the button is disabled while it is null.
  newChatAction: (() => void) | null
  /// The reply suggestions are folded down to one button above the record button.
  suggestionsCollapsed: boolean

  showPage: (page: Page) => void
  /// Return to the conversation, preserving its coach panel unless specified.
  /// This also clears and saves a previously selected Drill destination.
  openConversation: (surface?: MobileLocation) => void
  /// The Progress page at `tab`. Every progress counter opens it here, on the
  /// tab that leads with the counter's number.
  openProgress: (tab: ProgressTab) => void
  /// The wordmark: home is the guided
  /// conversation, with everything over it closed. Leaving Practice this way
  /// saves the conversation as the practice destination, as choosing it does.
  goHome: () => void
  toggleHistory: () => void
  setHistoryOpen: (open: boolean) => void
  /// Show a dialog, replacing whatever was over the surface. Named after
  /// `showPage`: both put something on screen. (The Android back handler in
  /// domain/input/back is also called `openOverlay`, and one name for two things
  /// is one too many.)
  showOverlay: (overlay: Overlay) => void
  /// Show a dialog, or close it when it is already the one showing.
  toggleOverlay: (overlay: Overlay) => void
  closeOverlay: () => void
  setSettingsBusy: (busy: boolean) => void
  registerNewChat: (action: (() => void) | null) => void
  toggleSuggestions: () => void
}

// Remember only the practice destination, not open dialogs or transient work.
let selectionRevision = 0
let pendingSave: Promise<void> = Promise.resolve()
const practiceViewKey = 'skellyspeak.practice-view'
const savedPracticeView = typeof window === 'undefined' ? null : window.localStorage.getItem(practiceViewKey)

const initialState = {
  page: 'guided' as Page,
  practiceView: (savedPracticeView === 'drill' ? 'drill' : 'chat') as PracticeView,
  mode: 'practice' as WorkspaceMode,
  mobileSurface: 'chat' as MobileLocation,
  historyOpen: false,
  overlay: null as Overlay | null,
  languageInfo: null as string | null,
  skillsOpened: false,
  progressTab: 'skills' as ProgressTab,
  drillOpened: savedPracticeView === 'drill',
  settingsBusy: false,
  newChatAction: null as (() => void) | null,
  suggestionsCollapsed: true,
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  ...initialState,
  aiInspection: null,
  inspectAi: aiInspection => set({ aiInspection: { ...aiInspection }, overlay: 'activity' }),
  readingQuestion: null,
  draftReadingQuestion: readingQuestion => set({ readingQuestion }),

  restorePracticeView: async () => {
    if (!isTauri) return
    const revision = selectionRevision
    const practiceView = await getPracticeView()
    if (revision === selectionRevision) set(state => ({ practiceView, drillOpened: state.drillOpened || practiceView === 'drill' }))
  },
  setPracticeView: (practiceView) => {
    selectionRevision++
    if (isTauri) {
      pendingSave = pendingSave.then(() => savePracticeView(practiceView))
        .catch(error => { reportFault('Saving practice destination', error) })
    }
    window.localStorage.setItem(practiceViewKey, practiceView)
    set(state => ({ practiceView, drillOpened: state.drillOpened || practiceView === 'drill', mode: 'practice', page: 'guided', overlay: null }))
  },
  setMode: (mode) => {
    if (mode === 'practice') get().openConversation('chat')
    else { get().openProgress(get().progressTab); set({ mobileSurface: 'chat', overlay: null }) }
  },
  showPage: (page) => page === 'skills' ? get().openProgress(get().progressTab) : get().openConversation(),
  openConversation: (surface) => {
    // Always register an explicit selection, including while startup's saved
    // destination is still loading. A late read must not reopen Practice.
    get().setPracticeView('chat')
    if (surface !== undefined) set({ mobileSurface: surface })
  },
  openProgress: (progressTab) => set({ mode: 'review', skillsOpened: true, page: 'skills', progressTab, overlay: null }),
  goHome: () => {
    get().openConversation('chat')
    set({ historyOpen: false })
  },
  toggleHistory: () => set((state) => ({ historyOpen: !state.historyOpen })),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  showLanguageInfo: (languageInfo) => set({ overlay: 'languages', languageInfo }),
  showOverlay: (overlay) => set({ overlay, languageInfo: null }),
  toggleOverlay: (overlay) => set((state) => ({ overlay: state.overlay === overlay ? null : overlay, languageInfo: null })),
  closeOverlay: () => set({ overlay: null, languageInfo: null }),
  setSettingsBusy: (settingsBusy) => set({ settingsBusy }),
  registerNewChat: (newChatAction) => set({ newChatAction }),
  toggleSuggestions: () => set((state) => ({ suggestionsCollapsed: !state.suggestionsCollapsed })),
}))
