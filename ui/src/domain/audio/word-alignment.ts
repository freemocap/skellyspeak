import type { InspectionWordTiming } from '../../generated/contracts'

export type WordMatch = 'same' | 'missing' | 'unknown'

/** Display-only correspondence: canonical equivalence, case and punctuation.
 * Marks remain significant. Original labels and playback times are untouched. */
export function matchTimedWords(reference: InspectionWordTiming, take: InspectionWordTiming,
  referenceDuration: number, takeDuration: number) {
  const valid = (timing: InspectionWordTiming, duration: number) => {
    let end = 0
    return Number.isFinite(duration) && duration > 0 && timing.status === 'available'
      && !timing.unsupported.length && timing.words.length > 0 && timing.words.every(word => {
        const okay = !word.clipped && word.word.trim().length > 0 && Number.isFinite(word.start)
          && Number.isFinite(word.end) && word.start >= end && word.end > word.start && word.end <= duration
        end = word.end
        return okay
      })
  }
  if (!valid(reference, referenceDuration) || !valid(take, takeDuration)) return null
  const key = (word: string) => word.normalize('NFC').toLowerCase().replace(/[\p{P}\p{White_Space}]/gu, '')
  const a = reference.words.map(word => key(word.word)), b = take.words.map(word => key(word.word))
  // Ordered correspondence handles repeated words without crossing time anchors.
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    lengths[i][j] = a[i] && a[i] === b[j] ? 1 + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1])
  const pairs: { reference: number; take: number }[] = []
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] && a[i] === b[j]) { pairs.push({ reference: i++, take: j++ }) }
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++
    else j++
  }
  return {
    pairs,
    reference: a.map((_, index): WordMatch => pairs.some(pair => pair.reference === index) ? 'same' : 'missing'),
    take: b.map((_, index): WordMatch => pairs.some(pair => pair.take === index) ? 'same' : 'unknown'),
  }
}

/** Piecewise linear display warp through matched starts. Missing words never
 * create timestamps; playback continues to use the original recording. */
export function wordAlignment(reference: InspectionWordTiming, take: InspectionWordTiming,
  referenceDuration: number, takeDuration: number): ((seconds: number) => number) | null {
  const matches = matchTimedWords(reference, take, referenceDuration, takeDuration)
  if (!matches?.pairs.length) return null
  const points = matches.pairs.map(pair => ({ from: take.words[pair.take].start, to: reference.words[pair.reference].start }))
  if (points[0].from > 0) points.unshift({ from: 0, to: 0 })
  points.push({ from: takeDuration, to: referenceDuration })
  return seconds => {
    const time = Math.max(0, Math.min(takeDuration, seconds))
    const index = points.findIndex(point => point.from >= time)
    if (index === 0) return points[0].to
    const left = points[index - 1], right = points[index]
    return left.to + (time - left.from) / (right.from - left.from) * (right.to - left.to)
  }
}
