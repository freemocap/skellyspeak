import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
} from '@xyflow/react'
import { SkellySpeakNode, type NodeData, type RunState } from './SkellySpeakNode'
import type { EdgeKind, Graph, GraphNode, Reconciliation, Run } from '../../types'

// One pipeline, in its own pane. Several can be open at once — see
// AgentGraph — so this component owns nothing global.
//
// IMPORTANT: node state lives in React Flow via `useNodesState`, not in a
// `useMemo` over positions. Rebuilding the node array on every drag frame
// gives every node a fresh identity, which drops React Flow's `measured`
// dimensions — and it renders unmeasured nodes with `visibility: hidden`.
// That is why the graph used to vanish while you were dragging it.

const nodeTypes = { skellyspeak: SkellySpeakNode }

const EDGE_STYLE: Record<EdgeKind, { stroke: string; dash?: string; width: number }> = {
  sequential: { stroke: 'var(--line2)', width: 1.5 },
  fan_out: { stroke: 'var(--line2)', width: 1.5 },
  hydrate: { stroke: 'var(--amber-deep)', width: 1.5 },
  fan_in: { stroke: 'var(--line)', dash: '2 4', width: 1 },
  conditional: { stroke: 'var(--steel-deep)', dash: '5 4', width: 1.5 },
  background: { stroke: 'var(--faint-d)', dash: '1 5', width: 1.5 },
}

type Positions = Record<string, { x: number; y: number }>

function posKey(graphId: string) {
  return `skellyspeak_graph_pos_${graphId}`
}

export function loadPositions(graphId: string): Positions {
  try {
    const raw = localStorage.getItem(posKey(graphId))
    return raw ? (JSON.parse(raw) as Positions) : {}
  } catch {
    return {}
  }
}

// Fit once per pane, and again on resize. Not on every drag frame — the
// node moves, the camera chases, and the whole canvas appears to flash.
function FitControl({ graphId }: { graphId: string }) {
  const initialized = useNodesInitialized()
  const { fitView } = useReactFlow()
  const fitted = useRef<string | null>(null)

  useEffect(() => {
    if (!initialized || fitted.current === graphId) return
    fitted.current = graphId
    void fitView({ padding: 0.08, duration: 200 })
  }, [initialized, fitView, graphId])

  useEffect(() => {
    if (!initialized) return
    const pane = document.getElementById(`gcanvas-${graphId}`)
    if (!pane) return
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => void fitView({ padding: 0.08 }))
    })
    ro.observe(pane)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [initialized, fitView, graphId])

  return null
}

export function GraphPane({
  graph,
  latest,
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
  latest: Map<string, Run>
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

  // Build once per graph. Position overrides are applied here, not on every
  // render, so React Flow keeps ownership afterwards.
  useEffect(() => {
    const saved = loadPositions(graph.id)
    setNodes(
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'skellyspeak',
        position: saved[n.id] ?? { x: n.x, y: n.y },
        data: { node: n, state: 'idle', run: null, onPick } satisfies NodeData,
        draggable: true,
      }))
    )
  }, [graph.id, graph.nodes, setNodes, onPick])

  // Patch only `data` as runs land — identities and measurements survive.
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => {
        const d = n.data as NodeData
        const op = d.node.operation
        const run = op ? (latest.get(op) ?? null) : null
        const state: RunState = op && active.has(op) ? 'running' : (run?.outcome ?? 'idle')
        if (d.state === state && (d.run?.id ?? null) === (run?.id ?? null)) return n
        return { ...n, data: { ...d, state, run } }
      })
    )
  }, [latest, active, setNodes])

  const persist = useCallback(
    (_e: unknown, node: FlowNode) => {
      try {
        const saved = loadPositions(graph.id)
        saved[node.id] = node.position
        localStorage.setItem(posKey(graph.id), JSON.stringify(saved))
      } catch {
        /* a full quota should not break the canvas */
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
        const hot = active.has(e.from) || active.has(e.to)
        const verdict = recon?.edges.find((v) => v.from === e.from && v.to === e.to)
        const contradicted = verdict?.verdict === 'contradicted'
        return {
          id: `${e.from}->${e.to}-${i}`,
          source: e.from,
          target: e.to,
          animated: hot,
          label: contradicted ? '✕ contradicted' : e.condition ? '?' : undefined,
          style: {
            stroke: contradicted ? '#e06c6c' : st.stroke,
            strokeWidth: contradicted ? 2.5 : st.width,
            strokeDasharray: contradicted ? undefined : st.dash,
          },
        }
      }),
    [graph.edges, active, recon]
  )

  return (
    <section
      className={`gpane ${wide ? 'wide' : ''} ${maximized ? 'max' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropOn}
    >
      <header className="gpane-head" draggable onDragStart={onDragStart}>
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
      </header>
      <p className="gpane-desc">{graph.description}</p>
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
