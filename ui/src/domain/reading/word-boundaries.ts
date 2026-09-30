import { sentenceBlanks } from './sentence-blanks'

/** Local navigation boundaries only. Meanings still come from validated source
 * annotations; Unicode segmentation is never presented as linguistic analysis. */
export function readingWords(text: string, locale?: string, template = false) {
  const segmenter = new Intl.Segmenter(locale || undefined, { granularity: 'word' })
  const parts: { start: number; end: number; word: boolean; blank: boolean }[] = []
  const appendWords = (start: number, end: number) => {
    for (const item of segmenter.segment(text.slice(start, end))) {
      parts.push({ start: start + item.index, end: start + item.index + item.segment.length, word: !!item.isWordLike, blank: false })
    }
  }
  let cursor = 0
  for (const blank of sentenceBlanks(text, template)) {
    appendWords(cursor, blank.start)
    parts.push({ ...blank, word: false, blank: true })
    cursor = blank.end
  }
  appendWords(cursor, text.length)
  return parts
}

/** Large reports remain inspectable without truncating a chosen occurrence.
 * Prefer its complete sentence; a very long sentence uses the selected word. */
export function readingPassage(text: string, start: number, end: number, locale?: string) {
  if (text.length <= 2048) return { text, start, end }
  const sentence = Array.from(new Intl.Segmenter(locale || undefined, { granularity: 'sentence' }).segment(text))
    .find(item => item.index <= start && item.index + item.segment.length >= end)
  if (sentence && sentence.segment.length <= 2048) return { text: sentence.segment, start: start - sentence.index, end: end - sentence.index }
  return { text: text.slice(start, end), start: 0, end: end - start }
}
