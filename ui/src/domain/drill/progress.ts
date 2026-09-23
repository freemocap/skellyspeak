import type { DrillAttemptView, WordOutcome } from '../../generated/contracts'

/** One target word across the takes being summarised, oldest take first. */
export interface WordHistory {
  word: string
  outcomes: Exclude<WordOutcome, 'extra'>[]
  /** Takes in which this word was not heard exactly as written. */
  misses: number
}

/** What the loaded takes of one phrase add up to. Every figure is counted from
 * the comparisons native stored; nothing here grades pronunciation. */
export interface PhraseProgress {
  /** Takes summarised, oldest first. */
  takes: DrillAttemptView[]
  /** Measured match ratio per take, oldest first; null where it was not measurable. */
  ratios: (number | null)[]
  best: number | null
  latest: number | null
  /** Mean of the last three measured ratios, when there are three. */
  recentAverage: number | null
  exact: number
  words: WordHistory[]
  /** Takes left out of the word grid because recognition was unreliable or their comparison split the target differently. */
  excluded: number
  /** The word missed most often, when it was missed more than once. */
  trouble: WordHistory | null
}

/** The target words a comparison aligned against, in reading order. */
export function targetWords(attempt: DrillAttemptView): string[] {
  return attempt.comparison.words.flatMap(word => {
    if (word.kind === 'extra') return []
    if (word.target === null) throw new Error(`Attempt ${attempt.id} has a ${word.kind} word without a target.`)
    return [word.target]
  })
}

/** Summarise up to `limit` of the newest takes. `attempts` arrive newest first,
 * the order native pages them in. */
export function phraseProgress(attempts: DrillAttemptView[], limit: number): PhraseProgress | null {
  if (limit < 1) throw new Error('A progress summary needs room for at least one take.')
  if (!attempts.length) return null
  const takes = attempts.slice(0, limit).reverse()
  const ratios = takes.map(take => take.comparison.matchRatio)
  const measured = ratios.filter((ratio): ratio is number => ratio !== null)
  const recent = measured.slice(-3)

  // The newest take decides the target; a take compared against a different
  // split of the target cannot share its rows.
  const target = targetWords(takes[takes.length - 1])
  const key = target.join('\u0000')
  const aligned = takes.filter(take => take.comparison.reliability?.accepted !== false && targetWords(take).join('\u0000') === key)
  const words = target.map((word, index) => {
    const outcomes = aligned.map(take => {
      const kind = take.comparison.words.filter(entry => entry.kind !== 'extra')[index].kind
      if (kind === 'extra') throw new Error('Extra words were filtered out of the target alignment.')
      return kind
    })
    return { word, outcomes, misses: outcomes.filter(outcome => outcome !== 'same').length }
  })
  const worst = words.reduce<WordHistory | null>((found, word) => !found || word.misses > found.misses ? word : found, null)

  return {
    takes,
    ratios,
    best: measured.length ? Math.max(...measured) : null,
    latest: ratios[ratios.length - 1],
    recentAverage: recent.length === 3 ? recent.reduce((sum, value) => sum + value, 0) / 3 : null,
    exact: takes.filter(take => Number(take.comparison.edits) === 0 && take.comparison.matchRatio !== null).length,
    words,
    excluded: takes.length - aligned.length,
    trouble: worst && worst.misses > 1 ? worst : null,
  }
}
