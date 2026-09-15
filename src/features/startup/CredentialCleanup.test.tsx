// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { AppError } from '../../contracts'
import { CredentialCleanup, useCredentialCleanup } from './CredentialCleanup'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../platform/ipc/tauri', () => backend)
const error: AppError = { code: 'credential', message: 'Keychain locked', refusal: null }
beforeEach(() => {
  backend.invoke.mockReset()
  useCredentialCleanup.setState({ error })
})
it('keeps cleanup failure visible until native retry confirms success', async () => {
  backend.invoke.mockResolvedValueOnce({ credentialCleanup: error })
    .mockResolvedValueOnce({ credentialCleanup: null })
  render(<CredentialCleanup />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry credential cleanup' }))
  await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
  expect(screen.getByRole('alert')).toHaveTextContent('Keychain locked')
  fireEvent.click(screen.getByRole('button'))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(backend.invoke).toHaveBeenLastCalledWith('retry_credential_cleanup')
})
it('preserves recovery after a rejected retry', async () => {
  backend.invoke.mockRejectedValueOnce(new Error('Storage unavailable'))
  render(<CredentialCleanup />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByText('Storage unavailable')).toBeInTheDocument()
  expect(screen.getByRole('button')).toBeEnabled()
})
