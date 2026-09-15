import type { ConversationSnapshot, TurnView } from '../../generated/contracts'

export interface ReplyState {
  state: 'pending' | 'paused' | 'held' | 'failed' | 'unknown' | 'cancelled' | 'unavailable'
  error: string | null
  control: 'retry' | 'resume' | null
}

/** Operation state wins over sibling assistance; only an active reply may show progress. */
export function replyState(turn: TurnView | undefined, snapshot: Pick<ConversationSnapshot, 'connection' | 'turns'>): ReplyState {
  const operation = turn?.operations.find(item => item.kind === 'persona_reply' || item.kind === 'persona_opening')
  if (!turn || !operation) return { state: 'unavailable', error: null, control: null }
  const error = turn.hold?.message ?? turn.attempts.filter(attempt => attempt.operationId === operation.id && attempt.error).at(-1)?.error ?? null
  const retry = ['failed', 'unknown'].includes(turn.state) && snapshot.turns[0]?.id === turn.id ? 'retry' : null
  if (operation.state === 'failed') return { state: 'failed', error, control: retry }
  if (['unknown', 'unknown_outcome'].includes(operation.state)) return { state: 'unknown', error, control: retry }
  if (operation.state === 'cancelled') return { state: 'cancelled', error, control: null }
  if (!['ready', 'waiting_dependencies', 'running'].includes(operation.state)) return { state: 'unavailable', error, control: null }
  if (turn.hold) return { state: 'held', error: turn.hold.message, control: ['pending', 'assisting'].includes(turn.state) && !snapshot.connection.paused ? 'resume' : retry }
  if (turn.paused || snapshot.connection.paused) return { state: 'paused', error: null, control: snapshot.connection.paused ? null : 'resume' }
  return { state: 'pending', error: null, control: null }
}
