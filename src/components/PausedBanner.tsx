import { useEffect } from 'react'
import { resumePipeline, startGateTracking, useGate } from '../lib/gate'

/// Says so, everywhere, when the pipeline is paused.
///
/// Pausing really does stop the conversation — that is what makes the control
/// worth having. It is also what makes this banner necessary: someone who
/// pauses in the graph view, closes the panel and comes back to a chat that
/// will not reply has an app that looks broken, and the only difference
/// between broken and paused is whether anything tells them. So the state
/// lives at the top of the whole app, not inside the panel that set it, and
/// carries its own way out.
///
/// Reads the same store the controls write to, so the two can never disagree
/// about whether the pipeline is running.
export function PausedBanner() {
  useEffect(startGateTracking, [])
  const status = useGate()

  if (!status.paused) return null
  const held = status.waiting

  return (
    <div className="paused-banner" role="status">
      <span className="paused-dot" aria-hidden="true" />
      <span>
        <b>Pipeline paused.</b>{' '}
        {held.length > 0
          ? `${held.length} operation${held.length === 1 ? '' : 's'} held: ${held
              .map((h) => h.operation)
              .join(', ')}`
          : 'The next model call will stop here.'}
      </span>
      <button type="button" className="paused-resume" onClick={resumePipeline}>
        Resume
      </button>
    </div>
  )
}
