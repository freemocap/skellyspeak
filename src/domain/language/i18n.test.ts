import { describe, expect, it } from 'vitest'
import { LOCALES, requireUiLocale, validateLocales, validateLanguageLocales, t, formatNumber, formatDate } from './i18n'

const configs = import.meta.glob('../../../config/languages/languages/*.yaml', { eager: true, query: '?raw', import: 'default' })
describe('language/locale contract', () => {
  it('discovers one complete UI locale per bundled language', () => {
    const ids = Object.values(configs).map(text => /^id: "([^"\n]+)"$/m.exec(String(text))![1]).sort()
    expect(Object.keys(LOCALES).sort()).toEqual(ids)
    expect(() => validateLanguageLocales(ids)).not.toThrow()
    validateLocales(LOCALES)
  })
  it('rejects missing, blank, extra and mismatched messages', () => {
    for (const translated of ([{}, { greeting: '' }, { greeting: 'Olá {other}' }, { greeting: 'Olá {name}', extra: 'extra' }] as Record<string, string>[])) {
      expect(() => validateLocales({ en: { greeting: 'Hello {name}' }, pt: translated })).toThrow()
    }
  })
  it('resolves exact language IDs and fails for missing locale data', () => {
    for (const id of Object.keys(LOCALES)) expect(requireUiLocale(id)).toBe(id)
    for (const id of ['xx', 'pt-BR', 'zh-Hant', 'DE', '']) expect(() => requireUiLocale(id)).toThrow()
    expect(requireUiLocale(null)).toBe('en')
    expect(requireUiLocale(undefined)).toBe('en')
    expect(() => validateLanguageLocales(['en', 'xx'])).toThrow()
  })
  it('interpolates literally and rejects missing messages and variables', () => {
    expect(t('pt', 'Write in {value0}…', { value0: '$& {name}' })).toBe('Escreva em $& {name}…')
    expect(() => t('pt', 'unknown')).toThrow()
    expect(() => t('de', 'Write in {value0}…')).toThrow()
  })
  it('formats numbers and dates with the selected UI locale', () => {
    expect(formatNumber('de', 1234.5)).toBe('1.234,5')
    expect(formatNumber('pt', 1234.5)).toBe('1.234,5')
    expect(formatDate('de', Date.UTC(2026, 8, 13), { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })).toBe('13.09.2026')
  })
})

it('selects locale plural categories and requires count', () => {
  expect(t('de', 'Search matches', { count: 1 })).toBe('1 Ergebnis')
  expect(t('de', 'Search matches', { count: 2 })).toBe('2 Ergebnisse')
  expect(t('pt', 'Search matches', { count: 2 })).toBe('2 resultados')
  expect(t('zh', 'Search matches', { count: 2 })).toBe('2 个结果')
  expect(() => t('ar', 'Search matches')).toThrow('count')
  expect(() => t('ar', 'Search matches', { count: NaN })).toThrow('count')
  for (const count of [0, 1, 2, 3, 11, 100]) expect(t('ar', 'Search matches', { count })).not.toContain('{count}')
})
