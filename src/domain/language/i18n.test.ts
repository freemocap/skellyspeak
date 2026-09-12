import { describe, expect, it } from 'vitest'
import { LOCALES, uiLangFromNative } from './i18n'

const enKeys = Object.keys(LOCALES.en).sort()

describe('i18n locale completeness', () => {
  it('every locale has exactly the same keys as English', () => {
    const problems: string[] = []
    for (const [lang, dict] of Object.entries(LOCALES)) {
      const keys = Object.keys(dict)
      const missing = enKeys.filter((k) => !keys.includes(k))
      const extra = keys.filter((k) => !enKeys.includes(k))
      if (missing.length) problems.push(`${lang} missing: ${missing.join(', ')}`)
      if (extra.length) problems.push(`${lang} extra: ${extra.join(', ')}`)
    }
    expect(problems).toEqual([])
  })

  it('no locale has an empty translation', () => {
    const empty: string[] = []
    for (const [lang, dict] of Object.entries(LOCALES)) {
      for (const [key, value] of Object.entries(dict)) {
        if (value.trim() === '') empty.push(`${lang}.${key}`)
      }
    }
    expect(empty).toEqual([])
  })
})

describe('uiLangFromNative', () => {
  it('maps each native language to its UI locale', () => {
    expect(uiLangFromNative('en')).toBe('en')
    expect(uiLangFromNative('fr-CA')).toBe('fr')
    expect(uiLangFromNative('es-MX')).toBe('es')
    expect(uiLangFromNative('ar-LE')).toBe('ar')
    expect(uiLangFromNative('zh-CN')).toBe('zh')
  })

  it('falls back to English for an unknown language', () => {
    expect(uiLangFromNative('de')).toBe('en')
    expect(uiLangFromNative(null)).toBe('en')
    expect(uiLangFromNative(undefined)).toBe('en')
  })
})
