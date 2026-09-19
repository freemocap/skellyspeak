import { beforeEach, expect, it, vi } from 'vitest'
import { DEFAULT_APPEARANCE, type Preferences, type Snapshot } from '../../generated/contracts'
import { useOnboardingStore } from './onboarding'

const mocks = vi.hoisted(() => ({ read: vi.fn(), update: vi.fn(), device: vi.fn(), refresh: vi.fn(), select: vi.fn(), save: vi.fn(), settings: vi.fn() }))
vi.mock('../../platform/ipc/workspace', () => ({ readWorkspace: mocks.read }))
vi.mock('../../platform/ipc/onboarding', () => ({ updateOnboarding: mocks.update, deviceLanguages: mocks.device }))
vi.mock('../../platform/ipc/tauri', () => ({
  getSettings: mocks.settings,
  languages: () => ['english', 'spanish'].map(code => ({ code, defaultVariety: `${code}-default`, varieties: [{ id: `${code}-default` }] })),
}))
vi.mock('./settings', () => ({ useSettingsStore: { getState: () => ({ refresh: mocks.refresh, selectLanguageVariety: mocks.select, save: mocks.save }) } }))
let preferences: Preferences
beforeEach(() => {
  vi.clearAllMocks()
  preferences = { theme: 'light', appearance: { ...DEFAULT_APPEARANCE }, textSize: 85, textSpacing: 0, highContrast: false, interfaceLocale: 'english', explanationLanguage: 'english', explanationVarietyId: 'english-default',
    myLanguages: [], targetVarieties: {}, onboarding: 'not_started', onboardingRequired: true, onboardingLanguage: null, onboardingHelp: false,
  }
  mocks.read.mockImplementation(async () => ({ learner: { revision: 1, preferences } }) as Snapshot)
  mocks.device.mockResolvedValue(['es-MX'])
  mocks.update.mockImplementation(async change => { preferences = change(preferences); return preferences })
  mocks.settings.mockResolvedValue({ target_language: 'spanish', native_language: 'english' })
  useOnboardingStore.setState({ preferences: null, busy: false })
})
it('selects device language only for an untouched new workspace', async () => {
  await useOnboardingStore.getState().initialize()
  expect(preferences.interfaceLocale).toBe('spanish')
  expect(preferences.explanationLanguage).toBe('spanish')
  expect(mocks.select).not.toHaveBeenCalled()
})
it('does not change existing learners, even with the old not_started status', async () => {
  preferences.onboardingRequired = false
  await useOnboardingStore.getState().initialize()
  expect(mocks.device).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
})
it('preserves confirmed preferences after an interrupted launch', async () => {
  mocks.read.mockResolvedValue({ learner: { revision: 2, preferences } })
  await useOnboardingStore.getState().initialize()
  expect(mocks.update).not.toHaveBeenCalled()
})
it('saves language choices without opening a conversation and resumes at access', async () => {
  await useOnboardingStore.getState().saveLanguages('spanish', 'spanish-default', 'english', 'english')
  expect(preferences.onboarding).toBe('in_progress')
  expect(preferences.myLanguages).toEqual(['spanish'])
  expect(preferences.targetVarieties.spanish).toBe('spanish-default')
  expect(mocks.select).not.toHaveBeenCalled()
  await useOnboardingStore.getState().back()
  expect(preferences.onboardingLanguage).toBe('spanish')
})
it('leaves setup resumable if selecting the first conversation fails', async () => {
  await useOnboardingStore.getState().saveLanguages('spanish', 'spanish-default', 'english', 'english')
  mocks.select.mockRejectedValueOnce(new Error('Save failed'))
  await expect(useOnboardingStore.getState().finish(true)).rejects.toThrow('Save failed')
  expect(preferences.onboardingRequired).toBe(true)
  expect(useOnboardingStore.getState().busy).toBe(false)
})
it('records skipping separately from optional help, and preserves unrelated preferences', async () => {
  await useOnboardingStore.getState().saveLanguages('spanish', 'spanish-default', 'english', 'english')
  await useOnboardingStore.getState().finish(true)
  expect(preferences.onboardingRequired).toBe(false)
  expect(preferences.onboardingLanguage).toBe(null)
  expect(preferences.onboarding).toBe('skipped')
  expect(preferences.onboardingHelp).toBe(true)
  await useOnboardingStore.getState().showHelp(false)
  expect(preferences.onboardingHelp).toBe(false)
  expect(preferences.myLanguages).toEqual(['spanish'])
})
