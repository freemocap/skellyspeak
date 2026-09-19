import type { AttemptView, OperationView, TurnView } from '../../generated/contracts'
import { isProseReply } from './reply-state'

/// Operation states, grouped by what a surface should do with them. Every state
/// the scheduler stores is here, plus `held`, which snapshots derive for ready
/// work while inference or the turn is paused.
export type OperationPhase = 'waiting' | 'held' | 'running' | 'succeeded' | 'failed' | 'unknown' | 'ended'

export function operationPhase(state: string | null | undefined): OperationPhase | null {
  switch (state) {
    case 'waiting_dependencies': case 'ready': return 'waiting'
    case 'held': return 'held'
    case 'running': return 'running'
    case 'succeeded': return 'succeeded'
    case 'failed': return 'failed'
    case 'unknown': case 'unknown_outcome': return 'unknown'
    case 'cancelled': case 'invalidated': return 'ended'
    default: return null
  }
}

/// Operation kinds are shown as the scheduler names them, underscores removed.
/// There is deliberately no label table: the kind is the name.
export function humanizeKind(kind: string): string {
  return kind.replaceAll('_', ' ')
}

/// Words in a streaming reply, counted by the platform's word segmenter so
/// spaceless scripts count correctly.
export function countWords(text: string, locale?: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let count = 0
    for (const segment of new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)) if (segment.isWordLike) count++
    return count
  }
  return text.split(/\s+/).filter(Boolean).length
}

export function latestAttempt(turn: Pick<TurnView, 'attempts'>, operationId: string): AttemptView | null {
  return turn.attempts.filter(attempt => attempt.operationId === operationId).at(-1) ?? null
}

export interface TurnActivity {
  total: number
  done: number
  waiting: number
  held: number
  failed: number
  /// Running operations, humanized, in the order they started.
  running: string[]
  /// Whether a prose reply is being generated in this turn.
  replyRunning: boolean
  /// Words received so far for the running reply, when streamed text is known.
  replyWords: number | null
  /// The operation that finished most recently, humanized.
  lastFinished: string | null
  /// Nothing is waiting, held or running.
  settled: boolean
  /// First start to last finish, once settled.
  elapsedMs: number | null
}

function time(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/// A pure summary of one turn's recorded operations. It names nothing itself:
/// every word comes from the operations' own kinds and states.
export function turnActivity(turn: Pick<TurnView, 'operations' | 'attempts'>, replyText: string | null = null, locale?: string): TurnActivity {
  const phases = turn.operations.map(operation => ({ operation, phase: operationPhase(operation.state) }))
  const started = (operation: OperationView) => time(latestAttempt(turn, operation.id)?.startedAt) ?? Number.MAX_SAFE_INTEGER
  const running = phases.filter(item => item.phase === 'running').map(item => item.operation)
    .sort((a, b) => started(a) - started(b))
  const replyRunning = running.some(operation => isProseReply(operation.kind))
  const finished = turn.attempts
    .filter(attempt => attempt.finishedAt && turn.operations.find(operation => operation.id === attempt.operationId)?.state === 'succeeded')
    .sort((a, b) => (time(a.finishedAt) ?? 0) - (time(b.finishedAt) ?? 0))
    .at(-1)
  const settled = !phases.some(item => item.phase === 'waiting' || item.phase === 'held' || item.phase === 'running')
  const starts = turn.attempts.map(attempt => time(attempt.startedAt)).filter((value): value is number => value !== null)
  const ends = turn.attempts.map(attempt => time(attempt.finishedAt)).filter((value): value is number => value !== null)
  return {
    total: turn.operations.length,
    done: phases.filter(item => item.phase === 'succeeded').length,
    waiting: phases.filter(item => item.phase === 'waiting').length,
    held: phases.filter(item => item.phase === 'held').length,
    failed: phases.filter(item => item.phase === 'failed' || item.phase === 'unknown').length,
    running: running.map(operation => humanizeKind(operation.kind)),
    replyRunning,
    replyWords: replyRunning && replyText !== null ? countWords(replyText, locale) : null,
    lastFinished: finished ? humanizeKind(turn.operations.find(operation => operation.id === finished.operationId)!.kind) : null,
    settled,
    elapsedMs: settled && starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : null,
  }
}

/// Text a prose reply received but never published as a message: the attempt
/// failed, was cancelled, invalidated or interrupted. It stays visible.
export function retainedReplyText(turn: Pick<TurnView, 'operations' | 'attempts'> | undefined): string | null {
  const operation = turn?.operations.find(item => isProseReply(item.kind))
  if (!turn || !operation) return null
  return latestAttempt(turn, operation.id)?.unpublishedText ?? null
}
