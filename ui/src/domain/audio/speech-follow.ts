import type { SpeechAlignment } from '../../generated/contracts'
import { readingWords } from '../reading/word-boundaries'

export interface SpokenWord { start: number; end: number; from: number; to: number }

export function spokenRangeInText(text: string, source: string, word: SpokenWord): { start: number; end: number } | null {
  if (!text || !source) return null
  const inner = source.indexOf(text)
  const outer = text.indexOf(source)
  const offset = inner >= 0 && source.indexOf(text, inner + 1) === -1 ? -inner
    : outer >= 0 && text.indexOf(source, outer + 1) === -1 ? outer : null
  if (offset === null || word.start + offset < 0 || word.end + offset > text.length) return null
  return { start: word.start + offset, end: word.end + offset }
}

/** Exact UTF-16 source anchors only: cues and rewritten speech are not display text. */
export function speechWords(text: string, alignment: SpeechAlignment | null | undefined, partial = false): SpokenWord[] {
  if (!text || alignment?.sourceText !== text) return []
  for (const timing of [alignment.normalized, alignment.original]) {
    if (!timing) continue
    const { characters, starts, ends } = timing
    if (!characters.length || characters.length !== starts.length || starts.length !== ends.length ||
      characters.some((part, i) => !part || !Number.isFinite(starts[i]) || !Number.isFinite(ends[i]) || starts[i] < 0 || ends[i] < starts[i] || (i > 0 && starts[i] < starts[i - 1]))) continue
    const spoken = characters.join('')
    let offset = spoken.indexOf(text)
    if (offset < 0 && partial) {
      const first = readingWords(text).find(word => word.word)
      if (first) {
        const prefix = text.slice(0, first.end)
        const candidate = spoken.indexOf(prefix)
        if (candidate >= 0 && spoken.indexOf(prefix, candidate + 1) === -1 && text.startsWith(spoken.slice(candidate))) offset = candidate
      }
    }
    if (offset < 0 || spoken.indexOf(text, offset + 1) !== -1) continue
    let cursor = 0
    const spans = characters.map(part => { const start = cursor; cursor += part.length; return { start, end: cursor } })
    return readingWords(text).filter(word => word.word && offset + word.end <= spoken.length).map(word => {
      const first = spans.findIndex(span => span.start <= offset + word.start && span.end > offset + word.start)
      const last = spans.findIndex(span => span.start < offset + word.end && span.end >= offset + word.end)
      return { start: word.start, end: word.end, from: starts[first], to: ends[last] }
    })
  }
  return []
}

export function spokenWordAt(words: SpokenWord[], seconds: number): SpokenWord | null {
  return words.find(word => seconds >= word.from && seconds < word.to) ?? null
}

/** Visual pacing only when timing is absent/unmappable; never learning evidence. */
export function estimatedSpeechWords(text: string, duration: number): SpokenWord[] {
  if (!Number.isFinite(duration) || duration <= 0) return []
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const words = readingWords(text).filter(word => word.word)
  const weights = words.map(word => Array.from(graphemes.segment(text.slice(word.start, word.end))).length)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = 0
  return words.map((word, i) => {
    const from = cursor / total * duration
    cursor += weights[i]
    return { start: word.start, end: word.end, from, to: cursor / total * duration }
  })
}
