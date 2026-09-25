import type { InspectionWordTiming } from '../../generated/contracts'

/** Visual time mapping only. Require the same word sequence (canonical Unicode
 * equivalence, case, punctuation and surrounding whitespace); never infer pronunciation or
 * invent correspondence for missing, substituted or differently split words. */
export function wordAlignment(reference: InspectionWordTiming, take: InspectionWordTiming,
  referenceDuration: number, takeDuration: number): ((seconds: number) => number) | null {
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
  if (!valid(reference, referenceDuration) || !valid(take, takeDuration)
    || reference.words.length !== take.words.length) return null
  const key = (word: string) => word.normalize('NFC').toLowerCase().replace(/[\p{P}\p{White_Space}]/gu, '')
  const anchors: { from: number; to: number }[] = []
  for (let index = 0; index < take.words.length; index++) {
    const a = take.words[index], b = reference.words[index]
    if (!key(a.word) || key(a.word) !== key(b.word)) return null
    anchors.push({ from: a.start, to: b.start }, { from: a.end, to: b.end })
  }
  // Keep leading/trailing padding when it exists; a word at the file edge
  // must not conflict with an invented silence anchor at that same instant.
  if (anchors[0].from > 0) anchors.unshift({ from: 0, to: 0 })
  if (anchors[anchors.length - 1].from < takeDuration) anchors.push({ from: takeDuration, to: referenceDuration })
  const points = [anchors[0]]
  for (const point of anchors.slice(1)) {
    const previous = points[points.length - 1]
    if (point.from === previous.from) {
      // Adjacent source words share an instant; place it midway in the
      // reference gap instead of inventing extra time in the source audio.
      previous.to = (previous.to + point.to) / 2
      continue
    }
    if (point.from < previous.from || point.to < previous.to) return null
    points.push(point)
  }
  return seconds => {
    const time = Math.max(0, Math.min(takeDuration, seconds))
    const index = points.findIndex(point => point.from >= time)
    if (index < 0) return points[points.length - 1].to
    if (index === 0) return points[0].to
    const left = points[index - 1], right = points[index]
    return left.to + (time - left.from) / (right.from - left.from) * (right.to - left.to)
  }
}
