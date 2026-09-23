// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  localStorage.clear()
  vi.resetModules()
})

async function reloadNavigation() {
  vi.resetModules()
  return (await import('./navigation')).useNavigationStore
}

it('remembers Drill and then Chat across reloads without reopening dialogs', async () => {
  const first = await reloadNavigation()
  expect(first.getState().practiceView).toBe('chat')
  first.getState().setPracticeView('drill')
  first.getState().showOverlay('settings')

  const refreshed = await reloadNavigation()
  expect(refreshed.getState()).toMatchObject({ practiceView: 'drill', page: 'guided', overlay: null })
  refreshed.getState().setPracticeView('chat')

  expect((await reloadNavigation()).getState().practiceView).toBe('chat')
})

it('uses Chat when the saved destination is unrecognized', async () => {
  localStorage.setItem('skellyspeak.practice-view', 'unknown')
  expect((await reloadNavigation()).getState().practiceView).toBe('chat')
})
