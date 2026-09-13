import type { ConversationSnapshot } from '../../contracts'
import { ActivityIndicator } from '../../ui/ActivityIndicator'

/** Partner-first work has no learner bubble on which to attach its state. */
export function OpeningStatus({ snapshot, onActivity }: { snapshot: ConversationSnapshot; onActivity: () => void }) {
  if (!snapshot.opening || snapshot.opening.kind === 'learner') return null
  const turn = snapshot.turns.find(item => !item.replacedBy && item.operations.some(operation => operation.kind === 'persona_opening'))
  let error = turn?.hold?.message ?? null
  if (!turn) error = 'Conversation start is unavailable.'
  else if (!error && ['failed', 'unknown', 'unknown_outcome', 'cancelled'].includes(turn.state)) {
    error = turn.attempts.filter(attempt => attempt.error).at(-1)?.error ?? (turn.state === 'cancelled' ? 'Conversation opening was cancelled.' : turn.state === 'failed' ? 'Conversation opening failed.' : 'The outcome of the conversation opening is unknown.')
  }
  return <section className="opening-status" aria-label="Conversation opening">
    {error ? <p role="alert">{error}</p> : (turn?.paused || snapshot.connection.paused) ? <p role="status">Conversation opening is paused.</p> : <ActivityIndicator label="Starting conversation…" />}
    <button type="button" className="btn" onClick={onActivity}>Open AI activity</button>
  </section>
}
