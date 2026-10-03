// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ isTauri: false }))
const api = vi.hoisted(() => ({ getPracticeView: vi.fn(), savePracticeView: vi.fn() }))
vi.mock('../../platform/ipc/tauri', () => runtime)
vi.mock('../../platform/ipc/navigation', () => api)
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))
beforeEach(() => { runtime.isTauri = false; api.getPracticeView.mockReset(); api.savePracticeView.mockReset().mockResolvedValue(undefined) })
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


it('restores native Drill despite stale browser storage and saves Chat durably', async () => {
  runtime.isTauri = true
  localStorage.setItem('skellyspeak.practice-view', 'chat')
  api.getPracticeView.mockResolvedValue('drill')
  const store = await reloadNavigation()
  await store.getState().restorePracticeView()
  expect(store.getState().practiceView).toBe('drill')
  store.getState().setPracticeView('chat')
  await vi.waitFor(() => expect(api.savePracticeView).toHaveBeenCalledWith('chat'))
  localStorage.clear()
  api.getPracticeView.mockResolvedValue('chat')
  const restarted = await reloadNavigation()
  await restarted.getState().restorePracticeView()
  expect(restarted.getState().practiceView).toBe('chat')
})

it('does not let a late startup read replace a new selection and orders writes', async () => {
  runtime.isTauri = true
  let resolve!: (view: string) => void
  api.getPracticeView.mockReturnValue(new Promise(done => { resolve = done }))
  const store = await reloadNavigation()
  const restoring = store.getState().restorePracticeView()
  store.getState().setPracticeView('drill')
  resolve('chat')
  await restoring
  expect(store.getState().practiceView).toBe('drill')
  store.getState().setPracticeView('chat')
  await vi.waitFor(() => expect(api.savePracticeView.mock.calls.map(call => call[0])).toEqual(['drill', 'chat']))
})

it('does not reopen saved Drill after an explicit conversation request during startup', async () => {
  runtime.isTauri = true
  let resolve!: (view: string) => void
  api.getPracticeView.mockReturnValue(new Promise(done => { resolve = done }))
  const store = await reloadNavigation()
  const restoring = store.getState().restorePracticeView()
  store.getState().openConversation('panel')
  resolve('drill')
  await restoring
  expect(store.getState()).toMatchObject({ practiceView: 'chat', mobileSurface: 'panel' })
  await vi.waitFor(() => expect(api.savePracticeView).toHaveBeenCalledWith('chat'))
})
