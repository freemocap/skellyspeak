import type { EffortActivity } from '../../generated/contracts'
import { effortDimensions } from './effort-dimensions'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { useI18n } from '../localization/i18n'

/** Compact descriptive activity statistics, independent of the history list. */
export function EffortStats({ activity }: { activity: EffortActivity[] }) {
  const tr = useI18n()
  return <table className="effort-mini-stats"><caption>{tr('Lifetime effort')}</caption>
    <thead><tr><th scope="col">{tr('Effort')}</th><th scope="col">{tr('Last 7 days')}</th><th scope="col">{tr('Active days (UTC)')}</th></tr></thead>
    <tbody>{effortDimensions.map(({ dimension, icon, label }) => {
      const item = activity.find(row => row.dimension === dimension)
      return <tr key={dimension}><th scope="row"><span><ToolbarIcon name={icon} size={14} />{tr(label)}</span></th><td>{tr.number(item?.lastSevenDays ?? 0)}</td><td>{tr.number(item?.activeDays ?? 0)}</td></tr>
    })}</tbody>
  </table>
}
