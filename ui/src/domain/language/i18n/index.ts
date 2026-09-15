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
  const locale = value ?? 'en'
  if (!Object.hasOwn(LOCALES, locale)) throw new Error(`Missing UI locale: ${locale}`)
  return locale
}
export function validateLanguageLocales(ids: readonly string[]): void {
  for (const id of ids) requireUiLocale(id)
}
export function t(lang: UiLang, key: string, vars: Record<string, string | number> = {}): string {
  const locale = requireUiLocale(lang)
  const message = Object.hasOwn(LOCALES[locale], key) ? LOCALES[locale][key] : undefined
  if (message === undefined) throw new Error(`Missing UI message: ${locale}.${key}`)
  if (typeof message !== 'string' && (typeof vars.count !== 'number' || !Number.isFinite(vars.count))) throw new Error(`Plural message requires a finite count: ${locale}.${key}`)
  const text = typeof message === 'string' ? message : message[new Intl.PluralRules(locale).select(vars.count as number)]
  const expected = placeholders(text)
  if (expected.some(name => !Object.hasOwn(vars, name))) throw new Error(`Missing UI interpolation: ${locale}.${key}`)
  return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name: string) => typeof vars[name] === 'number' ? formatNumber(locale, vars[name] as number) : String(vars[name]))
}

export function formatNumber(lang: UiLang, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(requireUiLocale(lang), options).format(value)
}
export function formatDate(lang: UiLang, value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(requireUiLocale(lang), options).format(value)
}

export function formatRelativeTime(lang: UiLang, value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(requireUiLocale(lang), { numeric: 'auto' }).format(value, unit)
}
