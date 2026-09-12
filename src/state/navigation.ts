import { create } from 'zustand'

/// Which surface and which dialog the shell is showing.
///
/// Shell state, not feature state: it decides what is on screen. The chrome reads
/// it and calls its actions directly rather than being handed a dozen callbacks,
/// which is why `Page` and `MobileLocation` live here — every layer that needs
/// them sits at or above this one.

/// The top-level surfaces the shell switches between.
export type Page = 'guided' | 'skills'

/// Where the narrow-window layout puts the learner: the conversation or the
/// learning panel.
export type MobileLocation = 'chat' | 'panel'

/// The dialogs that sit over a surface.
export type Overlay = 'more' | 'profile' | 'settings' | 'activity'

interface NavigationState {
  page: Page
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
  /// Whether the skill tree has ever been opened. It is mounted lazily and then
  /// kept mounted, so this is not the same as `page === 'skills'`.
  skillsOpened: boolean
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
  /// Show the guided surface at a given place in it, closing the dialog over it.
  openPractice: (surface: MobileLocation) => void
  openSkills: () => void
  /// The wordmark: home is the guided conversation, with everything over it
  /// closed.
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

const initialState = {
  page: 'guided' as Page,
  mobileSurface: 'chat' as MobileLocation,
  historyOpen: false,
  overlay: null as Overlay | null,
  skillsOpened: false,
  settingsBusy: false,
  newChatAction: null as (() => void) | null,
  suggestionsCollapsed: false,
}

export const useNavigationStore = create<NavigationState>((set) => ({
  ...initialState,

  showPage: (page) => set({ page }),
  openPractice: (surface) => set({ page: 'guided', mobileSurface: surface, overlay: null }),
  openSkills: () => set({ skillsOpened: true, page: 'skills' }),
  goHome: () => set({ page: 'guided', mobileSurface: 'chat', overlay: null, historyOpen: false }),
  toggleHistory: () => set((state) => ({ historyOpen: !state.historyOpen })),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  showOverlay: (overlay) => set({ overlay }),
  toggleOverlay: (overlay) => set((state) => ({ overlay: state.overlay === overlay ? null : overlay })),
  closeOverlay: () => set({ overlay: null }),
  setSettingsBusy: (settingsBusy) => set({ settingsBusy }),
  registerNewChat: (newChatAction) => set({ newChatAction }),
  toggleSuggestions: () => set((state) => ({ suggestionsCollapsed: !state.suggestionsCollapsed })),
}))
