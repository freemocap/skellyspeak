// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useNavigationStore } from './navigation'

/// Every assertion here reads through `getState()` — the store is the unit under
/// test, not a component that happens to render it.
const store = () => useNavigationStore.getState()

describe('navigation store', () => {
  it('starts on the guided surface with everything closed', () => {
    const state = store()
    expect(state.page).toBe('guided')
    expect(state.mobileSurface).toBe('chat')
    expect([state.historyOpen, state.overlay, state.skillsOpened, state.settingsBusy]).toEqual([false, null, false, false])
    expect(state.newChatAction).toBeNull()
  })

  it('folds and unfolds the reply suggestions', () => {
    expect(store().suggestionsCollapsed).toBe(true)
    store().toggleSuggestions()
    expect(store().suggestionsCollapsed).toBe(false)
    store().toggleSuggestions()
    expect(store().suggestionsCollapsed).toBe(true)
  })

  it('shows one dialog at a time', () => {
    store().showOverlay('more')
    expect(store().overlay).toBe('more')
    // Opening another replaces it: the two are never both showing, which is what
    // one field buys over a flag each.
    store().showOverlay('activity')
    expect(store().overlay).toBe('activity')
    store().closeOverlay()
    expect(store().overlay).toBeNull()
  })

  it('toggles the dialog it is already showing, and replaces one it is not', () => {
    store().toggleOverlay('activity')
    expect(store().overlay).toBe('activity')
    store().toggleOverlay('activity')
    expect(store().overlay).toBeNull()
    store().toggleOverlay('activity')
    store().toggleOverlay('settings')
    expect(store().overlay).toBe('settings')
  })

  it('opens a practice surface and closes the dialog it covers', () => {
    store().showOverlay('more')
    store().openConversation('panel')
    expect(store().page).toBe('guided')
    expect(store().mobileSurface).toBe('panel')
    expect(store().overlay).toBeNull()
  })

  it('opens the skill tree once and remembers it was opened', () => {
    store().openSkills()
    expect(store().page).toBe('skills')
    expect(store().skillsOpened).toBe(true)
    store().showPage('guided')
    expect(store().page).toBe('guided')
    // Still opened: the tree stays mounted once it has been shown, which is why
    // this is not the same as `page === 'skills'`.
    expect(store().skillsOpened).toBe(true)
  })

  it('goes home to the conversation with everything over it closed', () => {
    store().openConversation('panel')
    store().setHistoryOpen(true)
    store().showOverlay('profile')
    store().goHome()
    const state = store()
    expect([state.page, state.mobileSurface, state.historyOpen, state.overlay]).toEqual(['guided', 'chat', false, null])
  })

  it.each(['guided', 'skills'] as const)('returns from %s after Drill with the coach panel retained', page => {
    store().openConversation('panel')
    store().setPracticeView('drill')
    if (page === 'skills') store().openSkills()
    store().openConversation()
    expect(store()).toMatchObject({ page: 'guided', practiceView: 'chat', mobileSurface: 'panel', drillOpened: true })
    expect(localStorage.getItem('skellyspeak.practice-view')).toBe('chat')
  })

  it.each(['chat', 'panel'] as const)('opens the requested conversation surface %s after Drill and Skills', surface => {
    store().setPracticeView('drill')
    store().openSkills()
    store().openConversation(surface)
    expect(store()).toMatchObject({ page: 'guided', practiceView: 'chat', mobileSurface: surface })
  })

  it('toggles the contacts drawer', () => {
    store().toggleHistory(); expect(store().historyOpen).toBe(true)
    store().toggleHistory(); expect(store().historyOpen).toBe(false)
    // Left set on purpose: the last test proves it does not survive.
    store().setSettingsBusy(true); expect(store().settingsBusy).toBe(true)
  })

  it('registers and clears the new-chat action', () => {
    const action = () => {}
    store().registerNewChat(action)
    expect(store().newChatAction).toBe(action)
    store().registerNewChat(null)
    expect(store().newChatAction).toBeNull()
  })

  /// This also proves the reset itself works: the test above left `settingsBusy`
  /// set, and every test here mutated the store.
  it('is restored to its initial state between tests', () => {
    const state = store()
    expect(state.settingsBusy).toBe(false)
    expect(state.overlay).toBeNull()
    expect(state.page).toBe('guided')
    expect(state.newChatAction).toBeNull()
  })
})
