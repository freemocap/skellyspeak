import { describe, expect, it } from 'vitest'
import type { DrillAttemptView, WordComparison } from '../../generated/contracts'
import { phraseProgress, targetWords } from './progress'

const same = (word: string): WordComparison => ({ kind: 'same', target: word, transcript: word, similarity: null })
const changed = (word: string, heard: string): WordComparison => ({ kind: 'substituted', target: word, transcript: heard, similarity: 0.5 })
const missing = (word: string): WordComparison => ({ kind: 'missing', target: word, transcript: null, similarity: null })
const extra = (heard: string): WordComparison => ({ kind: 'extra', target: null, transcript: heard, similarity: null })

const take = (sequence: number, words: WordComparison[], matchRatio: number | null, edits = 1): DrillAttemptView => ({
  id: `attempt-${sequence}`, sequence: BigInt(sequence), visitId: null, transcript: '', audioBytes: null, audioPrunedAt: null,
  transcriptionAttemptId: null, createdAt: '2026-09-23T10:00:00.000Z',
  comparison: {
    policy: 'fixture', target: '', transcript: '', normalizations: [], normalizedTarget: '', normalizedTranscript: '',
    edits, referenceGraphemes: 20, characterErrorRate: null, matchRatio, words, scriptNote: 'matches',
  },
})

describe('phraseProgress', () => {
  it('orders takes oldest first and counts each word across them', () => {
    // Native pages arrive newest first.
    const progress = phraseProgress([
      take(3, [same('ana'), changed('bifham', 'bifhim'), same('shwayye')], 0.8),
      take(2, [same('ana'), missing('bifham'), same('shwayye'), extra('ya')], 0.5),
      take(1, [same('ana'), same('bifham'), same('shwayye')], 1, 0),
    ], 10)!
    expect(progress.takes.map(entry => entry.sequence)).toEqual([1n, 2n, 3n])
    expect(progress.ratios).toEqual([1, 0.5, 0.8])
    expect(progress.best).toBe(1)
    expect(progress.latest).toBe(0.8)
    expect(progress.recentAverage).toBeCloseTo((1 + 0.5 + 0.8) / 3)
    expect(progress.exact).toBe(1)
    expect(progress.words.map(word => word.outcomes)).toEqual([
      ['same', 'same', 'same'], ['same', 'missing', 'substituted'], ['same', 'same', 'same'],
    ])
    expect(progress.trouble?.word).toBe('bifham')
    expect(progress.trouble?.misses).toBe(2)
  })

  it('names no trouble spot for a single miss, and no average before three measured takes', () => {
    const progress = phraseProgress([take(2, [changed('ana', 'ane')], null), take(1, [same('ana')], 0.9)], 10)!
    expect(progress.trouble).toBeNull()
    expect(progress.recentAverage).toBeNull()
    expect(progress.latest).toBeNull()
  })

  it('leaves out takes whose comparison split the target differently, and says how many', () => {
    const progress = phraseProgress([take(2, [same('a'), same('b')], 1, 0), take(1, [same('ab')], 1, 0)], 10)!
    expect(progress.words.map(word => word.word)).toEqual(['a', 'b'])
    expect(progress.excluded).toBe(1)
  })

  it('keeps only the newest takes up to the limit', () => {
    const progress = phraseProgress([3, 2, 1].map(n => take(n, [same('a')], n / 10)), 2)!
    expect(progress.takes.map(entry => entry.sequence)).toEqual([2n, 3n])
  })

  it('refuses a malformed comparison instead of drawing it', () => {
    expect(() => targetWords(take(1, [{ kind: 'same', target: null, transcript: 'x', similarity: null }], 1))).toThrow(/without a target/)
    expect(phraseProgress([], 5)).toBeNull()
    expect(() => phraseProgress([], 0)).toThrow()
  })
})
