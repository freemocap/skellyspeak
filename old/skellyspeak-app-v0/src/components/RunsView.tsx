import type { Run } from '../types'
import { RunDetails } from './dev/RunDetails'
import type { Activity } from './dev/activity'

export function RunsView({ runs, active, graphs }: Pick<Activity, 'runs' | 'active' | 'graphs'>) {
  const label = (run: Pick<Run, 'operation' | 'label'>): string => graphs.flatMap((graph) => graph.nodes).find((node) => node.operation === run.operation)?.label ?? run.label
  const purpose = (operation: string): string => graphs.flatMap((graph) => graph.nodes).find((node) => node.operation === operation)?.purpose ?? operation
  return <div className="activity-steps">
    {active.map((run) => <article key={run.id} className="activity-step"><strong>{label(run)} · Running</strong><p>{purpose(run.operation)}</p></article>)}
    {runs.map((run: Run) => <details key={run.id} className={`activity-step ${run.outcome}`}>
      <summary><strong>{label(run)}</strong><span>{run.outcome === 'failed' ? 'Failed' : run.outcome === 'retried_then_ok' ? 'Completed after retry' : 'Completed'} · {(run.duration_ms / 1000).toFixed(1)}s</span></summary>
      <p>{purpose(run.operation)}</p>
      <RunDetails run={run} />
    </details>)}
    {runs.length === 0 && active.length === 0 && <p>No recorded steps for this selection.</p>}
  </div>
}
