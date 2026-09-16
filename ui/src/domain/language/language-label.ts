import { translatedName } from '../localization'

/// Preserve the configured language identity, including distinctions such as Mandarin.
export function languageLabel(language: { code?: string; name: string; endonym: string }, locale = 'english'): string {
  const name = translatedName(locale, language.name)
  return language.endonym === name ? name : `${language.endonym} (${name})`
}
