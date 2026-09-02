import { useState } from 'react'
import { actorColor, actorLabel } from '../../lib/actor'
import type { Attempt, GraphNode, Run } from '../../types'

// The inspector sits BESIDE the graph, not behind a tab. Switching back and
// forth between "the shape" and "what happened" makes it much harder to hold
// the turn in your head, so both are on screen at once: the run list is the
// timeline, the graph is the map, and selecting in either drives the other.

function ms(n: number): string {
  return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`
}

function attemptLabel(a: Attempt): string {
  switch (a.kind) {
    case 'rate_limited':
      return 'rate limited'
    case 'unparseable':
      return 'unparseable JSON'
    case 'invalid':
      return 'failed validation'
    case 'failed':
      return 'request failed'
    default:
      return 'ok'
  }
}

function Section({
  title,
  body,
  defaultOpen = false,
}: {
  title: string
  body: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="ins-section">
      <button type="button" className="ins-section-head" onClick={() => setOpen((o) => !o)}>
        <span className="ins-caret">{open ? '▾' : '▸'}</span>
        {title}
        <span className="ins-len">{body.length.toLocaleString()} chars</span>
      </button>
      {open && <pre className="ins-pre">{body}</pre>}
    </div>
  )
}

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
            <>
              <div className="ins-grid">
                <span>actor</span>
                <code>{actorLabel(run.actor)}</code>
                <span>model</span>
                <code>{run.model}</code>
                <span>reasoning</span>
                <code>{run.reasoning ? 'on' : 'off'}</code>
                {run.temperature !== null && (
                  <>
                    <span>temperature</span>
                    <code>{run.temperature}</code>
                  </>
                )}
                {run.schema && (
                  <>
                    <span>schema</span>
                    <code>{run.schema}</code>
                  </>
                )}
                <span>duration</span>
                <code>
                  {ms(run.duration_ms)}
                  {run.first_token_ms !== null &&
                    ` · first token ${ms(run.first_token_ms)}`}
                </code>
                {run.usage && (
                  <>
                    <span>usage</span>
                    <code>
                      {run.usage.prompt_tokens ?? '?'} in / {run.usage.completion_tokens ?? '?'} out
                      {run.usage.cost !== null && ` · $${run.usage.cost.toFixed(5)}`}
                    </code>
                  </>
                )}
                <span>outcome</span>
                <code className={`ins-outcome ${run.outcome}`}>{run.outcome}</code>
              </div>

              <div className="ins-attempts">
                {run.attempts.map((a) => (
                  <div key={a.index} className={`run-attempt ${a.kind}`}>
                    <span className="run-attempt-n">#{a.index + 1}</span>
                    <span className="run-attempt-kind">{attemptLabel(a)}</span>
                    <span className="run-attempt-ms">{ms(a.duration_ms)}</span>
                    {a.error && <span className="run-attempt-err">{a.error}</span>}
                  </div>
                ))}
              </div>

              {/* The actual content — what it was asked, and what came back. */}
              {run.prompt && <Section title="what it was asked" body={run.prompt} />}
              {run.output && <Section title="what came back" body={run.output} defaultOpen />}
              {run.error && <div className="run-error">{run.error}</div>}
            </>
          ) : (
            <p className="ins-purpose muted">
              {node.operation
                ? 'Has not run yet this session.'
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

      <div className="ins-runs-head">recent runs</div>
      <div className="ins-runs">
        {recent.length === 0 && <div className="logs-line">— nothing yet —</div>}
        {recent.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`ins-run ${r.outcome} ${run?.id === r.id ? 'sel' : ''} ${
              activeOps.has(r.operation) ? 'live' : ''
            }`}
            onClick={() => onPickRun(r)}
          >
            <span className="ins-run-turn">{r.turn_id ?? '—'}</span>
            <span className="ins-run-op" style={{ color: actorColor(r.actor) }}>
              {r.label}
            </span>
            <span className="ins-run-ms">{ms(r.duration_ms)}</span>
            {r.attempts.length > 1 && (
              <span className="ins-run-retry">×{r.attempts.length}</span>
            )}
          </button>
        ))}
      </div>
    </aside>
  )
}
