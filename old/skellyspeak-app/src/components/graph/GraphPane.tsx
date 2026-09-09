import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
} from '@xyflow/react'
import { SkellySpeakNode, type NodeData, type RunState } from './SkellySpeakNode'
import type { EdgeKind, Graph, GraphNode, Reconciliation, Run } from '../../types'
import { useIsMobile } from '../../hooks/useIsMobile'
import { reportFault } from '../../lib/faults'

// One pipeline, in its own pane. Several can be open at once — see
// AgentGraph — so this component owns nothing global.
//
// IMPORTANT: node state lives in React Flow via `useNodesState`, not in a
// `useMemo` over positions. Rebuilding the node array on every drag frame
// gives every node a fresh identity, which drops React Flow's `measured`
// dimensions — and it renders unmeasured nodes with `visibility: hidden`,
// which hides the graph mid-drag.

const nodeTypes = { skellyspeak: SkellySpeakNode }

const EDGE_STYLE: Record<EdgeKind, { stroke: string; dash?: string; width: number }> = {
  // Widths and inks chosen so every edge is traceable across a pane. The
  // faintest greys in the palette (--line, --faint-d) read as smudges at these
  // lengths, so the dashed kinds sit a step darker and no thinner than 1.5.
  sequential: { stroke: 'var(--mut-d)', width: 1.5 },
  fan_out: { stroke: 'var(--mut-d)', width: 1.5 },
  hydrate: { stroke: 'var(--amber-deep)', width: 2 },
  fan_in: { stroke: 'var(--mut-d)', dash: '3 4', width: 1.5 },
  conditional: { stroke: 'var(--steel-deep)', dash: '5 4', width: 1.75 },
  background: { stroke: 'var(--mut-d)', dash: '2 5', width: 1.5 },
}

type Positions = Record<string, { x: number; y: number }>

function posKey(graphId: string) {
  return `skellyspeak_graph_pos_${graphId}`
}

/// No stored layout is normal and yields an empty map. A stored-but-unreadable
/// one is a fault and is reported rather than quietly discarded.
export function loadPositions(graphId: string): Positions {
  const raw = localStorage.getItem(posKey(graphId))
  if (raw === null) return {}
  try {
    return JSON.parse(raw) as Positions
  } catch (e) {
    reportFault('Restoring graph layout', e)
    return {}
  }
}

// Fit once per pane, and again on resize. Not on every drag frame — the
// node moves, the camera chases, and the whole canvas appears to flash.
function FitControl({ graphId }: { graphId: string }) {
  const initialized = useNodesInitialized()
  const mobile = useIsMobile()
  const { fitView } = useReactFlow()
  const fitted = useRef<string | null>(null)

  useEffect(() => {
    if (!initialized || fitted.current === graphId) return
    fitted.current = graphId
    void fitView({ padding: 0.08, minZoom: mobile ? 0.9 : 0.85, duration: 200 })
  }, [initialized, fitView, graphId, mobile])

  useEffect(() => {
    if (!initialized) return
    const pane = document.getElementById(`gcanvas-${graphId}`)
    if (!pane) return
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => void fitView({ padding: 0.08, minZoom: mobile ? 0.9 : 0.85 }))
    })
    ro.observe(pane)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [initialized, fitView, graphId, mobile])

  return null
}

