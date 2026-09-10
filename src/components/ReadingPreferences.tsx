import { createContext, useContext, type ReactNode } from 'react'
import type { Settings } from '../types'

export const ReadingPreferencesContext = createContext({
  autoTranslate: false,
  alwaysPronunciation: false,
  alwaysRomanize: false,
})

export function ReadingPreferencesProvider({ settings, children }: { settings: Settings | null; children: ReactNode }) {
  return <ReadingPreferencesContext value={{
    autoTranslate: settings?.auto_translate ?? false,
    alwaysPronunciation: settings?.always_pronunciation ?? false,
    alwaysRomanize: settings?.always_romanize ?? false,
  }}>{children}</ReadingPreferencesContext>
}

export function useReadingPreferences() {
  return useContext(ReadingPreferencesContext)
}
