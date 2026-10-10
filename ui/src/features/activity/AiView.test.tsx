// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useNavigationStore } from '../../state/navigation/navigation'
import { AiView } from './AiView'

const api = vi.hoisted(() => ({ readWorkspace: vi.fn(), watchConversation: vi.fn(), listTurnHistory: vi.fn(), getAiViewSelection: vi.fn(), setAiViewSelection: vi.fn() }))
vi.mock('../../platform/ipc/workspace', () => ({ ...api, selectedConversation: (workspace: { selected: string | null }) => workspace.selected ? { id: workspace.selected } : null, nativeError: String }))
vi.mock('../../platform/ipc/window', () => api)
vi.mock('./WorkspaceGraphActivity', () => ({ WorkspaceGraphActivity: () => <div>Workspace runs</div> }))
vi.mock('./NativeRunView', () => ({ NativeRunView: ({ turn, selected, onSelect, down }: { turn: { id: string }; selected: string | null; onSelect: (node: string) => void; down: boolean }) => <div data-testid="run" data-down={down}>{turn.id}<span>{selected}</span><button onClick={() => onSelect('node:reply')}>Inspect reply</button></div> }))

function turn(id: string) {
  return { id, channel: 'coach', state: 'pending', paused: false, route: 'hosted', hold: null, operations: [], attempts: [], nativeGraph: { run: id, nodes: { reply: 'Running', helper: 'Unrequested' } } }
}
function snapshot(conversationId: string, revision: number, turns = [turn('run')]) {
  return { conversationId, revision, turns, connection: { paused: false }, transcriptionAttempts: [] }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
beforeEach(() => {
  vi.resetAllMocks()
  useNavigationStore.setState({ aiInspection: null })
  api.readWorkspace.mockResolvedValue({ selected: 'chat' })
  api.watchConversation.mockResolvedValueOnce(snapshot('chat', 1)).mockImplementation(() => new Promise(() => {}))
  api.getAiViewSelection.mockResolvedValue(null)
  api.setAiViewSelection.mockResolvedValue(undefined)
})

it('shows the selected executable run and persists node inspection', async () => {
  render(<AiView mode="docked" actions={null} />)
  expect(await screen.findByTestId('run')).toHaveTextContent('run')
  expect(screen.getByRole('button', { name: 'coach · run' })).toBeVisible()
  expect(screen.getByText('Automatic AI work').closest('details')).not.toHaveAttribute('open')
  fireEvent.click(screen.getByRole('button', { name: 'Inspect reply' }))
  await waitFor(() => expect(api.setAiViewSelection).toHaveBeenLastCalledWith({ conversationId: 'chat', turnId: null, operationKind: 'node:reply' }))
  expect(api.watchConversation).toHaveBeenLastCalledWith('chat', 1)
})

it.each(['screen', 'tray'] as const)('uses a narrow graph in %s mode', async mode => {
  render(<AiView mode={mode} actions={null} />)
  expect(await screen.findByTestId('run')).toHaveAttribute('data-down', 'true')
  expect(screen.queryByText('Other AI activity')).toBeNull()
})

it('pins the explicitly selected newest run when another run arrives', async () => {
  const next = deferred<ReturnType<typeof snapshot>>()
  api.watchConversation.mockReset().mockResolvedValueOnce(snapshot('chat', 1, [turn('first')])).mockReturnValueOnce(next.promise).mockImplementation(() => new Promise(() => {}))
  render(<AiView mode="docked" actions={null} />)
  fireEvent.click(await screen.findByRole('button', { name: 'coach · first' }))
  await act(async () => next.resolve(snapshot('chat', 2, [turn('second'), turn('first')])))
  expect(screen.getByTestId('run')).toHaveTextContent('first')
  fireEvent.click(screen.getByRole('button', { name: 'Follow live' }))
  expect(screen.getByTestId('run')).toHaveTextContent('second')
})

it('restores a run outside the live page before displaying it', async () => {
  const recent = Array.from({ length: 50 }, (_, i) => turn(`run-${50 - i}`))
  api.watchConversation.mockReset().mockResolvedValueOnce(snapshot('chat', 1, recent)).mockImplementation(() => new Promise(() => {}))
  api.getAiViewSelection.mockResolvedValue({ conversationId: 'chat', turnId: 'run-0', operationKind: 'node:reply' })
  api.listTurnHistory.mockResolvedValue({ turns: [turn('run-0')], hasOlder: false })
  render(<AiView mode="window" actions={null} />)
  await waitFor(() => expect(screen.getByTestId('run')).toHaveTextContent('run-0'))
  expect(api.listTurnHistory).toHaveBeenCalledWith('chat', 'run-1', 40)
  expect(screen.getByRole('button', { name: 'Follow live' })).toHaveAttribute('aria-pressed', 'false')
})

it('reports restoration failure without replacing the pinned selection', async () => {
  api.watchConversation.mockReset().mockResolvedValueOnce(snapshot('chat', 1, Array.from({ length: 50 }, (_, i) => turn(String(i))))).mockImplementation(() => new Promise(() => {}))
  api.getAiViewSelection.mockResolvedValue({ conversationId: 'chat', turnId: 'missing', operationKind: null })
  api.listTurnHistory.mockRejectedValue(new Error('History read failed'))
  render(<AiView mode="window" actions={null} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('History read failed')
  expect(screen.queryByTestId('run')).toBeNull()
  expect(api.listTurnHistory).toHaveBeenCalledTimes(1)
})

it('rejects a response from an abandoned conversation and follows the selected scope', async () => {
  const first = deferred<ReturnType<typeof snapshot>>()
  api.watchConversation.mockReset().mockReturnValueOnce(first.promise).mockResolvedValueOnce(snapshot('other', 2, [turn('other-run')])).mockImplementation(() => new Promise(() => {}))
  api.readWorkspace.mockResolvedValueOnce({ selected: 'chat' }).mockResolvedValue({ selected: 'other' })
  render(<AiView mode="window" actions={null} />)
  await waitFor(() => expect(api.watchConversation).toHaveBeenCalledWith('chat', -1))
  await act(async () => first.resolve(snapshot('chat', 1, [turn('abandoned')])) )
  await waitFor(() => expect(screen.getByTestId('run')).toHaveTextContent('other-run'))
  expect(screen.queryByText('abandoned')).toBeNull()
})

it('accepts a direct inspection link while mounted', async () => {
  api.watchConversation.mockReset().mockResolvedValueOnce(snapshot('chat', 1, [turn('new'), turn('selected')])).mockImplementation(() => new Promise(() => {}))
  render(<AiView mode="docked" actions={null} />)
  await screen.findByTestId('run')
  act(() => useNavigationStore.setState({ aiInspection: { conversationId: 'chat', turnId: 'selected', operationKind: 'node:reply' } }))
  await waitFor(() => expect(screen.getByTestId('run')).toHaveTextContent('selected'))
  expect(screen.getByTestId('run')).toHaveTextContent('node:reply')
})

it('does not resume reads after unmount', async () => {
  const next = deferred<ReturnType<typeof snapshot>>()
  api.watchConversation.mockReset().mockReturnValue(next.promise)
  const view = render(<AiView mode="docked" actions={null} />)
  await waitFor(() => expect(api.watchConversation).toHaveBeenCalledTimes(1))
  view.unmount()
  await act(async () => next.resolve(snapshot('chat', 1)))
  expect(api.readWorkspace).toHaveBeenCalledTimes(1)
})
