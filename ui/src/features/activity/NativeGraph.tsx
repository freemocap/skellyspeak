import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import type { DefinitionSnapshot, Disposition, InspectionSnapshot } from '../../generated/graph-contracts'
import { GraphCanvas, type OperationNodeData } from './GraphCanvas'
import { NODE_HEIGHT, NODE_WIDTH } from './graph-layout'
import type { OperationPhase } from '../../domain/conversation/activity-summary'
import { nativeGraphLayout } from './native-graph-layout'

// Colors are presentation only; the exact native disposition remains visible.
const tone: Record<Disposition, OperationPhase> = {
  Disabled: 'ended', Unrequested: 'waiting', Skipped: 'ended', Waiting: 'waiting',
  Blocked: 'held', Ready: 'waiting', Paused: 'held', Held: 'held', Prepared: 'waiting',
  Running: 'running', Available: 'succeeded', Adopted: 'succeeded', Failed: 'failed',
  Unknown: 'unknown', Cancelled: 'ended',
}

export function NativeGraph({ graph, selected, onSelect, down = false, animate = false }: {
  graph: DefinitionSnapshot | InspectionSnapshot; selected: string | null; onSelect: (node: string) => void; down?: boolean; animate?: boolean
}) {
  const layout = useMemo(() => nativeGraphLayout(graph.artifact), [graph.artifact])
  // Initial framing favors operations at readable scale; boundaries remain in the canvas.
  const focus = selected && layout.nodes.some(item => item.operation.id === selected)
    ? selected : layout.nodes.find(item => item.operation.id.startsWith('node:'))?.operation.id ?? ''
  const nodes: Node<OperationNodeData, 'operation'>[] = layout.nodes.map((item, index) => {
    const id = item.operation.id
    const name = item.operation.kind
    const state = id.startsWith('node:') && 'nodes' in graph ? graph.nodes[name] : ''
    return {
      id, type: 'operation', position: down ? { x: item.depth * 24, y: index * 64 } : { x: item.x, y: item.y },
      width: NODE_WIDTH, height: NODE_HEIGHT, draggable: false, selectable: false,
      data: { label: name, state, meta: state, phase: state ? tone[state] : null, animate, selected: selected === id, onSelect: () => onSelect(id), down },
    }
  })
  return <GraphCanvas id={graph.artifact_id} nodes={nodes} focus={focus}
    edges={layout.edges.map(edge => {
      const state = edge.target.startsWith('node:') && 'nodes' in graph ? graph.nodes[edge.target.slice(5)] : undefined
      const phase = state ? tone[state] : null
      return { ...edge, label: undefined, data: { binding: edge.label }, className: `ai-edge${phase ? ` ai-edge-${phase}` : ''}`, animated: animate && state === 'Running' }
    })}
    orientation={down ? 'down' : 'across'} />
}
