// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ShareLogsButton } from './ShareLogsButton'
import { shareDiagnosticLogs } from '../../platform/ipc/diagnostic-sharing'
vi.mock('../../platform/ipc/diagnostic-sharing', () => ({ supportsLogSharing: () => true, shareDiagnosticLogs: vi.fn() }))
it('opens the share sheet once, then makes an unsuccessful export retryable', async () => {
  let reject!: (error: Error) => void
  vi.mocked(shareDiagnosticLogs).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  render(<ShareLogsButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Share logs' }))
  expect(screen.getByRole('button', { name: 'Preparing logs…' })).toBeDisabled()
  reject(new Error('failure'))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not share logs'))
  vi.mocked(shareDiagnosticLogs).mockResolvedValueOnce(undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Share logs' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Share logs' })).toBeEnabled())
  expect(screen.queryByRole('alert')).toBeNull()
  expect(shareDiagnosticLogs).toHaveBeenCalledTimes(2)
})
