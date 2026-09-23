// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { DrillStorage } from './DrillStorage'
const api = vi.hoisted(() => ({ drillStorage: vi.fn(), setDrillStorage: vi.fn() }))
vi.mock('../../platform/ipc/drill', () => api)
const saved = { limitMb: 500, recordingBytes: 1000, referenceBytes: 2000, pendingRemovalBytes: 0 }
beforeEach(() => { vi.resetAllMocks(); api.drillStorage.mockResolvedValue(saved); api.setDrillStorage.mockResolvedValue({ ...saved, limitMb: 0, recordingBytes: 0 }) })
function open(onChanged = vi.fn(async () => {})) {
  render(<I18nProvider locale="english"><DrillStorage active onChanged={onChanged} /></I18nProvider>)
  const details = screen.getByText('Recording storage').closest('details')!
  details.open = true
  fireEvent(details, new Event('toggle'))
  return onChanged
}
const field = () => screen.getByLabelText('Keep up to')

it('applies a typed limit and refreshes saved attempts', async () => {
  const changed = open()
  await waitFor(() => expect(field()).toHaveValue(500))
  fireEvent.change(field(), { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(api.setDrillStorage).toHaveBeenCalledWith(0))
  await waitFor(() => expect(changed).toHaveBeenCalledOnce())
  expect(screen.getByRole('status')).toHaveTextContent('Recordings 0 MB')
})

it('sends any whole number of megabytes, not only preset sizes', async () => {
  open()
  await waitFor(() => expect(field()).toHaveValue(500))
  fireEvent.change(field(), { target: { value: '1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  await waitFor(() => expect(api.setDrillStorage).toHaveBeenCalledWith(1234))
})

it('refuses to send a limit that is not a whole number in range', async () => {
  open()
  await waitFor(() => expect(field()).toHaveValue(500))
  fireEvent.change(field(), { target: { value: '12.5' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('whole number of megabytes')
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  fireEvent.change(field(), { target: { value: '100001' } })
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()
  expect(api.setDrillStorage).not.toHaveBeenCalled()
})

it('refreshes durable attempts after cleanup failure and retries only cleanup', async () => {
  api.setDrillStorage.mockRejectedValueOnce(new Error('The attempt is saved; cleanup failed.'))
  const changed = open()
  await waitFor(() => expect(field()).toHaveValue(500))
  fireEvent.change(field(), { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('cleanup failed')
  expect(changed).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(api.setDrillStorage).toHaveBeenCalledTimes(2))
  expect(api.setDrillStorage).toHaveBeenLastCalledWith(0)
})

it('retries a failed settings read without applying an unknown policy', async () => {
  api.drillStorage.mockRejectedValueOnce(new Error('Storage could not be read.'))
  open()
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage could not be read.')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(field()).toHaveValue(500))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(api.setDrillStorage).not.toHaveBeenCalled()
})
