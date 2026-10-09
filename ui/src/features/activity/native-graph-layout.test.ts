import { expect, it } from 'vitest'
import type { Artifact, ConstantDisclosure } from '../../generated/graph-contracts'
import { nativeGraphLayout } from './native-graph-layout'

const artifact: Artifact<ConstantDisclosure> = {
  operations: {}, types: {},
  definition: {
    contract: 'fixture@1', compositions: {}, inputs: { source: { contract: 'text@1', optional: false } },
    outputs: { result: { contract: 'text@1', optional: false } },
    nodes: {
      first: { operation: 'a@1', inputs: { text: { Input: 'source' } }, after: [], guard: null, activation: 'Automatic' },
      second: { operation: 'b@1', inputs: { text: { Output: { node: 'first', port: 'text' } } },
        after: ['first'], guard: { Output: { node: 'first', port: 'allowed' } }, activation: 'OnDemand' },
    }, results: { result: { Output: { node: 'second', port: 'text' } } },
  },
}

it('copies all data, control, guard and boundary connections without requiring attempts', () => {
  const layout = nativeGraphLayout(artifact)
  expect(layout.nodes.map(n => n.operation.id)).toEqual(['input:source', 'node:first', 'node:second', 'output:result'])
  expect(layout.edges).toHaveLength(5)
  expect(new Set(layout.edges.map(e => e.id)).size).toBe(5)
  expect(layout.edges.filter(e => e.source === 'node:first' && e.target === 'node:second').map(e => e.label)).toEqual(['text → text', 'allowed → guard', 'control'])
})

it('keeps a guard separate from a data port named guard', () => {
  const graph = structuredClone(artifact)
  graph.definition.nodes.second.inputs.guard = { Output: { node: 'first', port: 'allowed' } }
  const edges = nativeGraphLayout(graph).edges
  expect(edges).toHaveLength(6)
  expect(new Set(edges.map(edge => edge.id)).size).toBe(6)
})

it('preserves topology for disabled and on-demand nodes', () => {
  const disabled = structuredClone(artifact)
  disabled.definition.nodes.second.activation = 'Disabled'
  expect(nativeGraphLayout(disabled)).toEqual(nativeGraphLayout(artifact))
})

it('rejects a dangling authoritative binding rather than silently dropping it', () => {
  const broken = structuredClone(artifact)
  broken.definition.nodes.second.after = ['missing']
  expect(() => nativeGraphLayout(broken)).toThrow('missing dependency')
})
