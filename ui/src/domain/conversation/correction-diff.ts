/** One changed region of an explicit correction: the learner's words and the
 * suggested words that replace them. Either side is empty for a pure insertion
 * or deletion. Both are exact substrings of the original strings. */
export interface CorrectionChange { removed: string; added: string }

/** Changed regions separated by at most this many unchanged words merge into one. */
const MERGE_GAP_WORDS = 1
/** Above this share of changed words a compact view is less clear than the full pair. */
const MAX_CHANGED_SHARE = 0.6

interface Token { text: string; start: number; end: number; word: boolean }

/** Unicode word segmentation (UAX #29 via Intl.Segmenter). Locale-independent:
 * the same policy applies to every script, including scripts without spaces. */
function tokens(text: string): Token[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  return [...segmenter.segment(text)].map(segment => ({ text: segment.segment, start: segment.index, end: segment.index + segment.segment.length, word: segment.isWordLike ?? false }))
}

/** Longest common subsequence over token text; returns matched index pairs in order. */
function commonTokens(left: Token[], right: Token[]): [number, number][] {
  const table: number[][] = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0))
  for (let i = left.length - 1; i >= 0; i--)
    for (let j = right.length - 1; j >= 0; j--)
      table[i][j] = left[i].text === right[j].text ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const pairs: [number, number][] = []
  let i = 0, j = 0
  while (i < left.length && j < right.length) {
    if (left[i].text === right[j].text) { pairs.push([i, j]); i++; j++ }
    else if (table[i + 1][j] >= table[i][j + 1]) i++
    else j++
  }
  return pairs
}

/** The changed regions between an explicit correction's quote and its
 * replacement, for a compact presentation beside the full pair. Returns null
 * when the strings are identical or when most of the wording changed, because
 * a compact view would then be less clear than the full pair. Presentation
 * only: this is not validated error evidence. */
export function correctionChanges(original: string, replacement: string): CorrectionChange[] | null {
  if (original === replacement) return null
  const left = tokens(original)
  const right = tokens(replacement)
  const pairs = commonTokens(left, right)
  // Spans of unmatched tokens between consecutive anchors.
  const spans: { left: [number, number]; right: [number, number] }[] = []
  let previous: [number, number] = [-1, -1]
  for (const pair of [...pairs, [left.length, right.length] as [number, number]]) {
    if (pair[0] > previous[0] + 1 || pair[1] > previous[1] + 1) spans.push({ left: [previous[0] + 1, pair[0]], right: [previous[1] + 1, pair[1]] })
    previous = pair
  }
  // Merge spans separated by a short unchanged gap, counted in word-like tokens.
  const merged: typeof spans = []
  for (const span of spans) {
    const last = merged.at(-1)
    const gapWords = last ? left.slice(last.left[1], span.left[0]).filter(token => token.word).length : Infinity
    if (last && gapWords <= MERGE_GAP_WORDS) { last.left[1] = span.left[1]; last.right[1] = span.right[1] }
    else merged.push({ left: [...span.left], right: [...span.right] })
  }
  const slice = (text: string, list: Token[], [from, to]: [number, number]) => from >= to ? '' : text.slice(list[from].start, list[to - 1].end).trim()
  const changes = merged.map(span => ({ removed: slice(original, left, span.left), added: slice(replacement, right, span.right) }))
    .filter(change => change.removed || change.added)
  const words = left.filter(token => token.word).length
  const changedWords = merged.reduce((sum, span) => sum + left.slice(span.left[0], span.left[1]).filter(token => token.word).length, 0)
  if (!changes.length || (words > 0 && changedWords / words > MAX_CHANGED_SHARE)) return null
  return changes
}
