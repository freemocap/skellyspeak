import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { InfoTip } from '../../../components/controls/InfoTip'
import { useI18n } from '../../../components/localization/i18n'
import { effortDimensions, type EffortField } from '../../../components/learning/effort-dimensions'
import type { EffortProgress } from '../../../generated/contracts'

/** Effort counts (Understood, Fixes, Practice, Bot, Explore) for `units`, each
 * in the colour of the place it comes from, with what earns one behind an info
 * tip. Effort counts what the learner did, one per action. */
export function EffortCounts({ effort, units, error }: { effort: EffortProgress | null; units: readonly EffortField[]; error: string | null }) {
  const tr = useI18n()
  return <>
    <ul className="effort-counts">{effortDimensions.filter(({ field }) => units.includes(field)).map(({ field, icon, label, description }) => {
      const value = effort ? tr.number(effort[field]) : '—'
      return <li key={field} data-unit={field}>
        <span className="effort-count" aria-label={`${tr(label)}: ${value}`}><ToolbarIcon name={icon} size={15} /><strong aria-hidden="true">{value}</strong><span aria-hidden="true">{tr(label)}</span></span>
        <InfoTip>{tr(description)}</InfoTip>
      </li>
    })}</ul>
    {error && <ErrorNotice error={error}>{error}</ErrorNotice>}
  </>
}
