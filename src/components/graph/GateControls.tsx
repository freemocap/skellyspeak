import { useEffect } from 'react'
import { pausePipeline, resumePipeline, startGateTracking, stepPipeline, useGate } from '../../lib/gate'

/// Pause and step the agent pipeline.
///
/// These hold REAL work. Pausing stops the next operation before its model
/// call is made, so the conversation genuinely stops advancing and no tokens
/// are spent while it is held. That is the point — and it is why the paused
/// state is also shown outside this panel, in `PausedBanner`: a pipeline
/// someone paused and forgot must never look like an app that hung.
///
/// The gate cannot interrupt a response already arriving. Once a request is
/// away the bytes are the provider's to send, so a step releases an operation
/// *before* its call rather than between its tokens.
export function GateControls() {
  useEffect(startGateTracking, [])
  const status = useGate()
  const waiting = status.waiting.length

  return (
    <div className={`gate-bar ${status.paused ? 'paused' : ''}`}>
      <button
        type="button"
        className="gate-btn"
        onClick={status.paused ? resumePipeline : pausePipeline}
        title={
          status.paused
            ? 'Let everything run again'
            : 'Stop the next operation before it calls a model. The conversation really does stop.'
        }
      >
        {status.paused ? '▶ Resume' : '❚❚ Pause'}
      </button>
      <button
        type="button"
        className="gate-btn"
        onClick={() => stepPipeline(1)}
        title="Let exactly one operation through, then stop again"
      >
        ⤼ Step
      </button>

      {status.paused && (
        <span className="gate-state">
          paused
          {waiting > 0 ? (
            <>
              {' · '}
              <b>{waiting}</b> held: {status.waiting.map((h) => h.operation).join(', ')}
            </>
          ) : (
            ' · nothing running to hold'
          )}
          {status.budget > 0 && ` · ${status.budget} step(s) queued`}
        </span>
      )}
    </div>
  )
}
