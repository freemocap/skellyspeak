import type { AttemptView, OperationView, TurnView } from '../../generated/contracts'
import { humanizeKind, latestAttempt, operationPhase } from '../../domain/conversation/activity-summary'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useI18n } from '../../components/localization/i18n'
import { attemptDuration } from './graph-layout'
import { seconds } from './ActivityGraph'

export interface OperationRun {
  turn: TurnView
  operation: OperationView
  attempt: AttemptView | null
}

/// The same operation kind across every loaded turn, newest first.
export function operationRuns(turns: TurnView[], kind: string): OperationRun[] {
  return turns.flatMap(turn => {
    const operation = turn.operations.find(item => item.kind === kind)
    return operation ? [{ turn, operation, attempt: latestAttempt(turn, operation.id) }] : []
  })
}

export function tokenText(attempt: AttemptView | null): string {
  if (!attempt || (attempt.inputTokens === null && attempt.outputTokens === null)) return '—'
  return `${attempt.inputTokens ?? '—'} / ${attempt.outputTokens ?? '—'}`
}

export function OperationFacts({ turn, operation, attempt, now }: { turn: TurnView; operation: OperationView; attempt: AttemptView | null; now: number }) {
  const tr = useI18n()
  const dependencies = operation.dependencies.map(id => turn.operations.find(item => item.id === id)?.kind ?? id)
  const downstream = turn.operations.filter(item => item.dependencies.includes(operation.id)).length
  return <dl className="ai-facts">
    <dt>{tr('State')}</dt><dd>{operation.state}</dd>
    <dt>{tr('Role')}</dt><dd>{operation.role}</dd>
    <dt>{tr('Contract')}</dt><dd>v{operation.contractVersion}</dd>
    <dt>{tr('Depends on')}</dt><dd>{dependencies.length ? dependencies.join(', ') : tr('Nothing (entry)')}</dd>
    <dt>{tr('Feeds')}</dt><dd>{downstream}</dd>
    <dt>{tr('Model')}</dt><dd>{attempt ? attempt.actualModel ?? attempt.requestedModel : '—'}</dd>
    <dt>{tr('Provider')}</dt><dd>{attempt?.providerId ?? '—'}</dd>
    <dt>{tr('Tokens in / out')}</dt><dd>{tokenText(attempt)}</dd>
    <dt>{tr('Started')}</dt><dd>{attempt ? tr.dateTime(Date.parse(attempt.startedAt)) : '—'}</dd>
    <dt>{tr('Duration')}</dt><dd>{seconds(attemptDuration(attempt, now), tr)}</dd>
  </dl>
}

export function OperationHistory({ runs, current, onPickTurn, now }: { runs: OperationRun[]; current: string; onPickTurn: (turnId: string) => void; now: number }) {
  const tr = useI18n()
  if (!runs.length) return null
  return <ol className="ai-history">
    {runs.map(run => <li key={run.turn.id}>
      <button type="button" className="ai-history-row" aria-current={run.turn.id === current ? 'true' : undefined} onClick={() => onPickTurn(run.turn.id)}>
        <span className="ai-history-when">{run.attempt ? tr.date(Date.parse(run.attempt.startedAt), { timeStyle: 'medium' }) : '—'}</span>
        <span className="ai-history-state" data-phase={operationPhase(run.operation.state) ?? undefined}><span className="ai-node-dot" aria-hidden="true" />{run.operation.state}</span>
        <span className="ai-history-tokens">{tokenText(run.attempt)}</span>
        <span className="ai-history-duration">{seconds(attemptDuration(run.attempt, now), tr)}</span>
      </button>
    </li>)}
  </ol>
}

/// The selected operation: its declaration, latest attempt and history.
export function OperationInspector({ turn, operation, turns, now, onPickTurn, onExpand, children }: {
  turn: TurnView; operation: OperationView; turns: TurnView[]; now: number
  onPickTurn: (turnId: string) => void; onExpand: () => void; children?: React.ReactNode
}) {
  const tr = useI18n()
  const attempt = latestAttempt(turn, operation.id)
  return <aside className="ai-inspector" aria-label={tr('Selected operation')}>
    <header className="ai-inspector-head" data-phase={operationPhase(operation.state) ?? undefined}>
      <span className="ai-node-dot" aria-hidden="true" />
      <h3>{humanizeKind(operation.kind)}</h3>
      <button type="button" className="ai-icon-button" onClick={onExpand} aria-label={tr('Open {kind} in full view', { kind: humanizeKind(operation.kind) })} title={tr('Open in full view')}>
        <ToolbarIcon name="expand" size={15} />
      </button>
    </header>
    <div className="ai-inspector-body">
      <OperationFacts turn={turn} operation={operation} attempt={attempt} now={now} />
      {children}
      {attempt?.error && <p className="ai-error" role="alert">{attempt.error}</p>}
      <InspectionDiagnostics value={attempt?.diagnostics} />
      <h4 className="ai-section-title">{tr('History of this operation')}</h4>
      <OperationHistory runs={operationRuns(turns, operation.kind)} current={turn.id} onPickTurn={onPickTurn} now={now} />
    </div>
  </aside>
}

export function InspectionDiagnostics({ value }: { value: unknown }) {
  const tr = useI18n()
  if (value == null) return null
  return <section>
    <h4 className="ai-section-title">{tr('Diagnostics')}</h4>
    <p className="ai-muted">{tr('Diagnostic metadata excludes message content. Use Request and Response to inspect recorded text.')}</p>
    <ResponseDetails value={value} />
  </section>
}
