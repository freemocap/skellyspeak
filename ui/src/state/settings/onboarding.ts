import { create } from 'zustand'
import type { Preferences } from '../../generated/contracts'
import { preferredUiLocale } from '../../domain/localization/preferred-locale'
import { readWorkspace } from '../../platform/ipc/workspace'
import { deviceLanguages, updateOnboarding } from '../../platform/ipc/onboarding'
import { getSettings, languages } from '../../platform/ipc/tauri'
import { useSettingsStore } from './settings'

interface OnboardingState {
  preferences: Preferences | null
  busy: boolean
  initialize: () => Promise<void>
  /** `chosen` becomes My languages; `start` is the one the first conversation uses. */
  saveLanguages: (chosen: string[], start: string, varieties: Record<string, string>, explanation: string, locale: string) => Promise<void>
  back: () => Promise<void>
  finish: (skip: boolean) => Promise<void>
  showHelp: (show: boolean) => Promise<void>
  reviewSetup: () => Promise<void>
}

export const useOnboardingStore = create<OnboardingState>((set, get) => {
  async function write(change: (preferences: Preferences) => Preferences) {
    if (get().busy) throw new Error('Setup is already being saved.')
    set({ busy: true })
    try { set({ preferences: await updateOnboarding(change) }) }
    finally { set({ busy: false }) }
  }
  return {
    preferences: null, busy: false,
    initialize: async () => {
      const snapshot = await readWorkspace()
      set({ preferences: snapshot.learner.preferences })
      // Only the untouched, explicitly marked new learner gets device defaults.
      // The revision guard also preserves the choice across interrupted launches.
      if (!snapshot.learner.preferences.onboardingRequired || snapshot.learner.revision !== 1) return
      const locale = preferredUiLocale(await deviceLanguages())
      const language = languages().find(item => item.code === locale)
      if (!language) throw new Error('The interface language is unavailable for explanations.')
      await write(preferences => ({ ...preferences, interfaceLocale: locale,
        explanationLanguage: language.code, explanationVarietyId: language.defaultVariety }))
    },
    saveLanguages: async (chosen, start, varieties, explanation, locale) => {
      const catalog = languages()
      if (!chosen.includes(start)) throw new Error('The starting language must be one of the chosen languages.')
      for (const code of chosen) {
        const target = catalog.find(item => item.code === code)
        if (!target?.varieties.some(item => item.id === varieties[code])) throw new Error('Choose an available language and variety.')
      }
      const native = catalog.find(item => item.code === explanation)
      if (!native) throw new Error('Choose an available explanation language.')
      await write(preferences => ({ ...preferences,
        interfaceLocale: locale, explanationLanguage: explanation, explanationVarietyId: native.defaultVariety,
        myLanguages: chosen,
        targetVarieties: { ...preferences.targetVarieties, ...Object.fromEntries(chosen.map(code => [code, varieties[code]!])) },
        onboardingLanguage: start, onboarding: 'in_progress',
      }))
      await useSettingsStore.getState().refresh()
    },
    back: async () => { await write(preferences => ({ ...preferences, onboarding: 'not_started' })) },
    finish: async skip => {
      if (get().busy) return
      const preferences = get().preferences
      const language = preferences?.onboardingLanguage
      if (!preferences || !language) throw new Error('Choose a language before continuing.')
      set({ busy: true })
      try {
        // Select a local conversation only when leaving setup. This does not generate.
        await useSettingsStore.getState().selectLanguageVariety(language, preferences.targetVarieties[language]!)
        const current = await getSettings()
        await useSettingsStore.getState().save({ ...current,
          native_language: preferences.explanationLanguage, native_variety: preferences.explanationVarietyId,
        }, current)
        const saved = await updateOnboarding(fresh => ({ ...fresh, onboardingRequired: false,
          onboardingLanguage: null, onboarding: skip ? 'skipped' : 'completed', onboardingHelp: true }))
        set({ preferences: saved })
      } finally { set({ busy: false }) }
    },
    showHelp: async show => { await write(preferences => ({ ...preferences, onboardingHelp: show })) },
    reviewSetup: async () => {
      const settings = await getSettings()
      await write(preferences => ({ ...preferences, onboardingRequired: true, onboarding: 'not_started',
        onboardingLanguage: settings.target_language,
        myLanguages: [...new Set([...preferences.myLanguages, settings.target_language])],
        targetVarieties: { ...preferences.targetVarieties, [settings.target_language]: settings.target_variety },
      }))
    },
  }
})
