import { useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { actorColor } from '../../lib/actor'
import type { GraphNode, Run } from '../../types'

export type RunState = 'idle' | 'running' | 'ok' | 'retried_then_ok' | 'failed'

export interface NodeData extends Record<string, unknown> {
  node: GraphNode
  state: RunState
  run: Run | null
  onPick: (n: GraphNode, r: Run | null) => void
}

function ms(n: number): string {
  return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`
}

export function SkellySpeakNode({ data }: NodeProps) {
  const { node, state, run, onPick } = data as NodeData
  const accent = run ? actorColor(run.actor) : 'var(--mut-d)'
  // Nodes are draggable AND clickable, so a drag would otherwise also open
  // the inspector on release. Only treat it as a click if the pointer
  // barely moved.
  const down = useRef<{ x: number; y: number } | null>(null)

  return (
    <button
      type="button"
      className={`gnode k-${node.kind} s-${state}`}
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY }
      }}
      onClick={(e) => {
        const d = down.current
        down.current = null
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
        onPick(node, run)
      }}
      title={node.purpose}
      style={{ '--accent': accent } as React.CSSProperties}
    >
      {/* Every node carries both handles. Omitting them on the endpoints
          silently dropped their edges — React Flow had nothing to anchor to,
          so "Your message" sat unconnected and its edges were never drawn. */}
      <Handle type="target" position={Position.Left} />
      <span className="gnode-label">{node.label}</span>
      <span className="gnode-kind">{node.kind.replace('_', ' ')}</span>
      {/* Real numbers on the face — honesty as the aesthetic. */}
      {run && (
        <span className="gnode-stats">
          {ms(run.duration_ms)}
          {run.usage?.total_tokens != null && ` · ${run.usage.total_tokens} tok`}
        </span>
      )}
      {state === 'running' && <span className="gnode-pulse" />}
      <Handle type="source" position={Position.Right} />
    </button>
  )
}
