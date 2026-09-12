import { RunDetails } from '../dev/RunDetails'
import { actorColor } from '../../lib/actor'
import type { GraphNode, Run } from '../../types'

// The inspector sits BESIDE the graph, not behind a tab. Switching back and
// forth between "the shape" and "what happened" makes it much harder to hold
// the turn in your head, so both are on screen at once: the run list is the
// timeline, the graph is the map, and selecting in either drives the other.

export function NodeInspector({
  width,
  node,
  run,
  runs,
  activeOps,
  onPickRun,
}: {
  width: number
  node: GraphNode | null
  run: Run | null
  runs: Run[]
  activeOps: Set<string>
  onPickRun: (r: Run) => void
}) {
  // Newest first — the thing you just watched happen is at the top.
  const recent = [...runs].reverse().slice(0, 40)

  return (
    <aside className="graph-inspector" style={{ width }}>
      {node ? (
        <>
          <div className="ins-head">
            <strong style={{ color: run ? actorColor(run.actor) : 'var(--ink-d)' }}>
              {node.label}
            </strong>
            <span className="ins-kind">{node.kind.replace('_', ' ')}</span>
          </div>
          <p className="ins-purpose">{node.purpose}</p>

          {run ? (
            <RunDetails run={run} />
          ) : (
            <p className="ins-purpose muted">
              {node.operation
                ? 'No completed run recorded for the selected activity.'
                : 'Not an operation — it marks where work enters or lands.'}
            </p>
          )}
        </>
      ) : (
        <p className="ins-purpose muted">
          Pick a node on the graph, or a run below, to see what it was asked
          and what came back.
        </p>
      )}

      <div className="ins-runs-head">selected activity</div>
      <div className="ins-runs">
        {recent.length === 0 && <div className="logs-line">— nothing yet —</div>}
        {recent.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={run?.id === r.id}
            className={`ins-run ${r.outcome} ${run?.id === r.id ? 'sel' : ''} ${
              activeOps.has(r.operation) ? 'live' : ''
            }`}
            onClick={() => onPickRun(r)}
          >
            <span className="ins-run-turn">{r.turn_id ?? '—'}</span>
            <span className="ins-run-op" style={{ color: actorColor(r.actor) }}>
              {r.label}
            </span>
            <span className="ins-run-ms">{(r.duration_ms / 1000).toFixed(1)}s</span>
            {r.attempts.length > 1 && (
              <span className="ins-run-retry">×{r.attempts.length}</span>
            )}
          </button>
        ))}
      </div>
    </aside>
  )
}
