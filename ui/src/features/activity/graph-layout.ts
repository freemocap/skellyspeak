export const NODE_WIDTH = 216
export const NODE_HEIGHT = 32
const COLUMN_GAP = 256
const ROW_GAP = 42

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

/// Row pitch and per-depth indent of the stacked layout.
export const TREE_ROW = 40
export const TREE_INDENT = 28

/// The same graph for a narrow screen: one operation per row, down the screen
/// in dependency order, each directly under the prerequisite it most depends
/// on (its deepest) and indented by its depth, so it reads as a tree whose
/// edges run down the start side. Only the rows are ordered this way; every
/// recorded dependency is still an edge.
export function layoutOperationsDown<T extends { id: string; kind: string; dependencies: string[] }>(operations: T[]) {
  const across = layoutOperations(operations)
  const depth = new Map(across.nodes.map(node => [node.operation.id, node.depth]))
  const children = new Map<string, T[]>()
  const roots: T[] = []
  for (const operation of operations) {
    const parent = operation.dependencies.reduce<string | null>((best, dependency) =>
      best === null || depth.get(dependency)! > depth.get(best)! ? dependency : best, null)
    if (parent === null) roots.push(operation)
    else children.set(parent, [...(children.get(parent) ?? []), operation])
  }
  const nodes: { operation: T; depth: number; x: number; y: number }[] = []
  const place = (operation: T) => {
    const level = depth.get(operation.id)!
    nodes.push({ operation, depth: level, x: level * TREE_INDENT, y: nodes.length * TREE_ROW })
    for (const child of children.get(operation.id) ?? []) place(child)
  }
  roots.forEach(place)
  return { nodes, edges: across.edges }
}
