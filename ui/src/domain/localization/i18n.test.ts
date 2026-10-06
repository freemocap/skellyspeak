import { describe, expect, it } from 'vitest'
import { LOCALES, UI_LOCALE_METADATA, browserLocale, requireUiLocale, validateLocales, t, formatNumber, formatDate, translatedName } from './'

describe('interface locale contract', () => {
  it('validates translations independently of learning languages', () => {
    validateLocales(LOCALES)
    expect(Object.keys(LOCALES)).toContain('english')
    expect(Object.keys(LOCALES).sort()).toEqual(Object.keys(UI_LOCALE_METADATA).sort())
  })
  it('rejects missing, blank, extra and mismatched messages', () => {
    for (const translated of ([{}, { greeting: '' }, { greeting: 'Olá {other}' }, { greeting: 'Olá {name}', extra: 'extra' }] as Record<string, string>[])) {
      expect(() => validateLocales({ english: { greeting: 'Hello {name}' }, portuguese: translated })).toThrow()
    }
  })
  it('resolves exact language IDs and fails for missing locale data', () => {
    for (const id of Object.keys(LOCALES)) expect(requireUiLocale(id)).toBe(id)
    for (const id of ['xx', 'portuguese-brazil', 'zh-Hant', 'DE', '']) expect(() => requireUiLocale(id)).toThrow()
    expect(requireUiLocale(null)).toBe('english')
    expect(requireUiLocale(undefined)).toBe('english')
  })
  it('interpolates literally and rejects missing messages and variables', () => {
    expect(t('portuguese', 'Write in {value0}…', { value0: '$& {name}' })).toBe('Escreva em $& {name}…')
    expect(() => t('portuguese', 'unknown')).toThrow()
    expect(() => t('german', 'Write in {value0}…')).toThrow()
  })
  it('formats numbers and dates with the selected UI locale', () => {
    expect(formatNumber('german', 1234.5)).toBe('1.234,5')
    expect(formatNumber('portuguese', 1234.5)).toBe('1.234,5')
    expect(formatDate('german', Date.UTC(2026, 8, 13), { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })).toBe('13.09.2026')
  })
})

it('uses the Cantonese edition for interface text, interpolation and Hong Kong formatting', () => {
  expect(requireUiLocale('cantonese')).toBe('cantonese')
  expect(browserLocale('cantonese')).toBe('yue-Hant-HK')
  expect(t('cantonese', 'Settings')).toBe('設定')
  expect(t('cantonese', 'Search matches', { count: 2 })).not.toContain('{count}')
  expect(t('cantonese', 'Write in {value0}…', { value0: 'English' })).toContain('English')
  expect(formatNumber('cantonese', 1234.5)).toBe(new Intl.NumberFormat('yue-Hant-HK').format(1234.5))
})

it('selects locale plural categories and requires count', () => {
  expect(t('german', 'Search matches', { count: 1 })).toBe('1 Ergebnis')
  expect(t('german', 'Search matches', { count: 2 })).toBe('2 Ergebnisse')
  expect(t('portuguese', 'Search matches', { count: 2 })).toBe('2 resultados')
  expect(t('mandarin', 'Search matches', { count: 2 })).toBe('2 个结果')
  expect(() => t('arabic', 'Search matches')).toThrow('count')
  expect(() => t('arabic', 'Search matches', { count: NaN })).toThrow('count')
  for (const count of [0, 1, 2, 3, 11, 100]) expect(t('arabic', 'Search matches', { count })).not.toContain('{count}')
})

it('uses authored proper names without requiring a new interface catalog', () => {
  expect(translatedName('english', 'Cherokee')).toBe('Cherokee')
})
