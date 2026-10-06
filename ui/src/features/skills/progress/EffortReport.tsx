import { useState } from 'react'
import type { EffortDimension } from '../../../generated/contracts'
import { useEffortReport } from '../../../state/learning/useEffortReport'
import { effortDimensions } from '../../../components/learning/effort-dimensions'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useI18n } from '../../../components/localization/i18n'
import { InfoTip } from '../../../components/controls/InfoTip'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { LanguageTable } from '../../../components/learning/LanguageTable'
import { useVisibleEffort } from '../../../state/learning/EffortProgressContext'
import { useLanguageTotals } from '../../../state/learning/useLanguageTotals'
import { useSettingsStore } from '../../../state/settings/settings'
import { openLanguageProgress } from '../../../state/navigation/language-progress'

/** The Progress page's Effort tab: every language's XP and effort side by
 * side, then this language's lifetime effort counts (Understood, Fixes,
 * Practice, Bot, Explore), each card in its own colour with what earns one
 * behind an info tip, and the effort history. */
export function EffortReport({ target, languageName, revision }: { target: string; languageName: string; revision: unknown }) {
  const tr = useI18n()
  const [filter, setFilter] = useState<EffortDimension | null>(null)
  const { report, error, loading, more } = useEffortReport(target, filter, revision)
  const effort = useVisibleEffort()
  const included = useSettingsStore(state => state.settings?.my_languages)
  const totals = useLanguageTotals(revision, effort.value, included)
  return <section className="effort-report" aria-labelledby="effort-report-title">
    <section className="effort-languages" aria-labelledby="effort-languages-title">
      <h2 className="effort-report-title" id="effort-languages-title">{tr('All languages')}<InfoTip>{tr('Each language keeps its own XP and effort; the globe total is the sum of their XP.')}</InfoTip></h2>
      {totals.error && <ErrorNotice error={totals.error}>{totals.error}</ErrorNotice>}
      {totals.rows ? <LanguageTable rows={totals.rows} active={target} compact={false} onSelect={language => void openLanguageProgress(language, 'effort')} /> : !totals.error && <p role="status">{tr('Loading…')}</p>}
    </section>
    <h2 className="effort-report-title" id="effort-report-title">{tr('{value0} effort', { value0: languageName })}<InfoTip>{tr('Effort counts what you did, one count each. These counts are kept apart from the XP number. Earned counts remain when source history is deleted.')}</InfoTip></h2>
    {error && <ErrorNotice error={error}>{error}</ErrorNotice>}
    {!report ? loading && <p role="status">{tr('Loading…')}</p> : <>
      <div className="effort-stat-cards">{effortDimensions.map(({ field, dimension, label, icon, description }) => {
        const stats = report.activity.find(item => item.dimension === dimension)
        return <div className="effort-stat-card" key={dimension} data-unit={field}>
          <header><span className="effort-stat-icon" aria-hidden="true"><ToolbarIcon name={icon} size={18} /></span><h3>{tr(label)}</h3><InfoTip>{tr(description)}</InfoTip></header>
          <strong className="effort-stat-total">{tr.number(stats?.total ?? 0)}</strong>
          <span className="effort-stat-week">{tr('+{value0} in the last 7 days', { value0: tr.number(stats?.lastSevenDays ?? 0) })}</span>
          <dl><div><dt>{tr('Active days (UTC)')}</dt><dd>{tr.number(stats?.activeDays ?? 0)}</dd></div>
            <div><dt>{tr('Per active day')}</dt><dd>{stats?.activeDays ? tr.number(stats.total / stats.activeDays, { maximumFractionDigits: 1 }) : '—'}</dd></div></dl>
        </div>
      })}</div>
      <section className="effort-history" aria-labelledby="effort-history-title">
      <div className="effort-history-heading"><h3 id="effort-history-title">{tr('Effort history')}</h3><label>{tr('Show')} <select value={filter ?? ''} onChange={event => setFilter(event.target.value ? event.target.value as EffortDimension : null)}>
        <option value="">{tr('All')}</option>{effortDimensions.map(item => <option key={item.dimension} value={item.dimension}>{tr(item.label)}</option>)}
      </select></label></div>
      <div className="effort-history-scroll" tabIndex={0} role="region" aria-label={tr('Effort history')}>
        {!report.entries.length && <p>{tr('No effort recorded yet.')}</p>}
        <ol className="effort-history-list">{report.entries.map(entry => {
          const kind = effortDimensions.find(item => item.dimension === entry.dimension)!
          return <li key={entry.id} data-unit={kind.field}><header><span className="effort-history-kind"><ToolbarIcon name={kind.icon} size={14} />{tr(kind.label)}</span><strong>+{tr.number(1)}</strong><time dateTime={entry.createdAt}>{tr.dateTime(new Date(entry.createdAt))}</time></header>
            {entry.sourceText ? <blockquote dir="auto">{entry.sourceText}</blockquote> : ['explorations', 'bot'].includes(entry.dimension) ? null : <small>{tr('Source history deleted; credit retained.')}</small>}
          </li>
        })}</ol>
        {report.next && <button className="btn" type="button" disabled={loading} onClick={() => void more()}>{tr(loading ? 'Loading…' : 'Load more')}</button>}
      </div>
      </section>
    </>}
  </section>
}
