import { expect, it } from 'vitest'
import { wordAlignment } from './word-alignment'
import type { InspectionWordTiming } from '../../generated/contracts'

const timing = (words: string[], scale = 1): InspectionWordTiming => ({
  status: 'available', reason: null, unsupported: [],
  words: words.map((word, index) => ({ index, word, clipped: false,
    start: (index + 0.2) * scale, end: (index + 0.8) * scale,
    providerStart: (index + 0.2) * scale, providerEnd: (index + 0.8) * scale })),
})

it.each([['café', 'cafe\u0301'], ['مرحبا', 'مرحبا'], ['你好', '你好'], ['नमस्ते', 'नमस्ते']])(
  'aligns canonical word boundaries across scripts: %s', (reference, take) => {
    const map = wordAlignment(timing([reference, reference]), timing([take, take], 2), 3, 6)!
    expect(map(0.4)).toBeCloseTo(0.2)
    expect(map(1.6)).toBeCloseTo(0.8)
    expect(map(3.6)).toBeCloseTo(1.8)
    expect(map(5)).toBeCloseTo(2.5)
    expect(map(-1)).toBe(0)
    expect(map(10)).toBe(3)
  })

it('does not pair missing, reordered, substituted or mark-different words', () => {
  const source = timing(['one', 'two'])
  for (const words of [['one'], ['two', 'one'], ['one', 'three'], ['óne', 'two']]) {
    expect(wordAlignment(source, timing(words), 3, 3)).toBeNull()
  }
})

it('disables unavailable, overlapping, clipped and non-finite timing without guessing', () => {
  const source = timing(['one', 'two'])
  expect(wordAlignment(source, { ...source, status: 'unavailable' }, 3, 3)).toBeNull()
  for (const patch of [{ start: -1 }, { end: NaN }, { end: 5 }, { end: 0.2 }, { clipped: true }, { end: 1.5 }]) {
    const take = timing(['one', 'two'])
    Object.assign(take.words[0], patch)
    expect(wordAlignment(source, take, 3, 3)).toBeNull()
  }
})

it('uses each word boundary instead of stretching the whole take uniformly', () => {
  const reference = timing(['one', 'two'])
  const take = timing(['one', 'two'])
  take.words[0].end = 0.5
  take.words[1].start = 2
  take.words[1].end = 3
  const map = wordAlignment(reference, take, 3, 4)!
  expect(map(0.5)).toBeCloseTo(0.8)
  expect(map(2)).toBeCloseTo(1.2)
  expect(map(2.5)).toBeCloseTo(1.5)
  expect(map(3)).toBeCloseTo(1.8)
})

it('aligns case and punctuation variants without dropping diacritics or changing source text', () => {
  const reference = timing(['Café', 'مرحبا'])
  const take = timing(['café,', 'مرحبا!'], 2)
  expect(wordAlignment(reference, take, 3, 6)).not.toBeNull()
  expect(take.words[0].word).toBe('café,')
  take.words[0].word = 'cafe'
  expect(wordAlignment(reference, take, 3, 6)).toBeNull()
})

it('allows words at file edges and adjacent words without inventing a silence requirement', () => {
  const reference = timing(['one', 'two'])
  const take = timing(['one', 'two'])
  take.words[0].start = 0
  take.words[0].end = 1.2
  take.words[1].end = 3
  const map = wordAlignment(reference, take, 3, 3)!
  expect(map(0)).toBeCloseTo(0.2)
  expect(map(1.2)).toBeCloseTo(1)
  expect(map(3)).toBeCloseTo(1.8)
})
