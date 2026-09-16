import { placeholders, validateLocales } from './messages'
export { validateLocales, messageKey } from './messages'
// Locale files are bundled automatically. English defines the message contract;
// an incomplete locale is an error, never an implicit English translation.
import type { Dict } from './dict'
export type UiLang = string
const modules = import.meta.glob<Dict>('./locales/*.json', { eager: true, import: 'default' })
export const LOCALES: Record<string, Dict> = Object.fromEntries(Object.entries(modules).map(([path, dict]) => [path.slice('./locales/'.length, -'.json'.length), dict]))

validateLocales(LOCALES)

export function requireUiLocale(value: string | null | undefined): UiLang {
  // English is the explicit pre-settings startup locale only.
  const locale = value ?? 'english'
  if (!Object.hasOwn(LOCALES, locale)) throw new Error(`Missing UI locale: ${locale}`)
  return locale
}
/** Browser locale identifiers belong only at the formatting boundary. */
export const UI_LOCALE_METADATA: Record<string, { name: string; endonym: string; tag: string; direction: 'ltr' | 'rtl' }> = {
  english: { name: 'English', endonym: 'English', tag: 'en', direction: 'ltr' },
  spanish: { name: 'Spanish', endonym: 'Español', tag: 'es', direction: 'ltr' },
  arabic: { name: 'Arabic', endonym: 'العربية', tag: 'ar', direction: 'rtl' },
  mandarin: { name: 'Mandarin', endonym: '中文（简体）', tag: 'zh', direction: 'ltr' },
  french: { name: 'French', endonym: 'Français', tag: 'fr', direction: 'ltr' },
  german: { name: 'German', endonym: 'Deutsch', tag: 'de', direction: 'ltr' },
  portuguese: { name: 'Portuguese', endonym: 'Português', tag: 'pt', direction: 'ltr' },
}
export function browserLocale(lang: UiLang): string {
  const id = requireUiLocale(lang)
  const metadata = UI_LOCALE_METADATA[id]
  if (!metadata) throw new Error(`Missing browser locale mapping: ${id}`)
  return metadata.tag
}
/** Authored proper names need not be keys in the interface message catalog. */
export function translatedName(lang: UiLang, name: string): string {
  const dict = LOCALES[requireUiLocale(lang)]
  return Object.hasOwn(dict, name) ? t(lang, name) : name
}
export function t(lang: UiLang, key: string, vars: Record<string, string | number> = {}): string {
  const locale = requireUiLocale(lang)
  const message = Object.hasOwn(LOCALES[locale], key) ? LOCALES[locale][key] : undefined
  if (message === undefined) throw new Error(`Missing UI message: ${locale}.${key}`)
  if (typeof message !== 'string' && (typeof vars.count !== 'number' || !Number.isFinite(vars.count))) throw new Error(`Plural message requires a finite count: ${locale}.${key}`)
  const text = typeof message === 'string' ? message : message[new Intl.PluralRules(browserLocale(locale)).select(vars.count as number)]
  const expected = placeholders(text)
  if (expected.some(name => !Object.hasOwn(vars, name))) throw new Error(`Missing UI interpolation: ${locale}.${key}`)
  return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name: string) => typeof vars[name] === 'number' ? formatNumber(locale, vars[name] as number) : String(vars[name]))
}

export function formatNumber(lang: UiLang, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(browserLocale(lang), options).format(value)
}
export function formatDate(lang: UiLang, value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(browserLocale(lang), options).format(value)
}

export function formatRelativeTime(lang: UiLang, value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(browserLocale(lang), { numeric: 'auto' }).format(value, unit)
}
