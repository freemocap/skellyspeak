import { expect, it } from 'vitest'
import { readingWords, readingPassage } from './word-boundaries'
it.each(['sí, sí', 'الكتاب جميل', 'नमस्ते', 'വീട്ടിൽ', '你好世界', '👩‍💻 sí'])('preserves all source characters in %s', text => {
  const words=readingWords(text)
  expect(words.map(part=>text.slice(part.start,part.end)).join('')).toBe(text)
  expect(words.some(part=>part.word)).toBe(true)
})
it('keeps the selected repeated occurrence in a bounded passage',()=>{
  const text='Earlier. '.repeat(300)+'sí, sí.'
  const start=text.lastIndexOf('sí')
  const part=readingPassage(text,start,start+2,'es')
  expect(part.text.length).toBeLessThanOrEqual(2048); expect(part.text.slice(part.start,part.end)).toBe('sí'); expect(part.start).toBe(part.text.lastIndexOf('sí'))
})
