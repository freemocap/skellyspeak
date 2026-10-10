// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { WorkspaceGraphActivity } from './WorkspaceGraphActivity'
const api = vi.hoisted(() => ({ listNativeWorkspaceRuns: vi.fn(), readNativeRunHistory: vi.fn(), readNativeWorkspaceGraph: vi.fn(), timeline: vi.fn() }))
vi.mock('../../platform/ipc/window', () => api)
vi.mock('./NativeRunView', () => ({ NativeGraphTimeline: (props: unknown) => { api.timeline(props); return <div>Native timeline</div> } }))
beforeEach(() => vi.clearAllMocks())
it.each(['translation', 'word_gloss', 'speech', 'transcription', 'persona', 'drill', 'guide_translation'])('opens %s using the same native timeline without execution commands', async kind => {
  const entry = { engine: 'engine', run: 'run', artifact: 'artifact', kind }
  api.listNativeWorkspaceRuns.mockResolvedValue({ runs: [entry], before: null })
  const graph = { engine: 'engine', run: 'run', artifact_id: 'artifact', revision: '8' }
  api.readNativeWorkspaceGraph.mockResolvedValue(graph)
  render(<WorkspaceGraphActivity />)
  expect(api.listNativeWorkspaceRuns).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', hidden: true }))
  await screen.findByRole('option', { name: kind + ' · run', hidden: true })
  fireEvent.change(screen.getByRole('combobox', { hidden: true }), { target: { value: JSON.stringify(['engine', 'run']) } })
  await waitFor(() => expect(api.timeline).toHaveBeenCalled())
  expect(api.timeline.mock.lastCall?.[0].graph).toEqual(graph)
  expect(api.readNativeWorkspaceGraph).toHaveBeenCalledWith('engine', 'run', null)
})
