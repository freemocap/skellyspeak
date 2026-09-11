import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import '@xyflow/react/dist/style.css'
import {
  getGraph,
  getReconciliation,
} from '../../lib/tauri'
import { useIsMobile } from '../../hooks/useIsMobile'
import { openOverlay } from '../../lib/back'
import { GraphPane } from './GraphPane'
import { NodeInspector } from './NodeInspector'
import { useDragSize } from '../../lib/useDragSize'
import type { Graph, GraphNode, Reconciliation, Run, RunStarted } from '../../types'
import { reportFault } from '../../lib/faults'

// Explore shows one automatically arranged pipeline for the selected activity.
// Debug retains a configurable comparison workspace. Rust declares the graphs.

const OPEN_KEY = 'skellyspeak_graph_open'
const WIDE_KEY = 'skellyspeak_graph_wide'
// Which pane fills the view. Persisted like the others so a deliberate choice
// survives, with `null` meaning "show them tiled".
const MAX_KEY = 'skellyspeak_graph_max'

/// Nothing stored yet is normal and yields `whenUnset`. Stored-but-unreadable
/// is a fault: it is reported, not quietly swapped for a default.
function loadIds(key: string, whenUnset: string[]): string[] {
  const raw = localStorage.getItem(key)
  if (raw === null) return whenUnset
  try {
    return JSON.parse(raw) as string[]
  } catch (e) {
    reportFault('Restoring graph layout', e)
    return whenUnset
  }
}

function save(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch (e) {
    reportFault('Saving graph layout', e)
  }
}

