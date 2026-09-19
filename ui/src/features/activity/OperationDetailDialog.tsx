import { useState } from 'react'
import type { OperationView, TurnView } from '../../generated/contracts'
import { humanizeKind } from '../../domain/conversation/activity-summary'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { useI18n } from '../../components/localization/i18n'
import { attemptDuration } from './graph-layout'
import { OperationFacts, OperationHistory, operationRuns } from './OperationInspector'
import { AttemptBodies } from './AttemptBodies'

/// Latency of this operation across loaded exchanges, oldest to newest.
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values), min = Math.min(...values)
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${max === min ? 50 : 100 - ((value - min) / (max - min)) * 100}`).join(' ')
  return <svg className="ai-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>
}

/// One operation filling the window: every attempt, its request and
/// response, history and diagnostics.
export function OperationDetailDialog({ turn, operation, turns, now, onPickTurn, onClose }: {
  turn: TurnView; operation: OperationView; turns: TurnView[]; now: number; onPickTurn: (turnId: string) => void; onClose: () => void
}) {
  const tr = useI18n()
  const attempts = turn.attempts.filter(attempt => attempt.operationId === operation.id)
  const [picked, setPicked] = useState<string | null>(null)
  const attempt = attempts.find(item => item.id === picked) ?? attempts.at(-1) ?? null
  const runs = operationRuns(turns, operation.kind)
  const durations = runs.map(run => attemptDuration(run.attempt, now)).filter((value): value is number => value !== null).reverse()
  return <DetailDialog title={humanizeKind(operation.kind)} size="wide" onClose={onClose}>
    <div className="ai-detail">
      <header className="ai-detail-head">
        <h2>{humanizeKind(operation.kind)}</h2>
        {attempts.length > 1 && <div className="ai-attempts" role="group" aria-label={tr('Attempts')}>
          {attempts.map((item, index) => <button key={item.id} type="button" className="ai-chip" aria-pressed={item.id === attempt?.id} onClick={() => setPicked(item.id)}>{tr('Attempt {number}', { number: index + 1 })} · {item.state}</button>)}
        </div>}
      </header>
      <section className="ai-detail-facts">
        <OperationFacts turn={turn} operation={operation} attempt={attempt} now={now} />
        {attempt?.error && <p className="ai-error" role="alert">{attempt.error}</p>}
      </section>
      <section className="ai-detail-bodies">
        {attempt ? <AttemptBodies attempt={attempt} /> : <p className="ai-muted">{tr('This operation has not started.')}</p>}
      </section>
      <section className="ai-detail-history">
        <h3 className="ai-section-title">{tr('History of this operation')}</h3>
        <Sparkline values={durations} />
        <OperationHistory runs={runs} current={turn.id} onPickTurn={onPickTurn} now={now} />
        <h3 className="ai-section-title">{tr('Diagnostics')}</h3>
        <ResponseDetails value={attempt?.diagnostics} />
      </section>
    </div>
  </DetailDialog>
}
