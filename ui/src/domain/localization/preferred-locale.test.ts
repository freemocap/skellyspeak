import { expect, it } from 'vitest'
import { preferredUiLocale } from './preferred-locale'

it('matches regional device preferences in priority order', () => {
  expect(preferredUiLocale(['es-MX', 'en-US'])).toBe('spanish')
  expect(preferredUiLocale(['ja-JP', 'pt-BR', 'de-DE'])).toBe('portuguese')
  expect(preferredUiLocale(['ar-EG'])).toBe('arabic')
})
it('uses English for unavailable or malformed preferences', () => {
  expect(preferredUiLocale([])).toBe('english')
  expect(preferredUiLocale(['not_a_locale', 'ja-JP'])).toBe('english')
})
it('does not substitute Simplified Chinese for an unsupported Traditional preference', () => {
  expect(preferredUiLocale(['zh-TW', 'fr-CA'])).toBe('french')
  expect(preferredUiLocale(['zh-Hant'])).toBe('english')
  expect(preferredUiLocale(['zh-Hans-SG'])).toBe('mandarin')
})

it('matches Cantonese independently of Mandarin without guessing language from region', () => {
  expect(preferredUiLocale(['yue-Hant-HK', 'en'])).toBe('cantonese')
  expect(preferredUiLocale(['yue', 'zh-Hans'])).toBe('cantonese')
  expect(preferredUiLocale(['zh-HK', 'yue-Hant-HK'])).toBe('cantonese')
  expect(preferredUiLocale(['zh-HK'])).toBe('english')
  expect(preferredUiLocale(['yue-Hans', 'zh-Hans'])).toBe('mandarin')
  expect(preferredUiLocale(['en-Shaw', 'de'])).toBe('german')
})
