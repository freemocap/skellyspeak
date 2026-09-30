import type { TurnView } from '../../generated/contracts'

/// How many fixes led to a message: the replacements behind its turn, each a
/// revision the learner sent in place of the message before. The chain is read
/// from the loaded turns; a replaced turn older than them still counts, and
/// ends the count.
export function fixCount(turnId: string | null | undefined, turns: readonly Pick<TurnView, 'id' | 'replacesTurnId'>[]): number {
  const replaces = new Map(turns.map(turn => [turn.id, turn.replacesTurnId]))
  const seen = new Set<string>()
  let count = 0
  let previous = turnId ? replaces.get(turnId) ?? null : null
  while (previous && !seen.has(previous)) {
    seen.add(previous)
    count++
    previous = replaces.get(previous) ?? null
  }
  return count
}
