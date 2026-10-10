// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { TurnView } from '../../generated/contracts'
import { NativeRunView } from './NativeRunView'
const api = vi.hoisted(() => ({ readGraphHistory: vi.fn(), readWorkspace: vi.fn(), executeAction: vi.fn() }))
vi.mock('../../platform/ipc/window', () => ({ readGraphHistory: api.readGraphHistory }))
vi.mock('../../platform/ipc/workspace', () => ({ readWorkspace: api.readWorkspace, executeAction: api.executeAction, nativeError: String }))
vi.mock('./NativeGraph', () => ({ NativeGraph: () => null }))
vi.mock('./NativeInspector', () => ({ NativeInspector: () => null }))
it('never exposes execution controls or sends commands while browsing historical or structural views', async () => {
  const graph = { engine: 'engine', run: 'run', artifact_id: 'artifact', revision: '8', nodes: { helper: 'Failed' }, attempts: {}, artifact: {}, step_available: true }
  api.readGraphHistory.mockResolvedValue({ engine: 'engine', run: 'run', frames: [{ ...graph, revision: '2' }], before: null })
  const turn = { id: 'run', state: 'pending', paused: true, hold: null, nativeGraph: graph } as unknown as TurnView
  render(<NativeRunView conversationId="chat" turn={turn} selected={null} onSelect={() => {}} down={false} globallyPaused={false} />)
  fireEvent.focus(screen.getByRole('combobox'))
  await screen.findByRole('option', { name: 'Revision 2' })
  expect(screen.getByRole('button', { name: 'Step' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  for (const value of ['2', 'structure']) {
    fireEvent.change(screen.getByRole('combobox'), { target: { value } })
    for (const name of ['Step', 'Retry', 'Cancel', 'Resume exchange']) expect(screen.queryByRole('button', { name })).toBeNull()
  }
  expect(api.executeAction).not.toHaveBeenCalled()
  expect(api.readWorkspace).not.toHaveBeenCalled()
})
