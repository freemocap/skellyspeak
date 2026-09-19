import { useEffect, useRef, useState } from 'react'
import type { TurnActivity } from '../../../domain/conversation/activity-summary'
import { ActivitySummary } from '../../../components/feedback/ActivitySummary'

const LINGER_MS = 3000

/// The live summary under a turn whose follow-on AI work is still going. It
/// stays briefly after the work settles so the finish is seen, then leaves.
export function TurnActivityLine({ activity, onActivity }: { activity: TurnActivity; onActivity?: () => void }) {
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
  if (activity.settled && !lingering) return null
  return <div className="turn-activity" role="status" data-settled={activity.settled || undefined}>
    {onActivity ? <button type="button" className="turn-activity-open" onClick={onActivity}><ActivitySummary activity={activity} /></button>
      : <ActivitySummary activity={activity} />}
  </div>
}
