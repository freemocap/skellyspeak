import type { Artifact, ConstantDisclosure, Source } from '../../generated/graph-contracts'
import { layoutOperations } from './graph-layout'

/** Static geometry only. Connections are copied from the executable bindings,
 * including graph boundaries, controls and guards; attempts never add topology. */
export function nativeGraphLayout(artifact: Artifact<ConstantDisclosure>) {
  const definition = artifact.definition
  const nodes = [
    ...Object.keys(definition.inputs).map(port => ({ id: `input:${port}`, kind: port, dependencies: [] as string[] })),
    ...Object.keys(definition.nodes).map(node => ({ id: `node:${node}`, kind: node, dependencies: [] as string[] })),
    ...Object.keys(definition.outputs).map(port => ({ id: `output:${port}`, kind: port, dependencies: [] as string[] })),
  ]
  const edges: { id: string; source: string; target: string; label: string }[] = []
  const bind = (source: Source<ConstantDisclosure>, target: string, port: string, kind = 'data') => {
    const from = 'Output' in source ? `node:${source.Output.node}` : 'Input' in source ? `input:${source.Input}` : null
    if (from) edges.push({ id: JSON.stringify([kind, source, target, port]), source: from, target,
      label: 'Output' in source ? `${source.Output.port} → ${port}` : port })
  }
  for (const [name, node] of Object.entries(definition.nodes)) {
    const target = `node:${name}`
    for (const [port, source] of Object.entries(node.inputs)) bind(source, target, port)
    if (node.guard) bind(node.guard, target, 'guard', 'guard')
    for (const parent of node.after) edges.push({ id: JSON.stringify(['control', parent, target]), source: `node:${parent}`, target, label: 'control' })
  }
  for (const [port, source] of Object.entries(definition.results)) bind(source, `output:${port}`, port, 'result')
  for (const node of nodes) node.dependencies = [...new Set(edges.filter(edge => edge.target === node.id).map(edge => edge.source))]
  return { nodes: layoutOperations(nodes).nodes, edges }
}
