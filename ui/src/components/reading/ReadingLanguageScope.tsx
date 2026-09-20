import { useContext, type ReactNode } from 'react'
import { ReadingScopeContext } from './ReadingContext'
import { ReadingPreferencesContext } from './ReadingPreferences'
import { languageFor } from '../../platform/ipc/tauri'

/** Read inspected content in its own language, independently of the active chat. */
export function ReadingLanguageScope({ language, variety, explanation, children }: { language: string; explanation?: string; variety?: string | null; children: ReactNode }) {
  const parent = useContext(ReadingScopeContext)
  const preferences = useContext(ReadingPreferencesContext)
  if (!parent) return <>{children}</>
  const definition = languageFor(language, variety ?? undefined)
  return <ReadingScopeContext value={parent ? { ...parent, language, variety: variety ?? null, explanation: explanation ?? parent.explanation, explanationVariety: explanation && explanation !== parent.explanation ? null : parent.explanationVariety } : null}>
    <ReadingPreferencesContext value={{ ...preferences, supportsRomanization: definition?.romanization != null }}>
      <div className="reading-language-scope" lang={definition?.languageTag} data-reading-language={language} data-reading-variety={variety ?? undefined}>{children}</div>
    </ReadingPreferencesContext>
  </ReadingScopeContext>
}
