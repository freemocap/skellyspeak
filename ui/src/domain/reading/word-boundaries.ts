/** Local navigation boundaries only. Meanings still come from validated source
 * annotations; Unicode segmentation is never presented as linguistic analysis. */
export function readingWords(text: string, locale?: string) {
  const segmenter = new Intl.Segmenter(locale || undefined, { granularity: 'word' })
  return Array.from(segmenter.segment(text), item => ({ start: item.index, end: item.index + item.segment.length, word: !!item.isWordLike }))
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
