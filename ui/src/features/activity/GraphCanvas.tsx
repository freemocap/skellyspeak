import { useEffect, useRef } from 'react'
import { ReactFlow, Background, Controls, Handle, Position, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { OperationPhase } from '../../domain/conversation/activity-summary'

export interface OperationNodeData extends Record<string, unknown> {
  label: string
  state: string
  phase: OperationPhase | null
  meta: string
  selected: boolean
  onSelect: () => void
  /// Stacked down a narrow screen: edges leave from below and enter from the start side.
  down: boolean
  animate?: boolean
}

function OperationNode({ data }: NodeProps<Node<OperationNodeData, 'operation'>>) {
  return <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <button type="button" className="ai-node" data-animate={data.animate ?? true} data-phase={data.phase ?? undefined} aria-pressed={data.selected}
      title={`${data.label} · ${data.state}`} onClick={data.onSelect}>
      <span className="ai-node-dot" aria-hidden="true" />
      <span className="ai-node-kind">{data.label}</span>
      <span className="ai-node-meta">{data.meta}</span>
    </button>
    <Handle type="source" position={data.down ? Position.Bottom : Position.Right} isConnectable={false} />
  </>
}

const nodeTypes = { operation: OperationNode }
const FIT = { padding: 0.12, maxZoom: 1.2 }
// Following running work: near full size, so the operations stay readable,
// however much of the rest of the graph that leaves out of view.
const FOLLOW = { padding: 0.2, minZoom: 0.8, maxZoom: 1 }
const FOLLOW_PAN_MS = 240

/// Keep the whole graph in view as the panel is resized, expanded or popped
/// out, and when the set of operations changes. Given operations to focus, keep
/// those in view instead, panning to them as they change. Panning and zooming
/// by hand still work between those moments.
function FitToBox({ box, shape, focus }: { box: React.RefObject<HTMLDivElement | null>; shape: string; focus: string }) {
  const flow = useReactFlow()
  useEffect(() => {
    const element = box.current
    if (!element) return
    const nodes = focus ? focus.split(' ').map(id => ({ id })) : null
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let frame = 0
    const fit = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { void flow.fitView(nodes ? { ...FOLLOW, nodes, duration: still ? 0 : FOLLOW_PAN_MS } : FIT) }) }
    fit()
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(frame)
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [box, flow, shape, focus])
  return null
}

export function GraphCanvas({ id, nodes, edges, orientation = 'across', focus = '' }: { id: string; nodes: Node<OperationNodeData, 'operation'>[]; edges: Edge[]; orientation?: 'across' | 'down'; focus?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const shape = nodes.map(node => node.id).join(' ')
  return <div className="ai-graph" data-orientation={orientation} ref={box}>
    <ReactFlow key={id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={FIT}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} minZoom={0.3} maxZoom={1.6}
      // A node-click handler is what gives non-draggable nodes pointer events
      // in React Flow; the node's own button also handles the keyboard.
      onNodeClick={(_, node) => node.data.onSelect()}>
      <Background />
      <Controls showInteractive={false} />
      <FitToBox box={box} shape={shape} focus={focus} />
    </ReactFlow>
  </div>
}
