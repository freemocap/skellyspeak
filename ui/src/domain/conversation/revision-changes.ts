/** How many places a revision differs from the message it replaces, counted in
 * words: each unbroken run of removed, added or replaced words is one change.
 * Whitespace between words is not a change. */
export function revisionChanges(original: string, revision: string): number {
  const before = words(original)
  const after = words(revision)
  // Longest common subsequence of words; the gaps between kept words are the changes.
  const kept: number[][] = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0))
  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      kept[i][j] = before[i] === after[j] ? kept[i + 1][j + 1] + 1 : Math.max(kept[i + 1][j], kept[i][j + 1])
  let changes = 0
  let inChange = false
  let i = 0
  let j = 0
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      inChange = false; i++; j++
      continue
    }
    if (!inChange) changes++
    inChange = true
    if (j >= after.length || (i < before.length && kept[i + 1][j] >= kept[i][j + 1])) i++
    else j++
  }
  return changes
}

function words(text: string): string[] {
  return text.trim().split(/\s+/u).filter(word => word.length > 0)
}
