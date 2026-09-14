import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { t, uiLangFromNative, formatNumber, formatDate } from '../domain/language/i18n'

const LocaleContext = createContext('en')
export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <LocaleContext value={uiLangFromNative(locale)}>{children}</LocaleContext>
}
export function useI18n() {
  const locale = useContext(LocaleContext)
  return useMemo(() => Object.assign((key: string, vars?: Record<string, string | number>) => t(locale, key, vars), {
    locale,
    number: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(locale, value, options),
    date: (value: Date | number, options?: Intl.DateTimeFormatOptions) => formatDate(locale, value, options),
    dateTime: (value: Date | number) => formatDate(locale, value, { dateStyle: 'short', timeStyle: 'medium' }),
  }), [locale])
}