export function AgentGraph({ runs, activeRuns, mode }: { runs: Run[]; activeRuns: RunStarted[]; mode: 'explore' | 'debug' }) {
  const mobile = useIsMobile()
  const [graphs, setGraphs] = useState<Graph[]>([])
  const interaction = runs[0]?.turn_id ?? (runs[0] ? `call:${runs[0].id}` : activeRuns[0]?.turn_id ?? null)
  const operation = runs[0]?.operation ?? activeRuns[0]?.operation
  const active = useMemo(() => new Set(activeRuns.map((run) => run.operation)), [activeRuns])
  const [error, setError] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState('turn')
  const [recon, setRecon] = useState<Reconciliation | null>(null)
  const [openIds, setOpenIds] = useState<string[]>([])
  const [wideIds, setWideIds] = useState<string[]>([])
  const [pickedNode, setPickedNode] = useState<string | null>(null)
  const detailOpen = pickedNode !== null
  const [pickedRunId, setPickedRunId] = useState<number | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  // One pane fills the whole area — VS Code's "maximize editor group".
  // '' is stored for a deliberate "tiled", which is why absence is tested
  // against null below rather than falsiness.
  const [maxId, setMaxId] = useState<string | null>(
    () => localStorage.getItem(MAX_KEY) || null
  )

  // Every boundary in this view is draggable.
  const inspector = useDragSize('skellyspeak_graph_inspector_w', 330, {
    axis: 'x',
    min: 220,
    max: 900,
    invert: true, // dragging LEFT widens it
  })
  const paneH = useDragSize('skellyspeak_graph_pane_h', 380, { axis: 'y', min: 200, max: 1400 })
  const colSplit = useDragSize('skellyspeak_graph_col', 50, { axis: 'x', min: 20, max: 80 })

  useEffect(() => {
    void getGraph().then((gs) => {
      setGraphs(gs)
      // Default: the turn pipeline only. The rest are one click away.
      setOpenIds(loadIds(OPEN_KEY, gs.length ? [gs[0].id] : []))
      setWideIds(loadIds(WIDE_KEY, []))
      // One turn of conversation, filling the view, on first open. That is the
      // pipeline anyone opening this came to look at; a tiled row of small
      // panes made the interesting one no bigger than the rest. Only when
      // nothing was ever chosen — a stored '' means tiled on purpose.
      if (localStorage.getItem(MAX_KEY) === null && gs.length > 0) {
        setMaxId(gs[0].id)
      }
    }).catch((e: unknown) => setError(String(e)))
    void getReconciliation().then(setRecon).catch((e: unknown) => setError(String(e)))
  }, [])

  useEffect(() => { void getReconciliation().then(setRecon).catch((e: unknown) => setError(String(e))) }, [runs])
  useEffect(() => {
    if (mode !== 'explore' || !operation) return
    const match = graphs.find((graph) => graph.nodes.some((node) => node.operation === operation))
    if (match) setPipeline(match.id)
  }, [interaction, graphs, mode, operation])
  useEffect(() => {
    if (!mobile || !detailOpen) return
    return openOverlay(() => { setPickedNode(null); setPickedRunId(null) })
  }, [mobile, detailOpen])
  const onPick = useCallback((node: GraphNode, run: Run | null) => {
    setPickedNode(node.id)
    setPickedRunId(run?.id ?? null)
  }, [])

  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      save(OPEN_KEY, next)
      return next
    })
  }, [])

  const toggleWide = useCallback((id: string) => {
    setWideIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      save(WIDE_KEY, next)
      return next
    })
  }, [])

  // Drag a pane header onto another pane to reorder.
  const dropOn = useCallback(
    (targetId: string) => {
      setOpenIds((prev) => {
        if (!dragId || dragId === targetId) return prev
        const without = prev.filter((x) => x !== dragId)
        const at = without.indexOf(targetId)
        const next = [...without.slice(0, at), dragId, ...without.slice(at)]
        save(OPEN_KEY, next)
        return next
      })
      setDragId(null)
    },
    [dragId]
  )

  // Latest run per operation — the graph shows current state, the inspector
  // list shows history.
  const latest = useMemo(() => {
    const m = new Map<string, Run>()
    for (const r of runs) m.set(r.operation, r)
    return m
  }, [runs])

  const openGraphs = useMemo(
    () =>
      openIds
        .map((id) => graphs.find((g) => g.id === id))
        .filter((g): g is Graph => g !== undefined),
    [openIds, graphs]
  )

  // A specific run wins (clicked in the list); otherwise the node's latest.
  const inspected = useMemo(() => {
    const node = graphs.flatMap((g) => g.nodes).find((n) => n.id === pickedNode) ?? null
    const run =
      (pickedRunId !== null ? runs.find((r) => r.id === pickedRunId) : undefined) ??
      (node?.operation ? latest.get(node.operation) : undefined) ??
      null
    return { node, run }
  }, [graphs, pickedNode, pickedRunId, runs, latest])

  if (error) return <p role="alert" className="activity-error">{error}</p>
  if (graphs.length === 0) return <div className="logs-line">— loading graph —</div>

  return (
    <div className={`graph-view ${mode === 'explore' ? 'graph-explore' : ''}`} onTouchStart={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
      {mode === 'explore' ? <div className="pipeline-picker"><label>Pipeline <select value={pipeline} onChange={(event) => { setPipeline(event.target.value); setPickedNode(null); setPickedRunId(null) }}>
        {graphs.map((graph) => <option key={graph.id} value={graph.id}>{graph.label}</option>)}
      </select></label><span>Drag to explore · select a node</span><details className="pipeline-about"><summary>About this pipeline</summary><div><p>{graphs.find((graph) => graph.id === pipeline)?.description}</p><p>Inputs: {graphs.find((graph) => graph.id === pipeline)?.shared_state.join(', ')}</p></div></details></div> : <div className="graph-tabs">
        {graphs.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`graph-pick ${openIds.includes(g.id) ? 'active' : ''}`}
            onClick={() => { toggleOpen(g.id); setMaxId(null); localStorage.setItem(MAX_KEY, '') }}
            title={openIds.includes(g.id) ? 'Close this pipeline' : 'Open this pipeline'}
          >
            {openIds.includes(g.id) ? '●' : '○'} {g.label}
          </button>
        ))}
      </div>}

      {mode === 'explore' && <div className="activity-ribbon" aria-label="Calls in selected activity">
        {[...runs, ...activeRuns].sort((a, b) => a.started_at_ms - b.started_at_ms || a.id - b.id).map((call) => {
          const graph = graphs.find((item) => item.nodes.some((node) => node.operation === call.operation))
          const node = graph?.nodes.find((item) => item.operation === call.operation)
          const run = runs.find((item) => item.id === call.id) ?? null
          return <button key={call.id} type="button" aria-pressed={node?.id === pickedNode && (run ? inspected.run?.id === run.id : pickedRunId === null)} className={`activity-call ${run?.outcome ?? 'running'}`} onClick={() => {
            if (!graph || !node) throw new Error(`No declared graph for ${call.operation}`)
            setPipeline(graph.id)
            onPick(node, run)
          }} title={`${call.label} · ${call.model}`}>
            <span className="call-indicator" />
            <strong>{node?.label ?? call.label}</strong>
            <span>{run?.length_checks.some((check) => check.status === 'violation') && '⚠ Length · '}{run ? `${(run.duration_ms / 1000).toFixed(1)}s${run.outcome === 'failed' ? ' · failed' : run.outcome === 'retried_then_ok' ? ' · retried' : ''}` : 'running'}</span>
            <small>{call.model}</small>
          </button>
        })}
        {!runs.length && !activeRuns.length && <span className="activity-empty">Send a message to watch these connections come alive. Every node is already explorable.</span>}
      </div>}

      <div className="graph-body" onKeyDown={(event) => { if (event.key === 'Escape') { setPickedNode(null); setPickedRunId(null) } }}>
        <div
          className={`gpanes ${mode === 'explore' || maxId ? 'maximized' : ''}`}
          style={
            mode === 'explore' || maxId
              ? undefined
              : {
                  '--graph-columns': `${colSplit.size}fr ${100 - colSplit.size}fr`,
                  gridAutoRows: `${paneH.size}px`,
                } as CSSProperties
          }
        >
          {mode === 'debug' && openGraphs.length === 0 && (
            <div className="logs-line" style={{ padding: 16 }}>
              — no pipelines open; pick one above —
            </div>
          )}
          {(mode === 'explore' ? graphs.filter((g) => g.id === pipeline) : maxId ? openGraphs.filter((g) => g.id === maxId) : openGraphs).map((g) => (
            <GraphPane
              key={g.id}
              graph={g}
              mode={mode}
              latest={latest}
              selectedNode={pickedNode}
              active={active}
              recon={mode === 'debug' ? recon : null}
              wide={wideIds.includes(g.id)}
              maximized={mode === 'explore' || maxId === g.id}
              onPick={onPick}
              onToggleWide={() => toggleWide(g.id)}
              onToggleMax={() =>
                setMaxId((m) => {
                  const next = m === g.id ? null : g.id
                  localStorage.setItem(MAX_KEY, next ?? '')
                  return next
                })
              }
              onClose={() => toggleOpen(g.id)}
              onDragStart={() => setDragId(g.id)}
              onDropOn={() => dropOn(g.id)}
              onResizeHeight={mode === 'explore' || maxId ? undefined : paneH.onPointerDown}
            />
          ))}
          {/* Splitter between the two pane columns. */}
          {mode === 'debug' && !maxId && openGraphs.length > 1 && (
            <div
              className="gcol-split"
              style={{ left: `${colSplit.size}%` }}
              onPointerDown={colSplit.onPointerDown}
              role="separator"
              aria-label="Resize columns"
            />
          )}
        </div>
        {pickedNode && <>
        <button autoFocus className="ins-close" type="button" onClick={() => { setPickedNode(null); setPickedRunId(null) }}>Close details</button>
        <div
          className="ins-split"
          onPointerDown={inspector.onPointerDown}
          role="separator"
          aria-label="Resize inspector"
        />
        <NodeInspector
          width={inspector.size}
          node={inspected.node}
          run={inspected.run}
          runs={runs}
          activeOps={active}
          onPickRun={(r) => {
            setPickedRunId(r.id)
            const node = graphs.flatMap((graph) => graph.nodes).find((item) => item.operation === r.operation)
            if (!node) throw new Error(`No declared node for ${r.operation}`)
            setPickedNode(node.id)
          }}
        />
        </>}
      </div>

      {/* The picture reporting on its own truthfulness. A diagram that
          cannot tell you when it is wrong is a claim, not an observation. */}
      {mode === 'debug' && recon && (
        <div className={`graph-fidelity ${recon.consistent ? 'ok' : 'bad'}`}>
          {recon.consistent ? (
            <span>
              App-session check: ✓ consistent with {recon.turns_observed} observed turn
              {recon.turns_observed === 1 ? '' : 's'}
              {recon.unobserved_operations.length > 0 &&
                ` · ${recon.unobserved_operations.length} declared but not yet exercised`}
            </span>
          ) : (
            <span>
              ✕ the declaration disagrees with what ran
              {recon.undeclared_operations.length > 0 &&
                ` · undeclared: ${recon.undeclared_operations.join(', ')}`}
              {recon.edges
                .filter((e) => e.verdict === 'contradicted')
                .map((e) => ` · ${e.detail ?? `${e.from}→${e.to}`}`)}
            </span>
          )}
        </div>
      )}
      {mode === 'debug' && <div className="graph-foot">
        <div className="graph-legend">
          <span className="lg hydrate" title="Each of these appears the moment it is ready.">
            hydrate — shows up the moment it is ready
          </span>
          <span
            className="lg fan_in"
            title="analysis_done merges the finished sections into one authoritative state. You have already seen each one arrive, so this step never makes you wait."
          >
            reconcile — merges the results, never makes you wait
          </span>
          <span className="lg conditional" title="Only runs when the turn calls for it.">
            conditional — only when needed
          </span>
          <span className="lg background" title="Runs after the reply, out of your way.">
            background — after the reply
          </span>
        </div>
      </div>}
    </div>
  )
}
