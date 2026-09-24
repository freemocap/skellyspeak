import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { turnActivity, type TurnActivity } from '../../../domain/conversation/activity-summary'
import type { TurnView } from '../../../generated/contracts'
import { useReplyStream } from '../../../state/session/attempt-streams'
import { ActivitySummary } from '../../../components/feedback/ActivitySummary'

const LINGER_MS = 3000

/// The newest exchange's follow-on AI work, shown in the composer's fixed status
/// line rather than under the message, so its coming and going moves nothing.
export function LatestTurnActivity({ execution, onActivity, fallback }: { execution: TurnView; onActivity?: () => void; fallback: ReactNode }) {
  const stream = useReplyStream(execution)
  const activity = useMemo(() => turnActivity(execution, stream?.text ?? null), [execution, stream])
  return <TurnActivityLine activity={activity} onActivity={onActivity} fallback={fallback} />
}

/// The live summary of a turn whose follow-on AI work is still going. It stays
/// briefly after the work settles so the finish is seen, then gives way to
/// `fallback`.
export function TurnActivityLine({ activity, onActivity, fallback = null }: { activity: TurnActivity; onActivity?: () => void; fallback?: ReactNode }) {
  const [lingering, setLingering] = useState(false)
  const wasBusy = useRef(!activity.settled)
  useEffect(() => {
    if (!activity.settled) { wasBusy.current = true; setLingering(false); return }
    if (!wasBusy.current) return
    wasBusy.current = false
    setLingering(true)
    const timer = setTimeout(() => setLingering(false), LINGER_MS)
    return () => clearTimeout(timer)
  }, [activity.settled])
  if (activity.settled && !lingering) return <>{fallback}</>
  return <div className="turn-activity" role="status" data-settled={activity.settled || undefined}>
    {onActivity ? <button type="button" className="turn-activity-open" onClick={onActivity}><ActivitySummary activity={activity} /></button>
      : <ActivitySummary activity={activity} />}
  </div>
}
