import { useEffect, useMemo, useRef } from 'react'
import { ReactFlow, Background, Controls, Handle, Position, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { AiGraphDefinition, TurnView } from '../../generated/contracts'
import { humanizeKind, type OperationPhase } from '../../domain/conversation/activity-summary'
import { useI18n } from '../../components/localization/i18n'
import { attemptDuration, layoutOperations, layoutTurn, NODE_HEIGHT, NODE_WIDTH } from './graph-layout'

interface OperationNodeData extends Record<string, unknown> {
  label: string
  state: string
  phase: OperationPhase | null
  meta: string
  selected: boolean
  onSelect: () => void
}

function OperationNode({ data }: NodeProps<Node<OperationNodeData, 'operation'>>) {
  return <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <button type="button" className="ai-node" data-phase={data.phase ?? undefined} aria-pressed={data.selected}
      title={`${data.label} · ${data.state}`} onClick={data.onSelect}>
      <span className="ai-node-dot" aria-hidden="true" />
      <span className="ai-node-kind">{data.label}</span>
      <span className="ai-node-meta">{data.meta}</span>
    </button>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>
}

const nodeTypes = { operation: OperationNode }
const FIT = { padding: 0.12, maxZoom: 1.2 }

/// Keep the whole graph in view as the panel is resized, expanded or popped
/// out, and when the set of operations changes. Panning and zooming by hand
/// still work between those moments.
function FitToBox({ box, shape }: { box: React.RefObject<HTMLDivElement | null>; shape: string }) {
  const flow = useReactFlow()
  useEffect(() => {
    const element = box.current
    if (!element) return
    let frame = 0
    const fit = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { void flow.fitView(FIT) }) }
    fit()
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(frame)
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [box, flow, shape])
  return null
}

export function seconds(ms: number | null, tr: ReturnType<typeof useI18n>): string {
  return ms === null ? '—' : `${tr.number(ms / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s`
}

/// The turn's real operation graph. Nodes are its operations, edges their
/// recorded dependencies; state drives every visual change.
export function ActivityGraph({ turn, selectedKind, onSelect, now }: { turn: TurnView; selectedKind: string | null; onSelect: (kind: string) => void; now: number }) {
  const tr = useI18n()
  const layout = useMemo(() => layoutTurn(turn), [turn])
  const nodes: Node<OperationNodeData, 'operation'>[] = layout.nodes.map(node => ({
    id: node.operation.id,
    type: 'operation',
    position: { x: node.x, y: node.y },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    draggable: false,
    selectable: false,
    data: {
      label: humanizeKind(node.operation.kind),
      state: node.operation.state,
      phase: node.phase,
      meta: node.phase === 'running' || node.phase === 'succeeded' ? seconds(attemptDuration(node.attempt, now), tr)
        : node.phase === 'waiting' ? node.operation.role : node.operation.state.replaceAll('_', ' '),
      selected: node.operation.kind === selectedKind,
      onSelect: () => onSelect(node.operation.kind),
    },
  }))
  const edges: Edge[] = layout.edges.map(edge => ({
    id: edge.id, source: edge.source, target: edge.target,
    className: ['ai-edge', edge.phase && `ai-edge-${edge.phase}`].filter(Boolean).join(' '),
    animated: edge.phase === 'running',
  }))
  return <GraphCanvas id={turn.id} nodes={nodes} edges={edges} />
}

export function DefinitionGraph({ graph, selectedKind, onSelect }: { graph: AiGraphDefinition; selectedKind: string | null; onSelect: (kind: string) => void }) {
  const layout = useMemo(() => layoutOperations(graph.operations.map(operation => ({ ...operation, id: operation.kind }))), [graph])
  const nodes: Node<OperationNodeData, 'operation'>[] = layout.nodes.map(node => ({
    id: node.operation.id, type: 'operation', position: { x: node.x, y: node.y }, width: NODE_WIDTH, height: NODE_HEIGHT,
    draggable: false, selectable: false,
    data: { label: humanizeKind(node.operation.kind), state: node.operation.role, phase: null, meta: node.operation.role,
      selected: node.operation.kind === selectedKind, onSelect: () => onSelect(node.operation.kind) },
  }))
  return <GraphCanvas id={graph.id} nodes={nodes} edges={layout.edges.map(edge => ({ ...edge, className: 'ai-edge', animated: false }))} />
}

function GraphCanvas({ id, nodes, edges }: { id: string; nodes: Node<OperationNodeData, 'operation'>[]; edges: Edge[] }) {
  const box = useRef<HTMLDivElement>(null)
  const shape = nodes.map(node => node.id).join(' ')
  return <div className="ai-graph" ref={box}>
    <ReactFlow key={id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={FIT}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} minZoom={0.3} maxZoom={1.6}
      // A node-click handler is what gives non-draggable nodes pointer events
      // in React Flow; the node's own button also handles the keyboard.
      onNodeClick={(_, node) => node.data.onSelect()}>
      <Background />
      <Controls showInteractive={false} />
      <FitToBox box={box} shape={shape} />
    </ReactFlow>
  </div>
}
