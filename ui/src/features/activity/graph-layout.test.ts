// @vitest-environment node
import { expect, it } from 'vitest'
import { layoutOperations } from './graph-layout'

it('renders exactly the supplied edges and preserves declaration order within each depth', () => {
  const operations = [
    { id: 'c', kind: 'first-declared-child', dependencies: ['a'] },
    { id: 'a', kind: 'source', dependencies: [] },
    { id: 'b', kind: 'second-declared-child', dependencies: ['a'] },
    { id: 'd', kind: 'join', dependencies: ['b', 'c'] },
  ]
  const graph = layoutOperations(operations)
  expect(graph.edges).toEqual([
    { id: 'a:c', source: 'a', target: 'c' },
    { id: 'a:b', source: 'a', target: 'b' },
    { id: 'b:d', source: 'b', target: 'd' },
    { id: 'c:d', source: 'c', target: 'd' },
  ])
  expect(graph.nodes.map(node => [node.operation.id, node.depth])).toEqual([['a', 0], ['c', 1], ['b', 1], ['d', 2]])
  expect(graph.nodes.find(node => node.operation.id === 'c')!.y).toBeLessThan(graph.nodes.find(node => node.operation.id === 'b')!.y)
  const positions = (items: typeof operations) => layoutOperations(items).nodes.map(({ operation, x, y }) => [operation.id, x, y])
  expect(positions(operations.map((operation, index) => ({ ...operation, kind: `renamed-${index}`, startedAt: `different-${index}` })))).toEqual(positions(operations))
})

it('refuses missing or duplicate dependencies, duplicate IDs and cycles instead of repairing topology', () => {
  const op = (id: string, dependencies: string[]) => ({ id, kind: id, dependencies })
  expect(() => layoutOperations([op('a', ['missing'])])).toThrow('missing dependency')
  expect(() => layoutOperations([op('a', []), op('b', ['a', 'a'])])).toThrow('duplicate dependencies')
  expect(() => layoutOperations([op('a', []), op('a', [])])).toThrow('duplicate operation IDs')
  expect(() => layoutOperations([op('a', ['b']), op('b', ['a'])])).toThrow('cycle')
})
