import { UI_LOCALE_METADATA } from './index'

/** Match language and likely script in device preference order, independently of region. */
export function preferredUiLocale(tags: readonly string[]): string {
  for (const tag of tags) {
    let locale: Intl.Locale
    try { locale = new Intl.Locale(tag) } catch { continue }
    const script = locale.maximize().script
    const match = Object.entries(UI_LOCALE_METADATA).find(([, metadata]) => {
      const supported = new Intl.Locale(metadata.tag).maximize()
      return supported.language === locale.language && supported.script === script
    })
    if (match) return match[0]
  }
  return 'english'
}
