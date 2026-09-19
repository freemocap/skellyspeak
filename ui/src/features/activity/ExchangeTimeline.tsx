import type { TurnView } from '../../generated/contracts'
import { humanizeKind } from '../../domain/conversation/activity-summary'
import { useI18n } from '../../components/localization/i18n'
import { layoutTurn } from './graph-layout'
import { seconds } from './ActivityGraph'

/// Recorded attempt intervals for one exchange. A static reconstruction of
/// start and finish times, never a replay.
export function ExchangeTimeline({ turn, now }: { turn: TurnView; now: number }) {
  const tr = useI18n()
  const { nodes } = layoutTurn(turn)
  const spans = nodes.flatMap(node => {
    const start = Date.parse(node.attempt?.startedAt ?? '')
    if (!Number.isFinite(start)) return []
    const end = node.attempt?.finishedAt ? Date.parse(node.attempt.finishedAt) : now
    return [{ node, start, end: Number.isFinite(end) ? end : now }]
  })
  if (!spans.length) return <p className="ai-muted">{tr('No attempts recorded for this exchange yet.')}</p>
  const origin = Math.min(...spans.map(span => span.start))
  const extent = Math.max(1, Math.max(...spans.map(span => span.end)) - origin)
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return <figure className="ai-timeline" aria-label={tr('Attempts over time')}>
    <ol>
      {nodes.map(node => {
        const span = spans.find(item => item.node === node)
        return <li key={node.operation.id}>
          <span className="ai-timeline-kind">{humanizeKind(node.operation.kind)}</span>
          <span className="ai-timeline-track">
            {span && <span className="ai-timeline-bar" data-phase={node.phase ?? undefined}
              style={{ insetInlineStart: `${((span.start - origin) / extent) * 100}%`, inlineSize: `max(2px, ${((span.end - span.start) / extent) * 100}%)` }} />}
          </span>
        </li>
      })}
    </ol>
    <figcaption className="ai-timeline-axis">{ticks.map(tick => <span key={tick}>{seconds(extent * tick, tr)}</span>)}</figcaption>
  </figure>
}
