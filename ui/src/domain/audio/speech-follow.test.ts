import { expect, it } from 'vitest'
import { estimatedSpeechWords, speechWords, spokenRangeInText, spokenWordAt } from './speech-follow'

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
