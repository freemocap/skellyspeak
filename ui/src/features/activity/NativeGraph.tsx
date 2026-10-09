import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import type { DefinitionSnapshot, InspectionSnapshot } from '../../generated/graph-contracts'
import { GraphCanvas, type OperationNodeData } from './ActivityGraph'
import { NODE_HEIGHT, NODE_WIDTH } from './graph-layout'
import { nativeGraphLayout } from './native-graph-layout'

export function NativeGraph({ graph, selected, onSelect, down = false }: {
  graph: DefinitionSnapshot | InspectionSnapshot; selected: string | null; onSelect: (node: string) => void; down?: boolean
}) {
  const layout = useMemo(() => nativeGraphLayout(graph.artifact), [graph.artifact])
  const nodes: Node<OperationNodeData, 'operation'>[] = layout.nodes.map((item, index) => {
    const id = item.operation.id
    const name = item.operation.kind
    const state = id.startsWith('node:') && 'nodes' in graph ? graph.nodes[name] : ''
    return {
      id, type: 'operation', position: down ? { x: item.depth * 24, y: index * 64 } : { x: item.x, y: item.y },
      width: NODE_WIDTH, height: NODE_HEIGHT, draggable: false, selectable: false,
      data: { label: name, state, meta: state, phase: null, selected: selected === id, onSelect: () => onSelect(id), down },
    }
  })
  return <GraphCanvas id={graph.artifact_id} nodes={nodes}
    edges={layout.edges.map(edge => ({ ...edge, className: 'ai-edge', animated: false }))}
    orientation={down ? 'down' : 'across'} />
}
