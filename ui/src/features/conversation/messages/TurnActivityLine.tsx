import type { ReactNode } from 'react'
import { turnActivity, type TurnActivity } from '../../../domain/conversation/activity-summary'
import type { TurnView } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'

/// The newest exchange's follow-on AI work, shown in the composer's fixed status
/// line rather than under the message, so its coming and going moves nothing.
export function LatestTurnActivity({ execution, onActivity, fallback }: { execution: TurnView; onActivity?: () => void; fallback: ReactNode }) {
  const activity = turnActivity(execution)
  return <TurnActivityLine activity={activity} onActivity={onActivity} fallback={fallback} />
}

/// Background work does not imply that the learner must wait. Completed work
/// clears immediately; failures remain discoverable through the activity link.
export function TurnActivityLine({ activity, onActivity, fallback = null }: { activity: TurnActivity; onActivity?: () => void; fallback?: ReactNode }) {
  const tr = useI18n()
  if (!activity.failed && !activity.held) return <>{fallback}</>
  const label = activity.failed ? tr('Activity failed', { count: activity.failed })
    : tr('Held')
  return <div className="turn-activity" role="status">
    {onActivity ? <button type="button" className="turn-activity-open" onClick={onActivity} title={tr('Open AI activity')}>{label}</button>
      : label}
  </div>
}
