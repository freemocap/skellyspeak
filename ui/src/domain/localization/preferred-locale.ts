import { UI_LOCALE_METADATA } from './index'

/** Match device preferences in order. Do not treat Traditional Chinese as Simplified. */
export function preferredUiLocale(tags: readonly string[]): string {
  for (const tag of tags) {
    let locale: Intl.Locale
    try { locale = new Intl.Locale(tag) } catch { continue }
    if (locale.language === 'zh' && locale.maximize().script !== 'Hans') continue
    const match = Object.entries(UI_LOCALE_METADATA).find(([, metadata]) => metadata.tag === locale.language)
    if (match) return match[0]
  }
  return 'english'
}
