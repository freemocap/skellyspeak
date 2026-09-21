import { expect, it } from 'vitest'
import { languageBadgeSample, requiresWholeWordShaping, sourceScriptRuns } from './script-text'

it.each(['الكتاب', 'اردو', 'فارسی', 'ܫܠܡܐ', 'ߒߞߏ', 'ᠮᠣᠩᠭᠣᠯ', 'हिन्दी', 'मराठी', 'বাংলা', 'ਪੰਜਾਬੀ', 'ગુજરાતી', 'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം', 'සිංහල', 'ខ្មែរ', 'မြန်မာ', 'e\u0301'])('preserves joining and grapheme integrity for %s without a language ID', text => {
  expect(requiresWholeWordShaping(text)).toBe(true)
})

it.each(['plain', 'Ελληνικά', 'Русский', '中文', '日本語', '🙂'])('does not combine independent characters in %s', text => {
  expect(requiresWholeWordShaping(text)).toBe(false)
})

it('detects shaping within mixed script passages', () => {
  expect(requiresWholeWordShaping('English اردو 中文')).toBe(true)
})

it.each([
  ['हिन्दी', 'हि'], ['मराठी', 'म'], ['മലയാളം', 'മ'], ['اردو', 'ا'],
  ['English', 'En'], ['e\u0301cole', 'e\u0301c'], ['Русский', 'Ру'], ['中文', '中'],
])('keeps the badge sample of %s grapheme-safe', (text, sample) => {
  expect(languageBadgeSample(text)).toBe(sample)
})

it.each(['اردو', 'हिन्दी', 'தமிழ்', '中文', 'Русский'])('finds %s within mixed explanations without changing source offsets', source => {
  const text = `Meaning: ${source} (reading aid)`
  expect(sourceScriptRuns(text)).toEqual([{ text: source, start: 9, end: 9 + source.length }])
})


it.each(['한', 'か\u3099', 'e\u0323\u0302'])('preserves decomposed clusters in %s', text => {
  expect(requiresWholeWordShaping(text)).toBe(true)
})

it.each([
  ['한국어', '한'], ['日本語', '日'], ['Tiếng Việt', 'Ti'], ['Bahasa Indonesia', 'Ba'],
  ['Türkçe', 'Tü'], ['Українська', 'Ук'], ['ᏣᎳᎩ', 'Ꮳ'],
])('keeps new language badge %s intact', (text, sample) => {
  expect(languageBadgeSample(text)).toBe(sample)
})
