import { t } from '../localization'

/// Preserve the configured language identity, including distinctions such as Mandarin.
export function languageLabel(language: { code?: string; name: string; endonym: string }, locale = 'en'): string {
  const name = t(locale, language.name)
  return language.endonym === name ? name : `${language.endonym} (${name})`
}
