// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { StartupRefusal } from './StartupRefusal'

const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../platform/ipc/tauri', () => ({ invoke: backend.invoke }))
beforeEach(() => { backend.invoke.mockReset() })

const refusal = { code: 'storage' as const, message: 'This workspace uses schema version 10, and this build supports only version 11. No data was changed. Use Factory Reset to start a new workspace.', refusal: null }

it('shows the exact refusal and resets the workspace from it', async () => {
  backend.invoke.mockResolvedValue(undefined)
  render(<StartupRefusal error={refusal} />)
  expect(screen.getByRole('alert')).toHaveTextContent('this build supports only version 11')
  fireEvent.click(screen.getByRole('button', { name: 'Factory Reset' }))
  await waitFor(() => expect(backend.invoke).toHaveBeenCalledExactlyOnceWith('factory_reset', { confirmation: 'DELETE' }))
})

it('saves a copy of the data and says where it went, without resetting', async () => {
  backend.invoke.mockResolvedValue('C:\\Users\\learner\\Downloads\\skellyspeak-backup-1')
  render(<StartupRefusal error={refusal} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save a copy of my data' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Saved to C:\\Users\\learner\\Downloads\\skellyspeak-backup-1')
  expect(backend.invoke).toHaveBeenCalledExactlyOnceWith('export_workspace')
})

it('reports a failed copy on screen', async () => {
  backend.invoke.mockRejectedValue(new Error('There is no local workspace to save.'))
  render(<StartupRefusal error={refusal} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save a copy of my data' }))
  expect(await screen.findByText('There is no local workspace to save.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Factory Reset' })).toBeEnabled()
})

it('reports a failed reset instead of leaving the screen silent', async () => {
  backend.invoke.mockRejectedValue(new Error('Could not erase local data: access denied'))
  render(<StartupRefusal error={refusal} />)
  fireEvent.click(screen.getByRole('button', { name: 'Factory Reset' }))
  expect(await screen.findByText('Could not erase local data: access denied')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Factory Reset' })).toBeEnabled()
})
