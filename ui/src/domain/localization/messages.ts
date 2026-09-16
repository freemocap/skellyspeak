import type { Dict } from './dict'

export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]))].sort()
}
export function validateLocales(locales: Record<string, Dict>): void {
  const source = locales.english
  if (!source) throw new Error('Missing English UI source locale.')
  const keys = Object.keys(source).sort()
  for (const [locale, dict] of Object.entries(locales)) {
    if (Object.keys(dict).sort().join('\n') !== keys.join('\n')) throw new Error(`UI locale ${locale} must contain exactly the English message keys.`)
    for (const key of keys) {
      const original = source[key]
      const translated = dict[key]
      if (typeof original !== typeof translated) throw new Error(`UI message type mismatch: ${locale}.${key}`)
      const variants = typeof translated === 'string' ? [translated] : Object.values(translated)
      if (typeof translated !== 'string' && Object.keys(translated).sort().join() !== ['few', 'many', 'one', 'other', 'two', 'zero'].join()) throw new Error(`Incomplete plural message: ${locale}.${key}`)
      const expected = placeholders(typeof original === 'string' ? original : original.other)
      for (const variant of variants) {
        if (typeof variant !== 'string' || !variant.trim()) throw new Error(`Empty UI message: ${locale}.${key}`)
        if (placeholders(variant).join() !== expected.join()) throw new Error(`UI placeholder mismatch: ${locale}.${key}`)
      }
    }
  }
}

/** Marks a message stored in UI metadata; the authoring checker validates it. */
export function messageKey(key: string): string { return key }