export function GraphPane({
  graph,
  mode,
  latest,
  selectedNode,
  active,
  recon,
  wide,
  maximized,
  onPick,
  onToggleWide,
  onToggleMax,
  onClose,
  onDragStart,
  onDropOn,
  onResizeHeight,
}: {
  graph: Graph
  mode: 'explore' | 'debug'
  latest: Map<string, Run>
  selectedNode: string | null
  active: Set<string>
  recon: Reconciliation | null
  wide: boolean
  maximized: boolean
  onPick: (node: GraphNode, run: Run | null) => void
  onToggleWide: () => void
  onToggleMax: () => void
  onClose: () => void
  onDragStart: () => void
  onDropOn: () => void
  /** Drag the pane's bottom edge to set the row height. */
  onResizeHeight?: (e: React.PointerEvent) => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])

  // Preserve measured nodes and dragged positions while recorded state changes.
  useEffect(() => {
    const saved = mode === 'debug' ? loadPositions(graph.id) : {}
    setNodes((previous) => graph.nodes.map((node) => {
      const existing = previous.find((item) => item.id === node.id)
      const run = node.operation ? latest.get(node.operation) ?? null : null
      const state: RunState = node.operation && active.has(node.operation) ? 'running' : run?.outcome ?? 'idle'
      const data: NodeData = { node, state, run, selected: node.id === selectedNode, onPick }
      return {
        ...existing,
        id: node.id,
        type: 'skellyspeak',
        position: existing?.position ?? saved[node.id] ?? { x: node.x, y: node.y },
        data,
        draggable: mode === 'debug',
      }
    }))
  }, [graph.id, graph.nodes, latest, active, selectedNode, setNodes, onPick, mode])

  const persist = useCallback(
    (_e: unknown, node: FlowNode) => {
      try {
        const saved = loadPositions(graph.id)
        saved[node.id] = node.position
        localStorage.setItem(posKey(graph.id), JSON.stringify(saved))
      } catch (e) {
        reportFault('Saving graph layout', e)
      }
    },
    [graph.id]
  )

  const resetLayout = useCallback(() => {
    localStorage.removeItem(posKey(graph.id))
    setNodes((ns) =>
      ns.map((n) => {
        const d = n.data as NodeData
        return { ...n, position: { x: d.node.x, y: d.node.y } }
      })
    )
  }, [graph.id, setNodes])

  const edges: FlowEdge[] = useMemo(
    () =>
      graph.edges.map((e, i) => {
        const st = EDGE_STYLE[e.kind]
        // Motion means work. An idle graph is completely still.
        const hot = graph.nodes.some((node) => (node.id === e.from || node.id === e.to) && node.operation !== null && active.has(node.operation))
        const verdict = recon?.edges.find((v) => v.from === e.from && v.to === e.to)
        const connected = e.from === selectedNode || e.to === selectedNode
        const contradicted = verdict?.verdict === 'contradicted'
        return {
          id: `${e.from}->${e.to}-${i}`,
          source: e.from,
          target: e.to,
          animated: hot,
          label: contradicted ? '✕ contradicted' : e.condition ? '?' : undefined,
          style: {
            stroke: contradicted ? '#e06c6c' : connected ? 'var(--ink-d)' : st.stroke,
            strokeWidth: connected ? 3 : contradicted ? 2.5 : st.width,
            strokeDasharray: contradicted ? undefined : st.dash,
          },
        }
      }),
    [graph.edges, graph.nodes, active, recon, selectedNode]
  )

  return (
    <section
      className={`gpane ${wide ? 'wide' : ''} ${maximized ? 'max' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropOn}
    >
      {mode === 'debug' && <header className="gpane-head" draggable onDragStart={onDragStart}>
        <span className="gpane-title">{graph.label}</span>
        <button type="button" className="gpane-btn" onClick={resetLayout} title="Reset node positions">
          ⟲
        </button>
        {!maximized && (
          <button
            type="button"
            className="gpane-btn"
            onClick={onToggleWide}
            title={wide ? 'Half width' : 'Full width'}
          >
            {wide ? '◨' : '▭'}
          </button>
        )}
        <button
          type="button"
          className="gpane-btn"
          onClick={onToggleMax}
          title={maximized ? 'Restore' : 'Maximize to the whole area'}
        >
          {maximized ? '⤡' : '⛶'}
        </button>
        <button type="button" className="gpane-btn close" onClick={onClose} title="Close pane">
          ✕
        </button>
      </header>}
      {mode === 'debug' && <details className="gpane-description"><summary>About this pipeline</summary><p>{graph.description}</p><p>Inputs: {graph.shared_state.join(", ")}</p></details>}
      <div className="graph-canvas" id={`gcanvas-${graph.id}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={persist}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          edgesFocusable={false}
          minZoom={0.2}
        >
          <FitControl graphId={graph.id} />
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--line)" />
          <Controls showInteractive={false} />
          <MiniMap style={{ width: 110, height: 65 }} pannable zoomable nodeColor="var(--steel)" maskColor="rgba(7, 14, 22, 0.65)" />
        </ReactFlow>
      </div>
      {onResizeHeight && (
        <div
          className="gpane-resize"
          onPointerDown={onResizeHeight}
          role="separator"
          aria-label="Resize pane height"
        />
      )}
    </section>
  )
}
