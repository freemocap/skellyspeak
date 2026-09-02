import { useEffect, useMemo, useState } from 'react'
import { clearRuns, getRuns, subscribeRuns } from '../lib/tauri'
import type { Actor, Attempt, Run } from '../types'
import { actorColor, actorLabel } from '../lib/actor'

// The developer-facing rung of the observability ladder (bite 1). Every AI
// call in the app produces exactly one Run; this lists them grouped by the
// turn that fired them, so "what happened when I sent that message" is one
// glance instead of a log-file archaeology session.
//
// The learner-facing rungs — the 💭 agent bubbles and the progressive
// disclosure modal — are bites 4 and 5, and will render these same records.

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

function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false)
  const corrections = run.attempts.filter((a) => a.kind !== 'ok')
  const tokens = run.usage?.total_tokens ?? null

  return (
    <div className={`run-row ${run.outcome}`}>
      <button type="button" className="run-head" onClick={() => setOpen((o) => !o)}>
        <span className="run-caret">{open ? '▾' : '▸'}</span>
        <span className="run-label" style={{ color: actorColor(run.actor) }}>
          {run.label}
        </span>
        <span className="run-agent">{actorLabel(run.actor as Actor)}</span>
        <span className="run-time">
          {ms(run.duration_ms)}
          {run.first_token_ms !== null && (
            <span className="run-ttft"> (first token {ms(run.first_token_ms)})</span>
          )}
        </span>
        {tokens !== null && <span className="run-tokens">{tokens} tok</span>}
        {run.outcome === 'retried_then_ok' && (
          <span className="run-badge amber">
            recovered after {corrections.length}
          </span>
        )}
        {run.outcome === 'failed' && <span className="run-badge red">failed</span>}
      </button>
      {open && (
        <div className="run-detail">
          <div className="run-kv">
            <span>model</span>
            <code>{run.model}</code>
          </div>
          <div className="run-kv">
            <span>reasoning</span>
            <code>{run.reasoning ? 'on' : 'off'}</code>
          </div>
          {run.temperature !== null && (
            <div className="run-kv">
              <span>temperature</span>
              <code>{run.temperature}</code>
            </div>
          )}
          {run.schema && (
            <div className="run-kv">
              <span>schema</span>
              <code>{run.schema}</code>
            </div>
          )}
          {run.max_tokens !== null && (
            <div className="run-kv">
              <span>max tokens</span>
              <code>{run.max_tokens}</code>
            </div>
          )}
          {run.usage && (
            <div className="run-kv">
              <span>usage</span>
              <code>
                {run.usage.prompt_tokens ?? '?'} in / {run.usage.completion_tokens ?? '?'} out
                {run.usage.cost !== null && ` · $${run.usage.cost.toFixed(5)}`}
              </code>
            </div>
          )}
          {/* The attempt chain is the point: a retry is a story, not a counter. */}
          <div className="run-attempts">
            {run.attempts.map((a) => (
              <div key={a.index} className={`run-attempt ${a.kind}`}>
                <span className="run-attempt-n">#{a.index + 1}</span>
                <span className="run-attempt-kind">{attemptLabel(a)}</span>
                <span className="run-attempt-ms">{ms(a.duration_ms)}</span>
                {a.error && <span className="run-attempt-err">{a.error}</span>}
              </div>
            ))}
          </div>
          {run.error && <div className="run-error">{run.error}</div>}
        </div>
      )}
    </div>
  )
}

export function RunsView() {
  const [runs, setRuns] = useState<Run[]>([])

  useEffect(() => {
    void getRuns().then(setRuns)
    let unsub: (() => void) | null = null
    let alive = true
    void subscribeRuns((run) => setRuns((prev) => [...prev, run])).then((u) => {
      if (alive) unsub = u
      else u()
    })
    return () => {
      alive = false
      unsub?.()
    }
  }, [])

  // Newest turn first; runs within a turn in the order they finished.
  const groups = useMemo(() => {
    const byTurn = new Map<number | null, Run[]>()
    for (const r of runs) {
      const list = byTurn.get(r.turn_id)
      if (list) list.push(r)
      else byTurn.set(r.turn_id, [r])
    }
    return [...byTurn.entries()].sort((a, b) => {
      const at = a[1][a[1].length - 1].started_at_ms
      const bt = b[1][b[1].length - 1].started_at_ms
      return bt - at
    })
  }, [runs])

  const total = runs.length
  const failed = runs.filter((r) => r.outcome === 'failed').length
  const recovered = runs.filter((r) => r.outcome === 'retried_then_ok').length

  return (
    <div className="runs-view">
      <div className="runs-head">
        <span>
          {total} run{total === 1 ? '' : 's'}
          {recovered > 0 && ` · ${recovered} recovered`}
          {failed > 0 && ` · ${failed} failed`}
        </span>
        <button
          type="button"
          className="logs-clear"
          onClick={() => {
            void clearRuns().then(() => setRuns([]))
          }}
        >
          clear
        </button>
      </div>
      <div className="runs-body">
        {total === 0 && <div className="logs-line">— no runs yet —</div>}
        {groups.map(([turnId, turnRuns]) => {
          const wall = Math.max(...turnRuns.map((r) => r.duration_ms))
          return (
            <div key={turnId ?? 'standalone'} className="run-group">
              <div className="run-group-head">
                {turnId === null ? 'standalone' : `turn ${turnId}`}
                <span className="run-group-meta">
                  {turnRuns.length} call{turnRuns.length === 1 ? '' : 's'} · slowest {ms(wall)}
                </span>
              </div>
              {turnRuns.map((r) => (
                <RunRow key={r.id} run={r} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
