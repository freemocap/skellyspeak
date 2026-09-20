import type { AttemptView, OperationView, TurnView } from '../../generated/contracts'
import { latestAttempt, operationPhase, type OperationPhase } from '../../domain/conversation/activity-summary'

export const NODE_WIDTH = 216
export const NODE_HEIGHT = 32
const COLUMN_GAP = 256
const ROW_GAP = 42

export interface GraphNode {
  operation: OperationView
  attempt: AttemptView | null
  phase: OperationPhase | null
  depth: number
  x: number
  y: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  /// The target's phase: an edge is live while the work it feeds runs.
  phase: OperationPhase | null
}

/// Place a turn's operations by dependency depth. Everything comes from the
/// turn's own operations and their recorded dependencies; nothing here knows
/// any operation by name.
export function layoutOperations<T extends { id: string; kind: string; dependencies: string[] }>(
  operations: T[],
) {
  const byId = new Map(operations.map(operation => [operation.id, operation]))
  if (byId.size !== operations.length) throw new Error('AI graph has duplicate operation IDs.')
  for (const operation of operations) {
    if (new Set(operation.dependencies).size !== operation.dependencies.length) throw new Error('AI graph has duplicate dependencies.')
    for (const dependency of operation.dependencies) {
      if (!byId.has(dependency)) throw new Error('AI graph has a missing dependency.')
    }
  }
  const depths = new Map<string, number>()
  const depth = (id: string, visiting: Set<string> = new Set()): number => {
    const known = depths.get(id)
    if (known !== undefined) return known
    const operation = byId.get(id)
    if (!operation) throw new Error('AI graph has a missing operation.')
    if (visiting.has(id)) throw new Error('AI graph contains a dependency cycle.')
    const next = new Set(visiting).add(id)
    const parents = operation.dependencies
    const value = parents.length ? 1 + Math.max(...parents.map(dependency => depth(dependency, next))) : 0
    depths.set(id, value)
    return value
  }
  const columns = new Map<number, T[]>()
  for (const operation of operations) {
    const column = depth(operation.id)
    columns.set(column, [...(columns.get(column) ?? []), operation])
  }
  const tallest = Math.max(0, ...[...columns.values()].map(column => column.length))
  const nodes: { operation: T; depth: number; x: number; y: number }[] = []
  for (const [column, operations] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = operations
    const offset = (tallest - ordered.length) * ROW_GAP / 2
    ordered.forEach((operation, row) => nodes.push({
      operation,
      depth: column,
      x: column * COLUMN_GAP,
      y: offset + row * ROW_GAP,
    }))
  }
  const edges = operations.flatMap(operation => operation.dependencies
    .map(dependency => ({ id: `${dependency}:${operation.id}`, source: dependency, target: operation.id })))
  return { nodes, edges }
}

export function layoutTurn(turn: Pick<TurnView, 'operations' | 'attempts'>): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const layout = layoutOperations(turn.operations)
  const phases = new Map(turn.operations.map(operation => [operation.id, operationPhase(operation.state)]))
  return {
    nodes: layout.nodes.map(node => ({ ...node, attempt: latestAttempt(turn, node.operation.id), phase: operationPhase(node.operation.state) })),
    edges: layout.edges.map(edge => ({ ...edge, phase: phases.get(edge.target) ?? null })),
  }
}

/// Milliseconds an attempt has run: to its finish, or to `now` while running.
export function attemptDuration(attempt: AttemptView | null, now: number): number | null {
  if (!attempt) return null
  const start = Date.parse(attempt.startedAt)
  const end = attempt.finishedAt ? Date.parse(attempt.finishedAt) : now
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null
}
