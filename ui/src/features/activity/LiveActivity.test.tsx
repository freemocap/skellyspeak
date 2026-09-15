// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LiveActivity } from './LiveActivity'
const api = vi.hoisted(() => ({ readWorkspace: vi.fn(), watchConversation: vi.fn() }))
vi.mock('../../platform/ipc/workspace', () => ({ ...api, selectedConversation: (workspace: { selected: string | null }) => workspace.selected ? { id: workspace.selected } : null, nativeError: String }))
vi.mock('./GenerationActivity', () => ({ GenerationActivity: () => <div>Generation receipts</div> }))
vi.mock('@xyflow/react', () => ({ ReactFlow: ({ nodes, edges }: { nodes: unknown[]; edges: unknown[] }) => <pre data-testid="graph">{JSON.stringify({ nodes, edges })}</pre>, Background: () => null, Controls: () => null }))
beforeEach(() => { vi.resetAllMocks() })

it('renders actual dependency IDs and watches updates without dispatching AI', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  api.watchConversation.mockResolvedValueOnce({ conversationId: 'chat', revision: 2, turns: [{ id: 'turn', state: 'assisting', attempts: [], operations: [{ id: 'reply', kind: 'persona_reply', state: 'done', dependencies: [] }, { id: 'gloss', kind: 'persona_word_gloss', state: 'running', dependencies: ['reply'] }] }] }).mockImplementation(() => new Promise(() => {}))
  render(<LiveActivity />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('persona word gloss · running'))
  expect(screen.getByTestId('graph')).toHaveTextContent('"source":"reply","target":"gloss"')
  expect(api.watchConversation).toHaveBeenLastCalledWith('chat', 2)
})


function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (failure: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
function snapshot(conversationId: string, revision: number, operation: string) {
  return { conversationId, revision, turns: [{ id: `${conversationId}-turn`, state: 'assisting', attempts: [], operations: [{ id: operation, kind: operation, state: 'running', dependencies: [] }] }] }
}

it('follows native selection while mounted and rejects the abandoned watch response', async () => {
  let selected = 'first'
  api.readWorkspace.mockImplementation(async () => ({ selected }))
  const oldWait = deferred<unknown>()
  const nextWait = deferred<unknown>()
  api.watchConversation.mockImplementation((id: string, revision: number) => {
    if (id === 'first' && revision === -1) return Promise.resolve(snapshot('first', 1, 'first-operation'))
    if (id === 'first') return oldWait.promise
    if (id === 'second' && revision === -1) return nextWait.promise
    return new Promise(() => {})
  })
  render(<LiveActivity />)
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('first-operation'))
  selected = 'second'
  await act(async () => { oldWait.resolve(snapshot('first', 2, 'obsolete-operation')) })
  await waitFor(() => expect(api.watchConversation).toHaveBeenLastCalledWith('second', -1))
  expect(screen.getByTestId('graph')).not.toHaveTextContent('obsolete-operation')
  expect(screen.getByTestId('graph')).not.toHaveTextContent('first-operation')
  await act(async () => { nextWait.resolve(snapshot('second', 3, 'second-operation')) })
  await waitFor(() => expect(screen.getByTestId('graph')).toHaveTextContent('second-operation'))
  expect(api.watchConversation).toHaveBeenLastCalledWith('second', 3)
})

it('starts watching when a conversation is selected after an empty workspace', async () => {
  vi.useFakeTimers()
  try {
    let selected: string | null = null
    api.readWorkspace.mockImplementation(async () => ({ selected }))
    api.watchConversation.mockImplementation(() => new Promise(() => {}))
    const view = render(<LiveActivity />)
    await act(async () => {})
    expect(api.watchConversation).not.toHaveBeenCalled()
    selected = 'later'
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    expect(api.watchConversation).toHaveBeenCalledExactlyOnceWith('later', -1)
    view.unmount()
  } finally { vi.useRealTimers() }
})

it('ignores a rejected abandoned scope but reports failure of the current scope', async () => {
  let selected = 'first'
  api.readWorkspace.mockImplementation(async () => ({ selected }))
  const oldWait = deferred<unknown>()
  api.watchConversation.mockImplementation((id: string) => id === 'first' ? oldWait.promise : Promise.reject(new Error('Current scope failed')))
  render(<LiveActivity />)
  await waitFor(() => expect(api.watchConversation).toHaveBeenCalledWith('first', -1))
  selected = 'second'
  await act(async () => { oldWait.reject(new Error('Abandoned scope deleted')) })
  expect(await screen.findByRole('alert')).toHaveTextContent('Current scope failed')
  expect(screen.queryByText('Abandoned scope deleted')).toBeNull()
})

it('does not restart reads or adopt a pending response after unmount', async () => {
  api.readWorkspace.mockResolvedValue({ selected: 'first' })
  const waiting = deferred<unknown>()
  api.watchConversation.mockReturnValue(waiting.promise)
  const view = render(<LiveActivity />)
  await waitFor(() => expect(api.watchConversation).toHaveBeenCalledOnce())
  view.unmount()
  await act(async () => { waiting.resolve(snapshot('first', 1, 'late')) })
  expect(api.readWorkspace).toHaveBeenCalledTimes(1)
  expect(api.watchConversation).toHaveBeenCalledTimes(1)
})
