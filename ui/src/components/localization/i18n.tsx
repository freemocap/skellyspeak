import { createContext, Fragment, useContext, useMemo, type ReactNode } from 'react'
import { t, requireUiLocale, formatNumber, formatDate, browserLocale } from '../../domain/localization'

const LocaleContext = createContext('english')
export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <LocaleContext value={requireUiLocale(locale)}>{children}</LocaleContext>
}
export function useI18n() {
  const locale = useContext(LocaleContext)
  return useMemo(() => Object.assign((key: string, vars?: Record<string, string | number>) => t(locale, key, vars), {
    locale,
    browserLocale: browserLocale(locale),
    number: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(locale, value, options),
    date: (value: Date | number, options?: Intl.DateTimeFormatOptions) => formatDate(locale, value, options),
    dateTime: (value: Date | number) => formatDate(locale, value, { dateStyle: 'short', timeStyle: 'medium' }),
    /** A message whose placeholders hold elements, such as a styled
     * target-language word, placed wherever each language's wording puts them. */
    rich: (key: string, nodes: Record<string, ReactNode>): ReactNode[] =>
      t(locale, key, Object.fromEntries(Object.keys(nodes).map(name => [name, `\u0000${name}\u0000`])))
        .split('\u0000').map((part, index) => index % 2 ? <Fragment key={index}>{nodes[part]}</Fragment> : part),
  }), [locale])
}
