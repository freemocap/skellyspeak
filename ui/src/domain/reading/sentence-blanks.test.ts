import { expect, it } from 'vitest'
import { isSentenceBlank, sentenceBlanks } from './sentence-blanks'
import { readingWords } from './word-boundaries'

it.each(['Quiero __.', 'أريد __.', 'मुझे __ चाहिए।', '我想要 __。', 'e\u0301 __', 'é __', '__ + __'])('preserves template source and separates blank slots in %s', text => {
  const slots = sentenceBlanks(text)
  expect(slots.length).toBeGreaterThan(0)
  const parts = readingWords(text)
  expect(parts.map(part => text.slice(part.start, part.end)).join('')).toBe(text)
  expect(parts.filter(part => part.blank).map(({ start, end }) => ({ start, end }))).toEqual(slots)
  for (const slot of slots) {
    expect(isSentenceBlank(text, slot.start, slot.end)).toBe(true)
    expect(parts.find(part => part.start === slot.start)?.word).toBe(false)
  }
})

it.each(['snake_case', '__name__', '我__你', 'é__', 'e\u0301__', '12__', '‿__'])('does not reinterpret identifiers or attached underscores: %s', text => {
  expect(sentenceBlanks(text)).toEqual([])
  expect(readingWords(text).some(part => part.blank)).toBe(false)
})


it.each(['我想要___。', 'أريد___اليوم.', 'मुझे___चाहिए।', 'Quiero___hoy.', 'e\u0301___', 'é___'])('recognizes adjacent slots only in declared templates: %s', text => {
  expect(sentenceBlanks(text)).toEqual([])
  const slots = sentenceBlanks(text, true)
  expect(slots).toHaveLength(1)
  const parts = readingWords(text, undefined, true)
  expect(parts.map(part => text.slice(part.start, part.end)).join('')).toBe(text)
  expect(parts.filter(part => part.blank).map(({ start, end }) => ({ start, end }))).toEqual(slots)
})
