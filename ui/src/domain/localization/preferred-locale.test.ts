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
