import { useSavedReading } from './SavedReadingProvider'
import { useReadingScope } from './ReadingContext'
import { ReadingScopeContext } from './ReadingContext'
import { UnannotatedText } from './UnannotatedText'
import { SavedGlossText } from './SavedGlossText'
import { anchoredTokenGlosses } from '../../domain/reading/gloss-display'
import { languageFor } from '../../platform/ipc/tauri'
import { ReadingPreferencesProvider } from './ReadingPreferences'
import { createContext, useEffect, type ReactNode } from 'react'
import type { GuidedToken, Settings } from '../../types'

export const ReadingSentenceContext = createContext<string | null>(null)

const ReadingContext = createContext<{
  language: string
  nativeLanguage: string
} | null>(null)

export function ReadingProvider({ settings, children }: { settings: Settings | null; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--script-scale', String(settings ? settings.script_scales?.[settings.target_language] ?? languageFor(settings.target_language, settings.target_variety)?.fontScale ?? 1 : 1))
    root.style.setProperty('--reading-scale', String((settings?.text_size ?? 100) / 100))
    // preference.text_spacing: the learner's word spacing in px (0-12).
    root.style.setProperty('--word-spacing', `${settings?.text_spacing ?? 0}px`)
    return () => { root.style.removeProperty('--reading-scale'); root.style.removeProperty('--script-scale'); root.style.removeProperty('--word-spacing') }
  }, [settings?.text_size, settings?.text_spacing, settings?.target_language, settings?.target_variety, settings?.script_scales])
  return <ReadingPreferencesProvider settings={settings}><ReadingScopeContext value={settings ? { language: settings.target_language, variety: settings.target_variety ?? null, explanation: settings.native_language, explanationVariety: settings.native_variety ?? null } : null}><ReadingContext value={{ nativeLanguage: settings?.native_language ?? 'english', language: settings?.target_language ?? 'english' }}>
    {children}
  </ReadingContext></ReadingScopeContext></ReadingPreferencesProvider>
}

export function TargetText({ text, interactive = true }: { text: string; interactive?: boolean }) {
  const saved = useSavedReading()
  const scope = useReadingScope()
  const segments = scope ? saved(text, scope) : []
  return segments.length ? <SavedGlossText text={text} segments={segments} interactive={interactive} /> : <UnannotatedText text={text} interactive={interactive} />
}

export function AnnotatedText({ text, tokens, interactive = true }: { text: string; tokens: GuidedToken[]; interactive?: boolean }) {
  return tokens.length ? <SavedGlossText text={text} segments={anchoredTokenGlosses(text, tokens)} interactive={interactive} /> : <TargetText text={text} interactive={interactive} />
}
