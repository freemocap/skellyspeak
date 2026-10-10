// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { DefinitionSnapshot, Disposition, InspectionSnapshot } from '../../generated/graph-contracts'
import { NativeGraph } from './NativeGraph'

const canvas = vi.hoisted(() => vi.fn())
vi.mock('./GraphCanvas', () => ({ GraphCanvas: (props: unknown) => { canvas(props); return null } }))
const definition: DefinitionSnapshot = {
  protocol: 1, artifact_id: 'fixture', artifact: {
    operations: {}, types: {}, definition: {
      contract: 'fixture@1', compositions: {}, inputs: { text: { contract: 'text@1', optional: false } },
      outputs: { text: { contract: 'text@1', optional: false } },
      nodes: {
        first: { operation: 'text@1', inputs: { text: { Input: 'text' } }, after: [], guard: null, activation: 'Automatic' },
        helper: { operation: 'text@1', inputs: { text: { Output: { node: 'first', port: 'text' } } }, after: ['first'], guard: null, activation: 'OnDemand' },
      }, results: { text: { Output: { node: 'helper', port: 'text' } } },
    },
  },
}
const states: Disposition[] = ['Disabled', 'Unrequested', 'Skipped', 'Waiting', 'Blocked', 'Ready', 'Paused', 'Held', 'Prepared', 'Running', 'Available', 'Adopted', 'Failed', 'Unknown', 'Cancelled']
it.each([false, true])('retains every artifact node and edge in structure and every execution state (down=%s)', down => {
  const props = { selected: null, onSelect: vi.fn(), down }
  const view = render(<NativeGraph {...props} graph={definition} />)
  const structure = canvas.mock.lastCall![0]
  expect(structure.nodes.map((node: { id: string }) => node.id)).toEqual(['input:text', 'node:first', 'node:helper', 'output:text'])
  expect(structure.edges).toHaveLength(4)
  for (const state of states) {
    const graph: InspectionSnapshot = { ...definition, engine: 'engine', run: 'run', revision: '1', nodes: { first: 'Adopted', helper: state }, activation: {}, paused: false, active: true, stepping: null, step_available: false, attempts: {}, reasons: {} }
    view.rerender(<NativeGraph {...props} graph={graph} />)
    const current = canvas.mock.lastCall![0]
    expect(current.edges.map(({ id, source, target, label }: { id: string; source: string; target: string; label: string }) => ({ id, source, target, label }))).toEqual(structure.edges.map(({ id, source, target, label }: { id: string; source: string; target: string; label: string }) => ({ id, source, target, label })))
    expect(current.nodes.map((node: { id: string; position: unknown }) => [node.id, node.position])).toEqual(structure.nodes.map((node: { id: string; position: unknown }) => [node.id, node.position]))
    expect(current.nodes.find((node: { id: string }) => node.id === 'node:helper').data.state).toBe(state)
  }
})


it('animates only live running edges and keeps recorded execution still', () => {
  const graph = { ...definition, engine: 'engine', run: 'run', revision: '1', nodes: { first: 'Adopted', helper: 'Running' }, activation: {}, paused: false, active: true, stepping: null, step_available: false, attempts: {}, reasons: {} } as InspectionSnapshot
  const view = render(<NativeGraph graph={graph} selected={null} onSelect={() => {}} animate />)
  expect(canvas.mock.lastCall![0].edges.filter((edge: { animated: boolean }) => edge.animated)).toHaveLength(2)
  view.rerender(<NativeGraph graph={graph} selected={null} onSelect={() => {}} />)
  expect(canvas.mock.lastCall![0].edges.every((edge: { animated: boolean }) => !edge.animated)).toBe(true)
  expect(canvas.mock.lastCall![0].nodes.every((node: { data: { animate: boolean } }) => !node.data.animate)).toBe(true)
})


it('starts at a readable operation and retains binding metadata without overlapping labels or removing edges', () => {
  const view = render(<NativeGraph graph={definition} selected={null} onSelect={() => {}} />)
  const initial = canvas.mock.lastCall![0]
  expect(initial.focus).toBe('node:first')
  expect(initial.edges.every((edge: { label?: string }) => edge.label === undefined)).toBe(true)
  view.rerender(<NativeGraph graph={definition} selected="node:helper" onSelect={() => {}} />)
  const selected = canvas.mock.lastCall![0]
  expect(selected.focus).toBe('node:helper')
  expect(selected.edges.map((edge: { id: string }) => edge.id)).toEqual(initial.edges.map((edge: { id: string }) => edge.id))
  expect(selected.edges.every((edge: { label?: string }) => edge.label === undefined)).toBe(true)
  expect(selected.edges.every((edge: { data: { binding: string } }) => typeof edge.data.binding === 'string')).toBe(true)
})
