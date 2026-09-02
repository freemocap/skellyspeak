import { useCallback, useEffect, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'
import {
  getGraph,
  getReconciliation,
  getRuns,
  subscribeRunStarts,
  subscribeRuns,
} from '../../lib/tauri'
import { logDebug } from '../../lib/log'
import { GraphPane } from './GraphPane'
import { NodeInspector } from './NodeInspector'
import { useDragSize } from '../../lib/useDragSize'
import type { Graph, GraphNode, Reconciliation, Run } from '../../types'
import { reportFault } from '../../lib/faults'

// D2 of the disclosure ladder: the live system, rendered from the graph Rust
// declares. The frontend holds NO graph of its own.
//
// Panes, not tabs. Every pipeline can be open at once, each closable,
// widenable and reorderable by dragging its header — comparing "what a turn
// does" against "what asking the coach does" is impossible if you can only
// see one at a time. The inspector is shared: one selection, whichever pane
// it came from.

const OPEN_KEY = 'skellyspeak_graph_open'
const WIDE_KEY = 'skellyspeak_graph_wide'

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

export function AgentGraph() {
  const [graphs, setGraphs] = useState<Graph[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [active, setActive] = useState<Set<string>>(new Set())
  const [recon, setRecon] = useState<Reconciliation | null>(null)
  const [openIds, setOpenIds] = useState<string[]>([])
  const [wideIds, setWideIds] = useState<string[]>([])
  const [pickedNode, setPickedNode] = useState<string | null>(null)
  const [pickedRunId, setPickedRunId] = useState<number | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  // One pane fills the whole area — VS Code's "maximize editor group".
  const [maxId, setMaxId] = useState<string | null>(null)

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
    })
    void getRuns().then(setRuns)
    void getReconciliation().then(setRecon)

    const unsubs: (() => void)[] = []
    let alive = true
    const keep = (u: () => void) => (alive ? unsubs.push(u) : u())

    void subscribeRunStarts((start) => {
      // The completion bus proves itself via the run list; the START channel
      // otherwise leaves no trace at all, so a failure there would look
      // exactly like "nothing is running".
      logDebug(`[trace] started: ${start.operation} (${start.model})`)
      setActive((prev) => new Set(prev).add(start.operation))
    }).then(keep)

    void subscribeRuns((run) => {
      setRuns((prev) => [...prev, run])
      setActive((prev) => {
        const next = new Set(prev)
        next.delete(run.operation)
        return next
      })
      void getReconciliation().then(setRecon)
    }).then(keep)

    return () => {
      alive = false
      unsubs.forEach((u) => u())
    }
  }, [])

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

  if (graphs.length === 0) return <div className="logs-line">— loading graph —</div>

  return (
    <div className="graph-view">
      <div className="graph-tabs">
        {graphs.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`graph-pick ${openIds.includes(g.id) ? 'active' : ''}`}
            onClick={() => toggleOpen(g.id)}
            title={openIds.includes(g.id) ? 'Close this pipeline' : 'Open this pipeline'}
          >
            {openIds.includes(g.id) ? '●' : '○'} {g.label}
          </button>
        ))}
      </div>

      <div className="graph-body">
        <div
          className={`gpanes ${maxId ? 'maximized' : ''}`}
          style={
            maxId
              ? undefined
              : {
                  gridTemplateColumns: `${colSplit.size}fr ${100 - colSplit.size}fr`,
                  gridAutoRows: `${paneH.size}px`,
                }
          }
        >
          {openGraphs.length === 0 && (
            <div className="logs-line" style={{ padding: 16 }}>
              — no pipelines open; pick one above —
            </div>
          )}
          {(maxId ? openGraphs.filter((g) => g.id === maxId) : openGraphs).map((g) => (
            <GraphPane
              key={g.id}
              graph={g}
              latest={latest}
              active={active}
              recon={recon}
              wide={wideIds.includes(g.id)}
              maximized={maxId === g.id}
              onPick={onPick}
              onToggleWide={() => toggleWide(g.id)}
              onToggleMax={() => setMaxId((m) => (m === g.id ? null : g.id))}
              onClose={() => toggleOpen(g.id)}
              onDragStart={() => setDragId(g.id)}
              onDropOn={() => dropOn(g.id)}
              onResizeHeight={maxId ? undefined : paneH.onPointerDown}
            />
          ))}
          {/* Splitter between the two pane columns. */}
          {!maxId && openGraphs.length > 1 && (
            <div
              className="gcol-split"
              style={{ left: `${colSplit.size}%` }}
              onPointerDown={colSplit.onPointerDown}
              role="separator"
              aria-label="Resize columns"
            />
          )}
        </div>
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
            setPickedNode(r.operation)
          }}
        />
      </div>

      {/* The picture reporting on its own truthfulness. A diagram that
          cannot tell you when it is wrong is a claim, not an observation. */}
      {recon && (
        <div className={`graph-fidelity ${recon.consistent ? 'ok' : 'bad'}`}>
          {recon.consistent ? (
            <span>
              ✓ consistent with {recon.turns_observed} observed turn
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
      <div className="graph-foot">
        <div className="graph-legend">
          <span className="lg hydrate">hydrate — lands on your screen immediately</span>
          <span className="lg fan_in">reconcile — never blocks</span>
          <span className="lg conditional">conditional</span>
          <span className="lg background">background</span>
        </div>
      </div>
    </div>
  )
}
