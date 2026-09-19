import type { TurnActivity } from '../../domain/conversation/activity-summary'
import { useI18n } from '../localization/i18n'

/// One line describing what a turn's AI work is doing right now. Operation
/// names are the scheduler's own kinds; only the connecting words are
/// translated.
export function activitySummaryText(activity: TurnActivity, tr: ReturnType<typeof useI18n>): string {
  if (activity.total === 0) return tr('No recorded AI operations.')
  if (activity.settled) {
    const seconds = activity.elapsedMs === null ? null : tr.number(activity.elapsedMs / 1000, { maximumFractionDigits: 1 })
    const done = seconds === null ? tr('Activity settled', { count: activity.total }) : tr('Activity settled in', { count: activity.total, seconds })
    return activity.failed ? `${done} · ${tr('Activity failed', { count: activity.failed })}` : done
  }
  const parts: string[] = []
  if (activity.running.length) {
    const lead = activity.running.slice(0, 2).join(', ')
    const more = activity.running.length - 2
    parts.push(more > 0 ? `${lead} ${tr('Activity more', { count: more })}` : lead)
    if (activity.replyWords !== null) parts.push(tr('Activity words', { count: activity.replyWords }))
  } else parts.push(activity.held ? tr('Held') : tr('Waiting'))
  parts.push(tr('{done}/{total} done', { done: activity.done, total: activity.total }))
  if (activity.waiting && activity.running.length) parts.push(tr('Activity waiting', { count: activity.waiting }))
  if (activity.held) parts.push(tr('Activity held', { count: activity.held }))
  if (activity.failed) parts.push(tr('Activity failed', { count: activity.failed }))
  return parts.join(' · ')
}

export function ActivitySummary({ activity, showLast = true }: { activity: TurnActivity; showLast?: boolean }) {
  const tr = useI18n()
  const busy = !activity.settled && activity.running.length > 0
  return <span className="activity-summary" data-busy={busy || undefined}>
    {busy && <span className="activity-spinner" aria-hidden="true" />}
    <span className="activity-summary-text">{activitySummaryText(activity, tr)}</span>
    {showLast && busy && activity.lastFinished && <span className="activity-summary-last">· {tr('finished {kind}', { kind: activity.lastFinished })}</span>}
  </span>
}
