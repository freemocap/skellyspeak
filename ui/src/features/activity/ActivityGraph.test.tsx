// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { TurnView } from '../../generated/contracts'
import { ActivityGraph } from './ActivityGraph'

const flow = vi.hoisted(() => ({ fitView: vi.fn(async () => true) }))
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Background: () => null, Controls: () => null, Handle: () => null,
  Position: { Left: 'left', Right: 'right', Bottom: 'bottom' }, useReactFlow: () => flow,
}))
beforeEach(() => flow.fitView.mockClear())

const DEPENDENCIES: Record<string, string[]> = { context: [], reply: ['context'], gloss: ['reply'], speech: ['reply'], skills: ['context'] }
function turn(running: string[]): TurnView {
  return {
    id: 'turn', state: 'assisting', paused: false, hold: null, replacesTurnId: null, replacedBy: null, route: 'hosted', attempts: [],
    operations: Object.entries(DEPENDENCIES).map(([id, dependencies]) => ({ id, kind: id, dependencies, role: 'standard', contractVersion: 1, sourceMessageId: null,
      state: running.includes(id) ? 'running' : 'succeeded' })),
  } as unknown as TurnView
}
const graph = (value: TurnView, follow: boolean) => <ActivityGraph turn={value} follow={follow} orientation="down" selectedKind={null} onSelect={() => {}} now={0} />
const lastFit = () => flow.fitView.mock.lastCall?.[0] as { nodes?: { id: string }[]; minZoom?: number } | undefined

it('follows the running operations at a readable size, and shows the whole graph once work settles', async () => {
  const view = render(graph(turn(['gloss', 'speech']), true))
  await waitFor(() => expect(lastFit()?.nodes).toEqual([{ id: 'gloss' }, { id: 'speech' }]))
  expect(lastFit()!.minZoom).toBeGreaterThanOrEqual(0.75)
  view.rerender(graph(turn(['skills']), true))
  await waitFor(() => expect(lastFit()?.nodes).toEqual([{ id: 'skills' }]))
  view.rerender(graph(turn([]), true))
  await waitFor(() => expect(lastFit()).toBeDefined())
  await waitFor(() => expect(lastFit()!.nodes).toBeUndefined())
})

it('keeps the whole graph in view when it has the room to show it', async () => {
  render(graph(turn(['gloss']), false))
  await waitFor(() => expect(flow.fitView).toHaveBeenCalled())
  expect(lastFit()!.nodes).toBeUndefined()
})
