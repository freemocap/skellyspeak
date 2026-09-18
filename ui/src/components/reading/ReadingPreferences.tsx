import { createContext, useContext, type ReactNode } from 'react'
import { languageFor } from '../../platform/ipc/tauri'
import type { Settings } from '../../types'

export const ReadingPreferencesContext = createContext<{ autoTranslate: boolean; alwaysPronunciation: boolean; alwaysRomanize: boolean; supportsRomanization?: boolean }>({
  autoTranslate: false,
  alwaysPronunciation: false,
  alwaysRomanize: false,
})

export function ReadingPreferencesProvider({ settings, children }: { settings: Settings | null; children: ReactNode }) {
  return <ReadingPreferencesContext value={{
    supportsRomanization: settings != null && languageFor(settings.target_language, settings.target_variety)?.romanization != null,
    autoTranslate: settings?.auto_translate ?? false,
    alwaysPronunciation: settings?.always_pronunciation ?? false,
    alwaysRomanize: settings?.always_romanize ?? false,
  }}>{children}</ReadingPreferencesContext>
}

export function useReadingPreferences() {
  const preferences = useContext(ReadingPreferencesContext)
  const supportsRomanization = preferences.supportsRomanization ?? true
  return { ...preferences, supportsRomanization, alwaysRomanize: preferences.alwaysRomanize && supportsRomanization }
}
