import { expect, it } from 'vitest'
import { matchTimedWords, wordAlignment } from './word-alignment'
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

it('aligns partial sequences and classifies missing and unexpected words', () => {
  const source = timing(['one', 'two', 'three'])
  const take = timing(['one', 'extra', 'three'], 2)
  const matches = matchTimedWords(source, take, 4, 8)!
  expect(matches.reference).toEqual(['same', 'missing', 'same'])
  expect(matches.take).toEqual(['same', 'unknown', 'same'])
  const map = wordAlignment(source, take, 4, 8)!
  expect(map(0.4)).toBeCloseTo(0.2)
  expect(map(4.4)).toBeCloseTo(2.2)
  expect(wordAlignment(source, timing(['other']), 4, 2)).toBeNull()
})

it('pairs repeated words in order without crossing anchors', () => {
  const source = timing(['one', 'two', 'one'])
  const take = timing(['one', 'one'])
  expect(matchTimedWords(source, take, 4, 3)?.pairs).toEqual([{ reference: 0, take: 0 }, { reference: 2, take: 1 }])
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

it('uses each matched start instead of stretching the whole take uniformly', () => {
  const reference = timing(['one', 'two'])
  const take = timing(['one', 'two'])
  take.words[0].end = 0.5
  take.words[1].start = 2
  take.words[1].end = 3
  const map = wordAlignment(reference, take, 3, 4)!
  expect(map(0.5)).toBeCloseTo(0.2 + 0.3 / 1.8)
  expect(map(2)).toBeCloseTo(1.2)
  expect(map(2.5)).toBeCloseTo(1.65)
  expect(map(3)).toBeCloseTo(2.1)
})

it('aligns case and punctuation variants without dropping diacritics or changing source text', () => {
  const reference = timing(['Café', 'مرحبا'])
  const take = timing(['café,', 'مرحبا!'], 2)
  expect(wordAlignment(reference, take, 3, 6)).not.toBeNull()
  expect(take.words[0].word).toBe('café,')
  take.words[0].word = 'cafe'
  expect(matchTimedWords(reference, take, 3, 6)?.reference).toEqual(['missing', 'same'])
})

it('allows words at file edges and adjacent words without inventing a silence requirement', () => {
  const reference = timing(['one', 'two'])
  const take = timing(['one', 'two'])
  take.words[0].start = 0
  take.words[0].end = 1.2
  take.words[1].end = 3
  const map = wordAlignment(reference, take, 3, 3)!
  expect(map(0)).toBeCloseTo(0.2)
  expect(map(1.2)).toBeCloseTo(1.2)
  expect(map(3)).toBeCloseTo(3)
})
