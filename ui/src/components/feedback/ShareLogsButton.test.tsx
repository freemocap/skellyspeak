// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ShareLogsButton } from './ShareLogsButton'
import { saveDiagnosticLogs, shareDiagnosticLogs, supportsLogSaving, supportsLogSharing } from '../../platform/ipc/diagnostic-sharing'
vi.mock('../../platform/ipc/diagnostic-sharing', () => ({ supportsLogSharing: vi.fn(() => true), supportsLogSaving: vi.fn(() => false), shareDiagnosticLogs: vi.fn(), saveDiagnosticLogs: vi.fn() }))
it('opens the share sheet once, then makes an unsuccessful export retryable', async () => {
  let reject!: (error: Error) => void
  vi.mocked(shareDiagnosticLogs).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  render(<ShareLogsButton />)
  fireEvent.click(screen.getByRole('button', { name: 'Share logs' }))
  expect(screen.getByRole('button', { name: 'Preparing logs…' })).toBeDisabled()
  reject(new Error('Cannot create diagnostic archive: storage is full'))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Cannot create diagnostic archive: storage is full'))
  vi.mocked(shareDiagnosticLogs).mockResolvedValueOnce(undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Share logs' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Share logs' })).toBeEnabled())
  expect(screen.queryByRole('alert')).toBeNull()
  expect(shareDiagnosticLogs).toHaveBeenCalledTimes(2)
})

it('saves on desktop without Android sharing and treats cancellation as cancellation', async () => {
  vi.mocked(supportsLogSharing).mockReturnValue(false)
  vi.mocked(supportsLogSaving).mockReturnValue(true)
  vi.mocked(saveDiagnosticLogs).mockResolvedValueOnce(null).mockResolvedValueOnce('/Downloads/logs.zip')
  render(<ShareLogsButton />)
  expect(screen.queryByRole('button', { name: 'Share logs' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Save logs' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save logs' })).toBeEnabled())
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Save logs' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('/Downloads/logs.zip'))
})
