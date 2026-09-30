import { expect, it } from 'vitest'
import { estimatedSpeechWords, estimatedTotalSpeechSeconds, speechWords, spokenRangeInText, spokenWordAt } from './speech-follow'

function alignment(sourceText: string, spoken = sourceText) {
  const characters = Array.from(spoken)
  return { sourceText, original: { characters, starts: characters.map((_, i) => i / 10), ends: characters.map((_, i) => (i + 1) / 10) }, normalized: null }
}

it.each(['Hello hello', 'مرحبا بالعالم', '你好世界', 'नमस्ते दुनिया', 'cafe\u0301 café', '🙂 hello'])('anchors original source across scripts: %s', text => {
  const words = speechWords(text, alignment(text, `[cue] ${text}`))
  expect(words.length).toBeGreaterThan(0)
  for (const word of words) {
    expect(text.slice(word.start, word.end)).not.toBe('')
    expect(word.from).toBeGreaterThanOrEqual(0.6)
    expect(spokenWordAt(words, (word.from + word.to) / 2)).toBe(word)
  }
  expect(spokenWordAt(words, 0)).toBeNull()
  expect(spokenWordAt(words, words.at(-1)!.to)).toBeNull()
})

it('keeps repeated occurrences distinct and leaves silence unhighlighted', () => {
  const words = speechWords('go go', alignment('go go'))
  expect(spokenWordAt(words, 0.1)?.start).toBe(0)
  expect(spokenWordAt(words, 0.25)).toBeNull()
  expect(spokenWordAt(words, 0.4)?.start).toBe(3)
})

it('follows only complete exact-source words while alignment is still arriving', () => {
  for (const text of ['Hola mundo', 'مرحبا بالعالم', 'cafe\u0301 next']) {
    const prefix = text.slice(0, text.indexOf(' ') + 2)
    const partial = alignment(text, `[cue] ${prefix}`)
    expect(speechWords(text, partial)).toEqual([])
    const words = speechWords(text, partial, true)
    expect(words).toHaveLength(1)
    expect(text.slice(words[0].start, words[0].end)).toBe(text.slice(0, text.indexOf(' ')))
  }
  expect(speechWords('go going', alignment('go going', 'go go'), true)).toEqual([])
})

it.each(['one two three four five', 'uno dos tres cuatro cinco', 'مرحبا بك كيف حالك اليوم', 'cafe\u0301 noir clair et calme'])('estimates remaining speech only from anchored partial timing: %s', text => {
  const boundaries = text.split(' ')
  const prefix = `${boundaries.slice(0, 3).join(' ')} `
  const estimate = estimatedTotalSpeechSeconds(text, alignment(text, prefix), 1)
  expect(estimate).not.toBeNull()
  expect(estimate!).toBeGreaterThan(1)
  expect(estimatedTotalSpeechSeconds(text, alignment('different', prefix), 1)).toBeNull()
  expect(estimatedTotalSpeechSeconds(text, alignment(text, boundaries[0]), 1)).toBeNull()
})

it('uses the original timing when normalized speech rewrites source text', () => {
  const data = alignment('café')
  expect(speechWords('café', { ...data, normalized: alignment('cafe').original })).toEqual(speechWords('café', data))
  expect(speechWords('café', alignment('different'))).toEqual([])
  expect(speechWords('go', alignment('go', 'go go'))).toEqual([])
  expect(speechWords('go', { ...alignment('go'), original: { characters: ['go'], starts: [NaN], ends: [1] } })).toEqual([])
})

it('estimates visual pacing by grapheme weight without splitting combining marks', () => {
  const words = estimatedSpeechWords('a\u0301 bbb', 4)
  expect(words).toEqual([{ start: 0, end: 2, from: 0, to: 1 }, { start: 3, end: 6, from: 1, to: 4 }])
  expect(estimatedSpeechWords('abc', Infinity)).toEqual([])
  expect(estimatedSpeechWords('...', 1)).toEqual([])
})

it('projects a selected passage into longer text without confusing repeated occurrences', () => {
  const word = { start: 3, end: 5, from: 0, to: 1 }
  expect(spokenRangeInText('go go', 'go go', word)).toEqual({ start: 3, end: 5 })
  expect(spokenRangeInText('First. go go Last.', 'go go', word)).toEqual({ start: 10, end: 12 })
  expect(spokenRangeInText('go', 'go go', word)).toBeNull()
})
