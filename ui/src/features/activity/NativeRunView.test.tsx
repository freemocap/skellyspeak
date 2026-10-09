// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TurnView } from '../../generated/contracts'
import { NativeRunView } from './NativeRunView'

const api = vi.hoisted(() => ({ readGraphHistory: vi.fn(), graph: vi.fn(), inspector: vi.fn() }))
vi.mock('../../platform/ipc/window', () => ({ readGraphHistory: api.readGraphHistory }))
vi.mock('../../platform/ipc/workspace', () => ({ nativeError: String }))
vi.mock('./NativeGraph', () => ({ NativeGraph: (props: unknown) => { api.graph(props); return null } }))
vi.mock('./NativeInspector', () => ({ NativeInspector: (props: unknown) => { api.inspector(props); return null } }))
vi.mock('./NativeRunControls', () => ({ NativeRunControls: () => <button>Step</button> }))

const graph = { engine: 'engine', run: 'run', artifact_id: 'artifact', protocol: 1, revision: '9',
  artifact: { definition: { nodes: { first: {}, second: {} } } }, nodes: { first: 'Adopted', second: 'Dormant' },
  attempts: {}, paused: false, active: true, stepping: null }
const frame = { ...graph, revision: '2', nodes: { first: 'Pending', second: 'Dormant' } }
const turn = { id: 'run', nativeGraph: graph, nativePreview: { capture: { text: 'current' } }, nativeResponse: { node: 'first' } } as unknown as TurnView
const props = { conversationId: 'conversation', turn, selected: null, onSelect: vi.fn(), down: false, globallyPaused: false }

beforeEach(() => {
  vi.clearAllMocks()
  api.readGraphHistory.mockResolvedValue({ engine: 'engine', run: 'run', current_revision: '9', frames: [frame], before: null })
})

it('uses the same artifact for structure, native historical frames and live state', async () => {
  render(<NativeRunView {...props} />)
  await screen.findByRole('option', { name: 'Revision 2' })
  expect(api.readGraphHistory).toHaveBeenCalledWith('conversation', 'run', null)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } })
  expect(api.graph.mock.lastCall?.[0].graph).toEqual(frame)
  expect(api.inspector.mock.lastCall?.[0].preview).toBeUndefined()
  expect(api.inspector.mock.lastCall?.[0].response).toBeUndefined()
  expect(screen.queryByRole('button', { name: 'Step' })).toBeNull()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'structure' } })
  expect(api.graph.mock.lastCall?.[0].graph).toEqual({ artifact: graph.artifact, artifact_id: 'artifact', protocol: 1 })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'live' } })
  expect(api.graph.mock.lastCall?.[0].graph).toEqual(graph)
  expect(api.inspector.mock.lastCall?.[0].preview).toEqual(turn.nativePreview)
  expect(screen.getByRole('button', { name: 'Step' })).toBeVisible()
})

it('pages through native revisions without changing the selected historical frame', async () => {
  api.readGraphHistory.mockResolvedValueOnce({ engine: 'engine', run: 'run', frames: [frame], before: '2' })
  render(<NativeRunView {...props} />)
  await screen.findByRole('option', { name: 'Revision 2' })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } })
  api.readGraphHistory.mockResolvedValueOnce({ engine: 'engine', run: 'run', frames: [{ ...frame, revision: '1' }], before: null })
  fireEvent.click(screen.getByRole('button', { name: 'Older' }))
  await screen.findByRole('option', { name: 'Revision 1' })
  expect(api.readGraphHistory).toHaveBeenLastCalledWith('conversation', 'run', '2')
  expect(screen.getByRole('combobox')).toHaveValue('2')
  expect(api.graph.mock.lastCall?.[0].graph).toEqual(frame)
})

it('rejects history belonging to a different run and displays read errors', async () => {
  api.readGraphHistory.mockResolvedValueOnce({ engine: 'other', run: 'run', frames: [frame] })
  render(<NativeRunView {...props} />)
  await waitFor(() => expect(screen.getByText(/Graph history does not match/)).toBeVisible())
  expect(screen.queryByRole('option', { name: 'Revision 2' })).toBeNull()
  expect(api.graph.mock.lastCall?.[0].graph).toEqual(graph)
})
