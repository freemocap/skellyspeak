import { useState } from 'react'
import type { EffortDimension } from '../../../generated/contracts'
import { useEffortReport } from '../../../state/learning/useEffortReport'
import { effortDimensions } from '../../../components/learning/effort-dimensions'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useI18n } from '../../../components/localization/i18n'
import { InfoTip } from '../../../components/controls/InfoTip'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'

export function EffortReport({ target, revision }: { target: string; revision: unknown }) {
  const tr = useI18n()
  const [filter, setFilter] = useState<EffortDimension | null>(null)
  const { report, error, loading, more } = useEffortReport(target, filter, revision)
  return <section className="effort-report" aria-label={tr('Lifetime effort')}>
    <header className="effort-report-heading"><h3>{tr('Effort')}</h3><InfoTip>{tr('Lifetime counts for this language. Earned counts remain when source history is deleted.')}</InfoTip></header>
    {error && <ErrorNotice error={error}>{error}</ErrorNotice>}
    {!report ? loading && <p role="status">{tr('Loading…')}</p> : <>
      <div className="effort-stat-cards">{effortDimensions.map(({ dimension, label, icon }) => {
        const stats = report.activity.find(item => item.dimension === dimension)
        return <div className="effort-stat-card" key={dimension}>
          <h4><ToolbarIcon name={icon} size={16} />{tr(label)}</h4>
          <strong className="effort-stat-total">{tr.number(stats?.total ?? 0)}</strong>
          <dl><div><dt>{tr('Last 7 days')}</dt><dd>{tr.number(stats?.lastSevenDays ?? 0)}</dd></div>
            <div><dt>{tr('Active days (UTC)')}</dt><dd>{tr.number(stats?.activeDays ?? 0)}</dd></div>
            <div><dt>{tr('Per active day')}</dt><dd>{stats?.activeDays ? tr.number(stats.total / stats.activeDays, { maximumFractionDigits: 1 }) : '—'}</dd></div></dl>
        </div>
      })}</div>
      <div className="effort-history-heading"><h4>{tr('Effort history')}</h4><label>{tr('Show')} <select value={filter ?? ''} onChange={event => setFilter(event.target.value ? event.target.value as EffortDimension : null)}>
        <option value="">{tr('All')}</option>{effortDimensions.map(item => <option key={item.dimension} value={item.dimension}>{tr(item.label)}</option>)}
      </select></label></div>
      <div className="effort-history-scroll" tabIndex={0} role="region" aria-label={tr('Effort history')}>
        {!report.entries.length && <p>{tr('No effort recorded yet.')}</p>}
        <ol className="effort-history-list">{report.entries.map(entry => {
          const kind = effortDimensions.find(item => item.dimension === entry.dimension)!
          return <li key={entry.id}><header><span><ToolbarIcon name={kind.icon} size={14} />{tr(kind.label)}</span><strong>+{tr.number(1)}</strong><time dateTime={entry.createdAt}>{tr.dateTime(new Date(entry.createdAt))}</time></header>
            {entry.sourceText ? <blockquote dir="auto">{entry.sourceText}</blockquote> : <small>{tr('Source history deleted; credit retained.')}</small>}
          </li>
        })}</ol>
        {report.next && <button className="btn" type="button" disabled={loading} onClick={() => void more()}>{tr(loading ? 'Loading…' : 'Load more')}</button>}
      </div>
    </>}
  </section>
}
