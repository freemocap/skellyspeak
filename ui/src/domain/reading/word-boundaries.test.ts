import { expect, it } from 'vitest'
import { readingWords, readingPassage, wholeWordRange } from './word-boundaries'
it.each(['sí, sí', 'الكتاب جميل', 'नमस्ते', 'വീട്ടിൽ', '你好世界', '👩‍💻 sí'])('preserves all source characters in %s', text => {
  const words=readingWords(text)
  expect(words.map(part=>text.slice(part.start,part.end)).join('')).toBe(text)
  expect(words.some(part=>part.word)).toBe(true)
})
it.each(['cafe\u0301', 'الكتاب', 'नमस्ते', 'വീട്ടിൽ', '中文', 'hello'])('expands a partial word without rewriting %s', word => {
  const text = `!${word}!`
  const range = wholeWordRange(text, 2, Math.max(3, word.length))
  expect(text.slice(range.start, range.end)).toBe(word)
})
it('preserves punctuation, exact boundaries and complete emoji graphemes', () => {
  expect(wholeWordRange('one, two!', 1, 7)).toEqual({ start: 0, end: 8 })
  expect(wholeWordRange('one, two!', 0, 3)).toEqual({ start: 0, end: 3 })
  expect(wholeWordRange('👩‍💻!', 1, 3)).toEqual({ start: 0, end: 5 })
  expect(wholeWordRange('one', 1, 1)).toEqual({ start: 1, end: 1 })
})
it('keeps the selected repeated occurrence in a bounded passage',()=>{
  const text='Earlier. '.repeat(300)+'sí, sí.'
  const start=text.lastIndexOf('sí')
  const part=readingPassage(text,start,start+2,'es')
  expect(part.text.length).toBeLessThanOrEqual(2048); expect(part.text.slice(part.start,part.end)).toBe('sí'); expect(part.start).toBe(part.text.lastIndexOf('sí'))
})
